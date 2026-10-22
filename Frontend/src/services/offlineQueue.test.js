import { describe, it, expect, beforeEach } from 'vitest';
import * as q from './offlineQueue';

const visit = (n) => ({ party_id: `p${n}`, check_in_date: '2026-10-22' });

describe('offline visit queue', () => {
  beforeEach(() => { localStorage.clear(); });

  it('keeps a visit with a client id and sends it once', async () => {
    const id = q.queueCheckin(visit(1));
    expect(q.getQueue()).toHaveLength(1);
    expect(q.getQueue()[0].payload.client_request_id).toBe(id);
    const sentBodies = [];
    const res = await q.flushQueue(async (p) => { sentBodies.push(p); });
    expect(res).toEqual({ sent: 1, failed: 0 });
    expect(q.getQueue()).toHaveLength(0);
    expect(sentBodies[0].client_request_id).toBe(id);
  });

  it('stops at the first connection failure and keeps the rest waiting', async () => {
    q.queueCheckin(visit(1));
    q.queueCheckin(visit(2));
    const res = await q.flushQueue(async () => { throw new TypeError('Failed to fetch'); });
    expect(res).toEqual({ sent: 0, failed: 0 });
    expect(q.getQueue().map((i) => i.status)).toEqual(['waiting', 'waiting']);
  });

  it('marks a refused visit as failed with the reason and carries on', async () => {
    q.queueCheckin(visit(1));
    q.queueCheckin(visit(2));
    let n = 0;
    const res = await q.flushQueue(async () => {
      n += 1;
      if (n === 1) { const e = new Error('Party location is not set'); e.statusCode = 403; throw e; }
    });
    expect(res).toEqual({ sent: 1, failed: 1 });
    const left = q.getQueue();
    expect(left).toHaveLength(1);
    expect(left[0].status).toBe('failed');
    expect(left[0].error).toBe('Party location is not set');
  });

  it('treats server faults as try-again-later', () => {
    const e500 = Object.assign(new Error('x'), { statusCode: 502 });
    const e400 = Object.assign(new Error('x'), { statusCode: 400 });
    expect(q.isNetworkError(e500)).toBe(true);
    expect(q.isNetworkError(e400)).toBe(false);
  });
});
