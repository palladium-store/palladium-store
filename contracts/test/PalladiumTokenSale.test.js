const { expect } = require('chai');
const { ethers } = require('hardhat');
const { time } = require('@nomicfoundation/hardhat-network-helpers');

const T = (n) => ethers.parseUnits(String(n), 18);           // whole tokens -> smallest units
const MIN_WEI_PER_TOKEN = ethers.parseEther('0.000001');      // floor: 0.000001 ETH per token
const PER_PURCHASE = T(100_000);
const PER_DAY = T(250_000);
const LIFETIME = 600;                                         // quotes valid up to 10 minutes

async function setup(tokenName = 'TestToken') {
  const [owner, treasury, signer, buyer, other] = await ethers.getSigners();
  const token = await (await ethers.getContractFactory(tokenName)).deploy();
  const Sale = await ethers.getContractFactory('PalladiumTokenSale');
  const sale = await Sale.deploy(await token.getAddress(), 18, treasury.address, signer.address, owner.address, MIN_WEI_PER_TOKEN, PER_PURCHASE, PER_DAY, LIFETIME);
  await token.transfer(await sale.getAddress(), T(1_000_000));
  await sale.unpause();
  const domain = { name: 'PalladiumTokenSale', version: '1', chainId: (await ethers.provider.getNetwork()).chainId, verifyingContract: await sale.getAddress() };
  const types = { Quote: [
    { name: 'buyer', type: 'address' }, { name: 'tokenAmount', type: 'uint256' }, { name: 'weiAmount', type: 'uint256' },
    { name: 'deadline', type: 'uint256' }, { name: 'quoteId', type: 'bytes32' },
  ] };
  let n = 0;
  const quote = async ({ by = signer, buyerAddr = buyer.address, tokens = T(1000), wei = ethers.parseEther('0.002'), ttl = 300, id } = {}) => {
    const q = { buyer: buyerAddr, tokenAmount: tokens, weiAmount: wei, deadline: (await time.latest()) + ttl, quoteId: id ?? ethers.id(`quote-${++n}-${Date.now()}`) };
    return { ...q, signature: await by.signTypedData(domain, types, q) };
  };
  const buy = (q, from = buyer, value = q.weiAmount) => sale.connect(from).buy(q.tokenAmount, q.deadline, q.quoteId, q.signature, { value });
  return { owner, treasury, signer, buyer, other, token, sale, quote, buy, domain, types };
}

