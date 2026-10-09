// Proves the store server's signing (viem, as in src/lib/palladium/sale.ts) produces quotes the contract accepts,
// and that the store's price arithmetic respects the contract's floor.
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');
const { privateKeyToAccount } = require('viem/accounts');

const SIGNER_KEY = '0x' + '11'.repeat(32); // test-only key, never used anywhere else
const QUOTE_TYPES = { Quote: [
  { name: 'buyer', type: 'address' }, { name: 'tokenAmount', type: 'uint256' }, { name: 'weiAmount', type: 'uint256' },
  { name: 'deadline', type: 'uint256' }, { name: 'quoteId', type: 'bytes32' },
] };

describe('Store server quotes against the real contract', () => {
  it('a viem-signed quote buys tokens; the ₱1,050 at ₱2.10 example delivers 500 tokens', async () => {
    const [owner, treasury, buyer] = await ethers.getSigners();
    const server = privateKeyToAccount(SIGNER_KEY);
    const token = await (await ethers.getContractFactory('TestToken')).deploy();
    const sale = await (await ethers.getContractFactory('PalladiumTokenSale')).deploy(
      await token.getAddress(), 18, treasury.address, server.address, owner.address,
      ethers.parseEther('0.000001'), ethers.parseUnits('100000', 18), ethers.parseUnits('250000', 18), 600);
    await token.transfer(await sale.getAddress(), ethers.parseUnits('1000000', 18));
    await sale.unpause();

    // Same arithmetic as src/lib/palladium/sale-math.ts: ₱2.00 + 5% = ₱2.10; ₱1,050 -> 500 tokens; ETH at ₱200,000.
    const SCALE = 10n ** 18n;
    const unit = (2n * SCALE * 10500n + 9999n) / 10000n;
    const phpCentavos = 105000n;
    const tokenAmount = (phpCentavos * 10n ** 18n * SCALE) / (100n * unit);
    const ethPhp = 200000n * SCALE;
    const weiAmount = (phpCentavos * SCALE * SCALE + 100n * ethPhp - 1n) / (100n * ethPhp);
    expect(tokenAmount).to.equal(ethers.parseUnits('500', 18));

    const { chainId } = await ethers.provider.getNetwork();
    const message = { buyer: buyer.address, tokenAmount, weiAmount, deadline: BigInt((await time.latest()) + 300), quoteId: ethers.id('server-quote-1') };
    const signature = await server.signTypedData({ domain: { name: 'PalladiumTokenSale', version: '1', chainId: Number(chainId), verifyingContract: await sale.getAddress() }, types: QUOTE_TYPES, primaryType: 'Quote', message });

    await expect(sale.connect(buyer).buy(tokenAmount, message.deadline, message.quoteId, signature, { value: weiAmount })).to.emit(sale, 'Purchased');
    expect(await token.balanceOf(buyer.address)).to.equal(ethers.parseUnits('500', 18));
  });
});
