import test from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from './cache.js';

const clock = () => { let time = 1_000_000; const now = () => time; now.advance = ms => { time += ms; }; return now; };

test('fresh data is served from memory until its TTL passes', async () => {
  const now = clock(); const cached = createCache({ now }); let calls = 0;
  const load = async () => ({ n: ++calls });
  assert.equal((await cached('a', load, 1000)).n, 1);
  now.advance(999);
  assert.equal((await cached('a', load, 1000)).n, 1);
  now.advance(2);
  assert.equal((await cached('a', load, 1000)).n, 2);
});

test('concurrent requests share one upstream call', async () => {
  const cached = createCache(); let calls = 0;
  const load = async () => { calls++; await new Promise(resolve => setTimeout(resolve, 10)); return { ok: true }; };
  await Promise.all([cached('a', load), cached('a', load), cached('a', load)]);
  assert.equal(calls, 1);
});

test('a failed refresh serves saved data marked stale and is not retried straight away', async () => {
  const now = clock(); const cached = createCache({ now, failureTtl: 15_000 }); let calls = 0;
  await cached('a', async () => ({ n: 1 }), 60_000);
  now.advance(61_000);
  const failing = async () => { calls++; throw new Error('NHL returned 503'); };
  const first = await cached('a', failing, 60_000);
  assert.equal(first.stale, true); assert.equal(first.n, 1);
  now.advance(5000);
  assert.equal((await cached('a', failing, 60_000)).stale, true);
  assert.equal(calls, 1, 'second request inside the failure window must not reach NHL');
  now.advance(11_000);
  await cached('a', failing, 60_000);
  assert.equal(calls, 2, 'upstream is retried once the failure window ends');
});

test('with nothing saved, a failure is shown and then remembered briefly', async () => {
  const now = clock(); const cached = createCache({ now, failureTtl: 15_000 }); let calls = 0;
  const failing = async () => { calls++; throw new Error('NHL returned 503'); };
  await assert.rejects(cached('a', failing), /503/);
  await assert.rejects(cached('a', failing), /503/);
  assert.equal(calls, 1);
  now.advance(16_000);
  assert.deepEqual(await cached('a', async () => ({ ok: true })), { ok: true, stale: false, fetchedAt: new Date(now()).toISOString() });
});

test('a short TTL is never outlived by the failure window', async () => {
  const now = clock(); const cached = createCache({ now, failureTtl: 15_000 }); let calls = 0;
  const failing = async () => { calls++; throw new Error('down'); };
  await assert.rejects(cached('scores', failing, 5000));
  now.advance(6000);
  await assert.rejects(cached('scores', failing, 5000));
  assert.equal(calls, 2);
});

test('entries are capped and the least recently read key is dropped first', async () => {
  const cached = createCache({ maxEntries: 3 }); let calls = 0;
  const load = async () => ({ n: ++calls });
  await cached('a', load); await cached('b', load); await cached('c', load);
  await cached('a', load); // reading a makes b the oldest
  await cached('d', load);
  const before = calls;
  await cached('a', load); await cached('c', load); await cached('d', load);
  assert.equal(calls, before, 'a, c and d are still cached');
  await cached('b', load);
  assert.equal(calls, before + 1, 'b was dropped and is fetched again');
});

test('request-driven keys cannot grow the cache or the failure list past the cap', async () => {
  const cached = createCache({ maxEntries: 50 }); let loads = 0;
  for (let i = 0; i < 500; i++) {
    await cached(`ok-${i}`, async () => { loads++; return { i }; });
    await cached(`bad-${i}`, async () => { loads++; throw new Error('no'); }).catch(() => {});
  }
  assert.equal(loads, 1000);
  await cached('ok-0', async () => { loads++; return { i: 0 }; });
  assert.equal(loads, 1001, 'early keys were evicted rather than kept forever');
});

test('edge caching lets the CDN reuse a response briefly and makes browsers revalidate', async () => {
  const { edgeCache } = await import('./cache.js');
  assert.equal(edgeCache(15), 'public, max-age=0, s-maxage=15');
  assert.equal(edgeCache(300), 'public, max-age=0, s-maxage=300');
});
