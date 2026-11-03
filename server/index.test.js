import test from 'node:test';
import assert from 'node:assert/strict';

// VERCEL stops the app from starting Vite or binding a port; the tests serve it on a free one.
process.env.VERCEL = '1';
const { default: app } = await import('./index.js');
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

// These requests are rejected before any NHL call, so they run without a network.
for (const [label, path] of [
  ['a player id that is not seven digits', '/api/players/abc'],
  ['a player id that is too short', '/api/players/12345'],
  ['a season that is not a number', '/api/players/8478402?season=abc'],
  ['a season before the NHL existed', '/api/players/8478402?season=1800'],
  ['a season in the future', '/api/players/8478402?season=3000'],
  ['a date that is not a date', '/api/scores?date=banana'],
  ['a date more than a year away', '/api/scores?date=2001-01-01'],
  ['a date that does not exist', '/api/scores?date=2026-02-30'],
]) {
  test(`${label} is a 400 with its own message, not an NHL outage`, async () => {
    const response = await fetch(base + path);
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.ok(body.error && !/NHL source/.test(body.error), body.error);
  });
}

test('unknown API routes are still a 404', async () => {
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
});
