import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeHtml, toHtml, htmlToText } from '../src/lib/rich-text';

test('keeps allowed formatting', () => {
  assert.equal(sanitizeHtml('<h2>Title</h2><p>Hi <strong>bold</strong> and <em>it</em></p><ul><li>a</li><li>b</li></ul>'), '<h2>Title</h2><p>Hi <strong>bold</strong> and <em>it</em></p><ul><li>a</li><li>b</li></ul>');
});
test('removes scripts, handlers and unknown tags but keeps text', () => {
  const out = sanitizeHtml('<p onclick="x()">Hi</p><script>alert(1)</script><img src=x onerror=alert(1)><iframe src="//e"></iframe><span style="color:red">ok</span>');
  assert.equal(out, '<p>Hi</p>ok');
  assert.ok(!/script|onerror|onclick|iframe|style/i.test(out));
});
test('links: only safe schemes, safe attributes', () => {
  assert.equal(sanitizeHtml('<a href="https://x.com/a?b=1&c=2" onclick="e()">go</a>'), '<a href="https://x.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer nofollow">go</a>');
  assert.equal(sanitizeHtml('<a href="javascript:alert(1)">x</a>'), 'x');
  assert.equal(sanitizeHtml('<a href="JaVa\tScRiPt:alert(1)">x</a>'), 'x');
  assert.equal(sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>'), 'x');
  assert.equal(sanitizeHtml('<a href="java&Tab;script:alert(1)">x</a>'), 'x');
  assert.equal(sanitizeHtml('<a href="data:text/html;base64,AAA">x</a>'), 'x');
  assert.equal(sanitizeHtml('<a href="//evil.com">x</a>'), 'x');
  assert.equal(sanitizeHtml('<a href="/shop">s</a>'), '<a href="/shop">s</a>');
  assert.equal(sanitizeHtml('<a href="mailto:a@b.com">m</a>'), '<a href="mailto:a@b.com">m</a>');
  assert.equal(sanitizeHtml('<a href="https://x.com&quot; onmouseover=&quot;e()">x</a>').includes('onmouseover="'), false);
});
test('quote injection in href stays inside the attribute', () => {
  const out = sanitizeHtml('<a href=\'https://x.com/" onmouseover="alert(1)\'>x</a>');
  assert.ok(!/" onmouseover="/.test(out), out);
});
test('closes unclosed tags and ignores stray closers', () => {
  assert.equal(sanitizeHtml('<p>one <strong>two'), '<p>one <strong>two</strong></p>');
  assert.equal(sanitizeHtml('x</strong></p>y'), 'xy');
});
test('maps editor output (div, b, i, h1) to allowed tags', () => {
  assert.equal(sanitizeHtml('<div>a</div><div><b>b</b> <i>c</i></div><h1>t</h1>'), '<p>a</p><p><strong>b</strong> <em>c</em></p><h2>t</h2>');
});
test('escapes stray angle brackets and ampersands in text', () => {
  assert.equal(sanitizeHtml('<p>1 < 2 & 3 > 2</p>'), '<p>1 &lt; 2 &amp; 3 &gt; 2</p>');
  assert.equal(sanitizeHtml('<p>Tom &amp; Jerry</p>'), '<p>Tom &amp; Jerry</p>');
});
test('li outside a list gets wrapped; empty blocks removed', () => {
  assert.equal(sanitizeHtml('<li>a</li>'), '<ul><li>a</li></ul>');
  assert.equal(sanitizeHtml('<p></p><p><br></p><p>x</p>'), '<p>x</p>');
});
test('plain-text descriptions become paragraphs, html is sanitized', () => {
  assert.equal(toHtml('Line one\nline two\n\nSecond & more'), '<p>Line one<br>line two</p><p>Second &amp; more</p>');
  assert.equal(toHtml('Just text'), '<p>Just text</p>');
  assert.equal(toHtml('<p>ok</p><script>x</script>'), '<p>ok</p>');
  assert.equal(toHtml(null), '');
});
test('htmlToText for meta descriptions', () => {
  assert.equal(htmlToText('<h2>A</h2><p>B &amp; C</p><ul><li>d</li></ul>'), 'A B & C d');
});
test('idempotent', () => {
  const once = sanitizeHtml('<p>x <a href="https://a.com/?q=1&b=2">l</a> <b>y</b></p><script>1</script>');
  assert.equal(sanitizeHtml(once), once);
});
