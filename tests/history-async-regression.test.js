const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const main = fs.readFileSync('main.js', 'utf8');

test('history storage uses userData path', () => {
  assert.match(main, /const historyDir = path\.join\(app\.getPath\('userData'\), 'chat_history'\);/);
});

test('history crypto and IO use async APIs', () => {
  assert.match(main, /const scryptAsync = promisify\(crypto\.scrypt\);/);
  assert.doesNotMatch(main, /scryptSync\(/);
  assert.doesNotMatch(main, /readFileSync\(/);
  assert.doesNotMatch(main, /writeFileSync\(/);
});
