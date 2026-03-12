const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = fs.readFileSync('renderer.js', 'utf8');

test('tool loop does not perform redundant final completion call', () => {
  assert.doesNotMatch(renderer, /const finalPayload = \{ \.\.\.payload, messages, stream: useStream \};/);
  assert.doesNotMatch(renderer, /window\.ollama\.chat\(base, finalPayload, useStream/);
});

test('tool loop renders result directly from latest non-streaming output', () => {
  assert.match(renderer, /Render the latest non-streaming assistant result from the tool loop\./);
  assert.match(renderer, /assistantDiv\.innerHTML = renderMarkdown\(fullResponse\);/);
});
