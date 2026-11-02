import { describe, it, expect, beforeEach, vi } from 'vitest';
import { shareRequest, invalidateShared, mapLimit } from './requestShare';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('shareRequest', () => {
  beforeEach(() => { invalidateShared(); vi.useRealTimers(); });

  it('runs one request for callers that ask at the same time', async () => {
    const d = deferred();
    const fetcher = vi.fn(() => d.promise);
    const a = shareRequest('k', fetcher, 0);
    const b = shareRequest('k', fetcher, 0);
    d.resolve([1, 2]);
    expect(await a).toEqual([1, 2]);
    expect(await b).toEqual([1, 2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('starts a new request once the first one is done and nothing is kept (ttl 0)', async () => {
    const fetcher = vi.fn(async () => ['x']);
    await shareRequest('k', fetcher, 0);
    await shareRequest('k', fetcher, 0);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps the answer for the ttl and then asks again', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => ['x']);
    await shareRequest('k', fetcher, 1000);
    await shareRequest('k', fetcher, 1000);
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1001);
    await shareRequest('k', fetcher, 1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not keep an empty answer', async () => {
    const fetcher = vi.fn(async () => []);
    await shareRequest('k', fetcher, 1000);
    await shareRequest('k', fetcher, 1000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('gives every caller its own copy of an array', async () => {
    const fetcher = vi.fn(async () => [1, 2, 3]);
    const first = await shareRequest('k', fetcher, 1000);
    first.push(99);
    first.sort((x, y) => y - x);
    const second = await shareRequest('k', fetcher, 1000);
    expect(second).toEqual([1, 2, 3]);
  });

  it('shares a failure with everyone who was waiting, and does not keep it', async () => {
    const d = deferred();
    const fetcher = vi.fn(() => d.promise);
    const a = shareRequest('k', fetcher, 1000);
    const b = shareRequest('k', fetcher, 1000);
    d.reject(new Error('boom'));
    await expect(a).rejects.toThrow('boom');
    await expect(b).rejects.toThrow('boom');
    const again = vi.fn(async () => ['ok']);
    expect(await shareRequest('k', again, 1000)).toEqual(['ok']);
  });

  it('a fetcher that throws synchronously becomes a rejected promise', async () => {
    await expect(shareRequest('k', () => { throw new Error('sync'); }, 0)).rejects.toThrow('sync');
  });

  it('invalidate drops kept answers', async () => {
    const fetcher = vi.fn(async () => ['x']);
    await shareRequest('k', fetcher, 60000);
    invalidateShared();
    await shareRequest('k', fetcher, 60000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('invalidate only drops keys with the prefix', async () => {
    const a = vi.fn(async () => ['a']);
    const b = vi.fn(async () => ['b']);
    await shareRequest('parties:1', a, 60000);
    await shareRequest('trays', b, 60000);
    invalidateShared('parties:');
    await shareRequest('parties:1', a, 60000);
    await shareRequest('trays', b, 60000);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('an answer that was on its way when a write happened is not kept', async () => {
    const d = deferred();
    const fetcher = vi.fn(() => d.promise);
    const first = shareRequest('k', fetcher, 60000);
    invalidateShared(); // a write finished while the read was running
    d.resolve(['old']);
    expect(await first).toEqual(['old']);
    const fresh = vi.fn(async () => ['new']);
    expect(await shareRequest('k', fresh, 60000)).toEqual(['new']);
  });

  it('a caller after an invalidation does not join the older running request', async () => {
    const d = deferred();
    const old = vi.fn(() => d.promise);
    const first = shareRequest('k', old, 0);
    invalidateShared();
    const fresh = vi.fn(async () => ['new']);
    expect(await shareRequest('k', fresh, 0)).toEqual(['new']);
    d.resolve(['old']);
    await first;
    expect(fresh).toHaveBeenCalledTimes(1);
  });
});

describe('mapLimit', () => {
  it('keeps the order of the items', async () => {
    const out = await mapLimit([30, 10, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms * 2;
    });
    expect(out).toEqual([60, 20, 40]);
  });

  it('never runs more than the limit at once', async () => {
    let active = 0;
    let peak = 0;
    await mapLimit(Array.from({ length: 12 }, (_, i) => i), 4, async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
    });
    expect(peak).toBe(4);
  });

  it('returns an empty list for no items', async () => {
    expect(await mapLimit([], 6, async () => 1)).toEqual([]);
  });

  it('rejects with the first error and stops starting new calls', async () => {
    const calls = [];
    await expect(mapLimit([1, 2, 3, 4, 5, 6], 1, async (n) => {
      calls.push(n);
      if (n === 2) throw new Error('fail');
      return n;
    })).rejects.toThrow('fail');
    expect(calls).toEqual([1, 2]);
  });
});
