# $PALLADIUM token sale: how it works and how to switch it on

The sale lets a customer buy $PALLADIUM with ETH on Robinhood Chain, from the wallet page (`/wallet`, **Buy** tab).
It is **off by default** and stays off until every step below is done.

## Before anything else: legal

Selling a token to the public can be a regulated activity in the Philippines (the SEC's rules for crypto-asset service
providers) and elsewhere, and may also involve consumer-protection, AML/KYC and tax obligations. Get advice from a lawyer
before setting `TOKEN_SALE_ENABLED=true` on the live site. Paying for tokens in pesos (for example through PayMongo) is not
built and must not be added without the payment provider's written permission.

## How a purchase works

1. The customer enters a peso amount. The store prices it: reference price + spread (default 5%), converted to ETH at a
   rate from CoinGecko and Coinbase that must agree within 2%.
2. The store's server signs a quote (EIP-712) naming the buyer's wallet, the token amount, the exact ETH amount, a
   deadline (default 5 minutes) and a one-time id. The signature is bound to this chain and this contract.
3. The customer's own wallet calls `buy()` on the sale contract with that ETH. In one transaction the contract checks the
   quote, sends the tokens from its inventory to the buyer and forwards the ETH to the treasury. If anything fails, the
   whole transaction is undone: the buyer never pays without receiving tokens.

The store never holds tokens, ETH or the owner's keys. Its only key (`TOKEN_SALE_SIGNER_KEY`) can sign quotes and nothing
else. If that key leaked, the contract's own limits still apply: an owner-set price floor, a per-purchase cap, a daily
cap, and pause.

## Contract

- Source: `contracts/contracts/PalladiumTokenSale.sol` (OpenZeppelin 5.4: Ownable2Step, Pausable, ReentrancyGuard, EIP712, SafeERC20).
- Tests: `cd contracts && npm install && npx hardhat test` (21 tests: purchase, replay, wrong buyer, wrong signer,
  wrong ETH amount, tampering, expiry, wrong chain or contract, price floor, caps, pause, sold out, failed ETH forwarding,
  fee-on-transfer tokens, owner-only actions, key rotation, two-step ownership, and the store server's own signatures).
- After changing the contract: `npx hardhat compile && node scripts/export-artifact.js` (updates `src/lib/palladium/sale-artifact.json`).
- It has **not** had an independent security audit. Get one before selling meaningful amounts.

## Switch-on checklist (testnet first)

1. **Token**: `TOKEN_NETWORK=testnet`, `TOKEN_CONTRACT_ADDRESS`, `TOKEN_DECIMALS` in Vercel.
2. **Signing key**: on your own computer, in the store folder, run
   `node -e "const a=require('viem/accounts');const k=a.generatePrivateKey();console.log('TOKEN_SALE_SIGNER_KEY='+k);console.log('address '+a.privateKeyToAccount(k).address)"`
   and put the key in Vercel as `TOKEN_SALE_SIGNER_KEY` (mark it sensitive). Never paste it anywhere else.
3. **Price**: `TOKEN_PRICE_SOURCE=admin` in Vercel, redeploy, then set the reference price and spread in **Admin > Token**.
   This price is labelled to customers as a fixed rate set by Palladium, not a market price.
4. **Deploy**: in Admin > Token, connect the wallet that should own the contract (ideally a multisig) and press
   **Deploy from my wallet**. Then set `TOKEN_SALE_CONTRACT_ADDRESS` in Vercel and redeploy.
5. **Fund**: in Admin > Token, **Add tokens for sale** (moves tokens from the owner wallet into the contract).
6. **Open**: **Unpause contract**, tick **Sale switched on**, and set `TOKEN_SALE_ENABLED=true` in Vercel.
7. **Test**: buy a small amount from a second wallet; check the tokens arrived, the treasury got the ETH, and the purchase
   shows in Admin > Token and in the buyer's wallet Activity.
8. Mainnet: repeat with `TOKEN_NETWORK=mainnet` and a new deployment, starting with small amounts.

## Stopping the sale

Fastest: **Pause contract** in Admin > Token (takes effect in the next block). Also: untick **Sale switched on**, or
remove `TOKEN_SALE_ENABLED`. To end it, withdraw the unsold tokens.

## Rotating the signing key

Generate a new key (step 2), set it in Vercel, redeploy, then in Admin > Token press **Trust this store's key**. Quotes
signed with the old key stop working immediately.

## Reconciliation

Every purchase is a `Purchased(buyer, quoteId, tokenAmount, weiAmount)` event on the contract, listed in Admin > Token and
on the block explorer. ETH goes straight to the treasury in the same transaction, so treasury inflows always equal the sum
of `weiAmount`. There is no pending state to reconcile: a purchase either happened on-chain or did not.
