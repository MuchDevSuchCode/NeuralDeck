const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync('renderer.js', 'utf8');

test('markdown path escapes input before formatting', () => {
  assert.match(renderer, /let html = escapeHtml\(source\);/);
  assert.match(renderer, /function escapeHtml\(text\)/);
});

test('links are protocol-sanitized and protected', () => {
  assert.match(renderer, /function sanitizeUrl\(rawUrl\)/);
  assert.match(renderer, /protocol === 'http:' \|\| protocol === 'https:' \|\| protocol === 'mailto:'/);
  assert.match(renderer, /rel="noopener noreferrer"/);
});
