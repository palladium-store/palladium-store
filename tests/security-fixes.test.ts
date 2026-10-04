import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext } from '../src/components/store/labels';
import { cartItems, withinPerItemLimit } from '../src/lib/validators';

test('safeNext keeps ordinary on-site paths', () => {
  assert.equal(safeNext('/account/orders'), '/account/orders');
  assert.equal(safeNext('/shop?category=paddles#top'), '/shop?category=paddles#top');
  assert.equal(safeNext('/'), '/');
});

test('safeNext refuses anything that can leave the site', () => {
  for (const bad of ['//evil.example', '/\\evil.example', '/\t/evil.example', '/\n/evil.example', '/\r/evil.example', '/%09/evil.example'.replace('%09', '\t'),
    'https://evil.example', 'evil.example', 'javascript:alert(1)', '', null, undefined]) {
    assert.equal(safeNext(bad as string), null, `should refuse ${JSON.stringify(bad)}`);
  }
});

test('the same item repeated on many lines is capped at 99 in total', () => {
  assert.equal(withinPerItemLimit([{ variantId: 'a', qty: 99 }]), true);
  assert.equal(withinPerItemLimit([{ variantId: 'a', qty: 60 }, { variantId: 'b', qty: 60 }]), true);
  assert.equal(withinPerItemLimit([{ variantId: 'a', qty: 60 }, { variantId: 'a', qty: 40 }]), false);
  const flood = Array.from({ length: 50 }, () => ({ variantId: 'koru', qty: 99 }));
  assert.equal(cartItems.safeParse(flood).success, false);
  assert.equal(cartItems.safeParse([{ variantId: 'koru', qty: 2 }, { variantId: 'koru', qty: 1 }]).success, true);
});