describe('PalladiumTokenSale', () => {
  it('delivers the tokens and forwards the ETH to the treasury in one transaction', async () => {
    const { sale, token, buyer, treasury, quote, buy } = await setup();
    const q = await quote();
    const before = await ethers.provider.getBalance(treasury.address);
    await expect(buy(q)).to.emit(sale, 'Purchased').withArgs(buyer.address, q.quoteId, q.tokenAmount, q.weiAmount);
    expect(await token.balanceOf(buyer.address)).to.equal(T(1000));
    expect(await ethers.provider.getBalance(treasury.address)).to.equal(before + q.weiAmount);
    expect(await ethers.provider.getBalance(await sale.getAddress())).to.equal(0n);
    expect(await sale.inventory()).to.equal(T(999_000));
  });

  it('starts paused so the owner can fund and check it first', async () => {
    const [owner, treasury, signer] = await ethers.getSigners();
    const token = await (await ethers.getContractFactory('TestToken')).deploy();
    const sale = await (await ethers.getContractFactory('PalladiumTokenSale')).deploy(await token.getAddress(), 18, treasury.address, signer.address, owner.address, MIN_WEI_PER_TOKEN, PER_PURCHASE, PER_DAY, LIFETIME);
    expect(await sale.paused()).to.equal(true);
  });

  it('refuses a quote that is used twice', async () => {
    const { sale, quote, buy } = await setup();
    const q = await quote();
    await buy(q);
    await expect(buy(q)).to.be.revertedWithCustomError(sale, 'QuoteAlreadyUsed');
  });

  it('refuses a quote used by anyone other than the buyer it names', async () => {
    const { sale, quote, buy, other } = await setup();
    await expect(buy(await quote(), other)).to.be.revertedWithCustomError(sale, 'BadSignature');
  });

  it('refuses a quote signed by anyone but the store', async () => {
    const { sale, quote, buy, other } = await setup();
    await expect(buy(await quote({ by: other }))).to.be.revertedWithCustomError(sale, 'BadSignature');
  });

  it('refuses paying a different ETH amount than quoted (underpaying or overpaying)', async () => {
    const { sale, quote, buy, buyer } = await setup();
    const q = await quote();
    await expect(buy(q, buyer, q.weiAmount - 1n)).to.be.revertedWithCustomError(sale, 'BadSignature');
    await expect(buy(q, buyer, q.weiAmount + 1n)).to.be.revertedWithCustomError(sale, 'BadSignature');
  });

  it('refuses a tampered token amount', async () => {
    const { sale, quote, buy } = await setup();
    const q = await quote();
    await expect(buy({ ...q, tokenAmount: q.tokenAmount + 1n })).to.be.revertedWithCustomError(sale, 'BadSignature');
  });

  it('refuses expired quotes and quotes valid for too long', async () => {
    const { sale, quote, buy } = await setup();
    const q = await quote({ ttl: 60 });
    await time.increase(61);
    await expect(buy(q)).to.be.revertedWithCustomError(sale, 'QuoteExpired');
    await expect(buy(await quote({ ttl: LIFETIME + 60 }))).to.be.revertedWithCustomError(sale, 'QuoteTooLong');
  });

  it('refuses a quote for another deployment or another chain (EIP-712 domain)', async () => {
    const { sale, signer, buyer, types, buy } = await setup();
    const q = { buyer: buyer.address, tokenAmount: T(10), weiAmount: ethers.parseEther('0.001'), deadline: (await time.latest()) + 300, quoteId: ethers.id('x') };
    const { chainId } = await ethers.provider.getNetwork();
    const wrongChain = await signer.signTypedData({ name: 'PalladiumTokenSale', version: '1', chainId: chainId + 1n, verifyingContract: await sale.getAddress() }, types, q);
    await expect(buy({ ...q, signature: wrongChain })).to.be.revertedWithCustomError(sale, 'BadSignature');
    const wrongContract = await signer.signTypedData({ name: 'PalladiumTokenSale', version: '1', chainId, verifyingContract: buyer.address }, types, q);
    await expect(buy({ ...q, signature: wrongContract })).to.be.revertedWithCustomError(sale, 'BadSignature');
  });

  it('enforces the price floor even with a valid signature (a stolen signing key cannot sell cheaply)', async () => {
    const { sale, quote, buy } = await setup();
    // 1000 tokens at the floor of 0.000001 ETH each = 0.001 ETH. One wei less is refused.
    await expect(buy(await quote({ wei: ethers.parseEther('0.001') - 1n }))).to.be.revertedWithCustomError(sale, 'BelowMinimumPrice');
    await expect(buy(await quote({ wei: ethers.parseEther('0.001') }))).to.emit(sale, 'Purchased');
  });

  it('enforces the per-purchase and daily caps, and resets the daily cap the next day', async () => {
    const { sale, quote, buy } = await setup();
    await expect(buy(await quote({ tokens: PER_PURCHASE + 1n, wei: ethers.parseEther('1') }))).to.be.revertedWithCustomError(sale, 'OverPurchaseLimit');
    await buy(await quote({ tokens: T(100_000), wei: ethers.parseEther('0.2') }));
    await buy(await quote({ tokens: T(100_000), wei: ethers.parseEther('0.2') }));
    await expect(buy(await quote({ tokens: T(60_000), wei: ethers.parseEther('0.2') }))).to.be.revertedWithCustomError(sale, 'OverDailyLimit');
    await time.increase(24 * 3600);
    await expect(buy(await quote({ tokens: T(60_000), wei: ethers.parseEther('0.2') }))).to.emit(sale, 'Purchased');
  });

  it('refuses a purchase larger than the inventory', async () => {
    const { sale, owner, quote, buy } = await setup();
    await sale.withdrawInventory(owner.address, T(999_500));
    await expect(buy(await quote({ tokens: T(1000) }))).to.be.revertedWithCustomError(sale, 'SoldOut');
  });

  it('stops all purchases while paused', async () => {
    const { sale, quote, buy } = await setup();
    await sale.pause();
    await expect(buy(await quote())).to.be.revertedWithCustomError(sale, 'EnforcedPause');
    await sale.unpause();
    await expect(buy(await quote())).to.emit(sale, 'Purchased');
  });

  it('reverts the whole purchase if the treasury cannot receive ETH (buyer keeps their ETH)', async () => {
    const { sale, token, buyer, quote, buy } = await setup();
    const bad = await (await ethers.getContractFactory('RejectingTreasury')).deploy();
    await sale.setTreasury(await bad.getAddress());
    await expect(buy(await quote())).to.be.revertedWithCustomError(sale, 'EthForwardFailed');
    expect(await token.balanceOf(buyer.address)).to.equal(0n);
  });

  it('refuses tokens that take a fee on transfer', async () => {
    const { sale, quote, buy } = await setup('FeeToken');
    await expect(buy(await quote())).to.be.revertedWithCustomError(sale, 'TokenTransferMismatch');
  });

  it('refuses plain ETH sent to the contract', async () => {
    const { sale, buyer } = await setup();
    await expect(buyer.sendTransaction({ to: await sale.getAddress(), value: 1n })).to.be.revertedWithCustomError(sale, 'DirectEthNotAccepted');
  });

  it('lets only the owner change settings, pause or withdraw inventory', async () => {
    const { sale, other } = await setup();
    const s = sale.connect(other);
    await expect(s.pause()).to.be.revertedWithCustomError(sale, 'OwnableUnauthorizedAccount');
    await expect(s.setQuoteSigner(other.address)).to.be.revertedWithCustomError(sale, 'OwnableUnauthorizedAccount');
    await expect(s.setTreasury(other.address)).to.be.revertedWithCustomError(sale, 'OwnableUnauthorizedAccount');
    await expect(s.setLimits(1n, 1n, 1n, 60)).to.be.revertedWithCustomError(sale, 'OwnableUnauthorizedAccount');
    await expect(s.withdrawInventory(other.address, 1n)).to.be.revertedWithCustomError(sale, 'OwnableUnauthorizedAccount');
  });

  it('rejects unsafe settings', async () => {
    const { sale, owner } = await setup();
    await expect(sale.setLimits(0n, PER_PURCHASE, PER_DAY, LIFETIME)).to.be.revertedWithCustomError(sale, 'BadAmount');
    await expect(sale.setLimits(MIN_WEI_PER_TOKEN, PER_PURCHASE, PER_PURCHASE - 1n, LIFETIME)).to.be.revertedWithCustomError(sale, 'BadAmount');
    await expect(sale.setLimits(MIN_WEI_PER_TOKEN, PER_PURCHASE, PER_DAY, 2 * 3600)).to.be.revertedWithCustomError(sale, 'BadAmount');
    await expect(sale.setTreasury(ethers.ZeroAddress)).to.be.revertedWithCustomError(sale, 'ZeroAddress');
    await expect(sale.withdrawInventory(ethers.ZeroAddress, 1n)).to.be.revertedWithCustomError(sale, 'ZeroAddress');
    expect(await sale.owner()).to.equal(owner.address);
  });

  it('rotating the signing key invalidates quotes from the old key', async () => {
    const { sale, other, quote, buy } = await setup();
    const q = await quote();
    await sale.setQuoteSigner(other.address);
    await expect(buy(q)).to.be.revertedWithCustomError(sale, 'BadSignature');
    await expect(buy(await quote({ by: other }))).to.emit(sale, 'Purchased');
  });

  it('transfers ownership only when the new owner accepts (two steps)', async () => {
    const { sale, owner, other } = await setup();
    await sale.transferOwnership(other.address);
    expect(await sale.owner()).to.equal(owner.address);
    await sale.connect(other).acceptOwnership();
    expect(await sale.owner()).to.equal(other.address);
  });
});
