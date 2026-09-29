import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIssueBody, cleanDoor, addDoor } from '../scripts/add-door.mjs';

const body = '### Place\n\nJaipur\n\n### Line\n\nMy grandmother tied it before Diwali.\n\n### Consent\n\n- [X] I wrote this';

test('parses an issue form body', () => {
  assert.deepEqual(parseIssueBody(body), { place: 'Jaipur', line: 'My grandmother tied it before Diwali.' });
});

test('rejects links, markup, empty and long input', () => {
  assert.ok(cleanDoor({ place: 'Pune', line: 'see https://x.com' }).error);
  assert.ok(cleanDoor({ place: 'Pune', line: '<b>hi</b>' }).error);
  assert.ok(cleanDoor({ place: '_No response_', line: 'x' }).error);
  assert.ok(cleanDoor({ place: 'Pune', line: 'a'.repeat(141) }).error);
});

test('collapses whitespace and keeps a valid door', () => {
  assert.deepEqual(cleanDoor({ place: '  Pune ', line: 'The  bell\nrang.' }), { place: 'Pune', line: 'The bell rang.' });
});

test('adds a door once per issue', () => {
  const one = addDoor([], { place: 'Pune', line: 'x' }, { by: 'a', issue: 4 });
  assert.equal(addDoor(one, { place: 'Pune', line: 'x' }, { by: 'a', issue: 4 }).length, 1);
});
