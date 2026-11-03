import test from 'node:test';
import assert from 'node:assert/strict';
import { feedStart, feedRefresh, feedLoaded, feedFailed } from './feed.js';

const url = '/api/trades';
const data = { trades: [1, 2, 3] };

test('the first load shows the loader and no data', () => {
  assert.deepEqual(feedStart(url), { url, data: null, loading: true, error: '' });
  assert.equal(feedStart(null).loading, false);
  assert.deepEqual(feedRefresh(feedStart(url), url), { url, data: null, loading: true, error: '' });
});

test('a background refresh keeps the data on screen and does not show the loader', () => {
  const next = feedRefresh(feedLoaded(url, data), url);
  assert.equal(next.data, data);
  assert.equal(next.loading, false);
  assert.equal(next.error, '');
});

test('a failed refresh keeps the data and records the error', () => {
  const next = feedFailed(feedLoaded(url, data), url, 'Could not reach NHL data.');
  assert.equal(next.data, data);
  assert.equal(next.loading, false);
  assert.equal(next.error, 'Could not reach NHL data.');
});

test('a retry after a failed refresh keeps both the data and the notice until it succeeds', () => {
  const failed = feedFailed(feedLoaded(url, data), url, 'Could not reach NHL data.');
  const retrying = feedRefresh(failed, url);
  assert.equal(retrying.data, data);
  assert.equal(retrying.error, 'Could not reach NHL data.');
  assert.equal(retrying.loading, false);
  assert.equal(feedLoaded(url, { trades: [] }).error, '');
});

test('a failure with nothing loaded leaves no data, so the panel can show the error and a retry', () => {
  const next = feedFailed(feedStart(url), url, 'Could not reach NHL data.');
  assert.equal(next.data, null);
  assert.equal(next.error, 'Could not reach NHL data.');
  assert.equal(next.loading, false);
  assert.equal(feedRefresh(next, url).loading, true, 'retrying with no data shows the loader again');
});

test('data from another URL is never shown for the new one', () => {
  const loaded = feedLoaded('/api/standings', data);
  assert.equal(feedRefresh(loaded, url).data, null);
  assert.equal(feedRefresh(loaded, url).loading, true);
  assert.equal(feedFailed(loaded, url, 'x').data, null);
});
