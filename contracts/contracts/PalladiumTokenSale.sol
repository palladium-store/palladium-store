// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title Palladium token sale
 * @notice Sells $PALLADIUM from this contract's own inventory for ETH, at prices quoted by the Palladium store.
 *
 * How a purchase works, in one transaction:
 *  1. The store's server prices the purchase (reference price + spread, converted to ETH) and signs a quote naming the
 *     buyer, the token amount, the exact ETH amount, a deadline and a one-time id (EIP-712, bound to this chain and contract).
 *  2. The buyer calls buy() with that quote and exactly that ETH.
 *  3. The contract checks the quote, sends the tokens to the buyer and forwards the ETH to the treasury. If any step fails,
 *     the whole transaction reverts: the buyer never pays without receiving tokens.
 *
 * Limits that hold even if the quote-signing key is stolen: a minimum price set by the owner, a per-purchase cap,
 * a daily cap, and pause. The contract never mints tokens and never keeps ETH.
 *
 * Roles: the owner (the business's wallet, ideally a multisig) manages settings and unsold inventory. The quote signer
 * (the store server) can only sign quotes. Nobody else has any privilege.
 */
contract PalladiumTokenSale is Ownable2Step, Pausable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant QUOTE_TYPEHASH =
        keccak256("Quote(address buyer,uint256 tokenAmount,uint256 weiAmount,uint256 deadline,bytes32 quoteId)");

    /// The $PALLADIUM token sold here. Fixed at deployment.
    IERC20 public immutable token;
    /// One whole token in smallest units (10 ** decimals), used for the price floor.
    uint256 public immutable unit;

    /// Receives the ETH of every purchase, in the same transaction.
    address payable public treasury;
    /// The store server's signing address. It can only sign quotes.
    address public quoteSigner;
    /// Minimum price in wei per whole token. No quote below it is accepted.
    uint256 public minWeiPerToken;
    /// Most tokens (smallest units) one purchase may buy.
    uint256 public maxTokensPerPurchase;
    /// Most tokens (smallest units) all purchases together may buy per UTC day.
    uint256 public maxTokensPerDay;
    /// Longest a quote may still be valid for, in seconds, when it is used.
    uint256 public maxQuoteLifetime;

    /// Quote ids already used. A quote can be used once.
    mapping(bytes32 => bool) public quoteUsed;
    uint256 public currentDay;
    uint256 public soldToday;

    event Purchased(address indexed buyer, bytes32 indexed quoteId, uint256 tokenAmount, uint256 weiAmount);
    event TreasuryChanged(address treasury);
    event QuoteSignerChanged(address signer);
    event LimitsChanged(uint256 minWeiPerToken, uint256 maxTokensPerPurchase, uint256 maxTokensPerDay, uint256 maxQuoteLifetime);
    event InventoryWithdrawn(address to, uint256 amount);

    error ZeroAddress();
    error QuoteExpired();
    error QuoteTooLong();
    error QuoteAlreadyUsed();
    error BadSignature();
    error BadAmount();
    error OverPurchaseLimit();
    error OverDailyLimit();
    error BelowMinimumPrice();
    error SoldOut();
    error TokenTransferMismatch();
    error EthForwardFailed();
    error DirectEthNotAccepted();

    constructor(
        IERC20 token_,
        uint8 decimals_,
        address payable treasury_,
        address quoteSigner_,
        address owner_,
        uint256 minWeiPerToken_,
        uint256 maxTokensPerPurchase_,
        uint256 maxTokensPerDay_,
        uint256 maxQuoteLifetime_
    ) Ownable(owner_) EIP712("PalladiumTokenSale", "1") {
        if (address(token_) == address(0) || treasury_ == address(0) || quoteSigner_ == address(0)) revert ZeroAddress();
        token = token_;
        unit = 10 ** uint256(decimals_);
        treasury = treasury_;
        quoteSigner = quoteSigner_;
        _setLimits(minWeiPerToken_, maxTokensPerPurchase_, maxTokensPerDay_, maxQuoteLifetime_);
        emit TreasuryChanged(treasury_);
        emit QuoteSignerChanged(quoteSigner_);
        // Starts paused: the owner funds the inventory and checks everything, then unpauses.
        _pause();
    }

    /**
     * @notice Buys `tokenAmount` tokens for exactly msg.value wei, using a quote signed by the store.
     * @param tokenAmount tokens in smallest units, as quoted
     * @param deadline unix time after which the quote is no longer valid
     * @param quoteId the quote's one-time id
     * @param signature the store's EIP-712 signature of the quote
     */
    function buy(uint256 tokenAmount, uint256 deadline, bytes32 quoteId, bytes calldata signature)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (block.timestamp > deadline) revert QuoteExpired();
        if (deadline > block.timestamp + maxQuoteLifetime) revert QuoteTooLong();
        if (quoteUsed[quoteId]) revert QuoteAlreadyUsed();
        if (tokenAmount == 0 || msg.value == 0) revert BadAmount();
        if (tokenAmount > maxTokensPerPurchase) revert OverPurchaseLimit();
        // Price floor: msg.value / (tokenAmount / unit) >= minWeiPerToken, without dividing.
        if (msg.value * unit < tokenAmount * minWeiPerToken) revert BelowMinimumPrice();

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(QUOTE_TYPEHASH, msg.sender, tokenAmount, msg.value, deadline, quoteId))
        );
        if (ECDSA.recover(digest, signature) != quoteSigner) revert BadSignature();

        uint256 day = block.timestamp / 1 days;
        if (day != currentDay) {
            currentDay = day;
            soldToday = 0;
        }
        if (soldToday + tokenAmount > maxTokensPerDay) revert OverDailyLimit();

        if (token.balanceOf(address(this)) < tokenAmount) revert SoldOut();

        quoteUsed[quoteId] = true;
        soldToday += tokenAmount;

        uint256 buyerBefore = token.balanceOf(msg.sender);
        token.safeTransfer(msg.sender, tokenAmount);
        // The buyer must receive exactly what they paid for (rules out tokens that take a fee on transfer).
        if (token.balanceOf(msg.sender) - buyerBefore != tokenAmount) revert TokenTransferMismatch();

        (bool ok, ) = treasury.call{value: msg.value}("");
        if (!ok) revert EthForwardFailed();

        emit Purchased(msg.sender, quoteId, tokenAmount, msg.value);
    }

    /// Tokens currently available to sell.
    function inventory() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /// The EIP-712 domain separator (for the server and tests).
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ---------------- owner ----------------

    function setTreasury(address payable treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryChanged(treasury_);
    }

    /// Replaces the server's signing address (for example after rotating the key). Quotes from the old key stop working.
    function setQuoteSigner(address signer_) external onlyOwner {
        if (signer_ == address(0)) revert ZeroAddress();
        quoteSigner = signer_;
        emit QuoteSignerChanged(signer_);
    }

    function setLimits(uint256 minWeiPerToken_, uint256 maxTokensPerPurchase_, uint256 maxTokensPerDay_, uint256 maxQuoteLifetime_)
        external
        onlyOwner
    {
        _setLimits(minWeiPerToken_, maxTokensPerPurchase_, maxTokensPerDay_, maxQuoteLifetime_);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// Takes unsold tokens back out of the sale (for example to end the sale). Only the owner, only to a named address.
    function withdrawInventory(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        token.safeTransfer(to, amount);
        emit InventoryWithdrawn(to, amount);
    }

    /// The contract never holds ETH: plain transfers are refused.
    receive() external payable {
        revert DirectEthNotAccepted();
    }

    function _setLimits(uint256 minWei, uint256 perPurchase, uint256 perDay, uint256 lifetime) private {
        if (minWei == 0 || perPurchase == 0 || perDay < perPurchase || lifetime == 0 || lifetime > 1 hours) revert BadAmount();
        minWeiPerToken = minWei;
        maxTokensPerPurchase = perPurchase;
        maxTokensPerDay = perDay;
        maxQuoteLifetime = lifetime;
        emit LimitsChanged(minWei, perPurchase, perDay, lifetime);
    }
}
