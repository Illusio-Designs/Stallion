import { describe, it, expect, vi } from 'vitest';
import { showToast, attachToastSink, setToasterLoader } from './toastQueue';

describe('toastQueue', () => {
  it('holds notifications until the toaster is attached, then shows them in order', () => {
    showToast('error', 'first', { duration: 1 });
    showToast('success', 'second', { duration: 2 });
    const sink = vi.fn();
    const detach = attachToastSink(sink);
    expect(sink.mock.calls).toEqual([
      ['error', 'first', { duration: 1 }],
      ['success', 'second', { duration: 2 }],
    ]);
    detach();
  });

  it('passes notifications straight through once attached', () => {
    const sink = vi.fn();
    const detach = attachToastSink(sink);
    showToast('info', 'now', {});
    expect(sink).toHaveBeenCalledWith('info', 'now', {});
    detach();
  });

  it('after detaching, notifications wait again and are not lost', () => {
    const first = vi.fn();
    const detach = attachToastSink(first);
    detach();
    showToast('warning', 'later', {});
    expect(first).not.toHaveBeenCalled();
    const second = vi.fn();
    const detach2 = attachToastSink(second);
    expect(second).toHaveBeenCalledWith('warning', 'later', {});
    detach2();
  });

  it('an old detach never removes a newer toaster', () => {
    const a = vi.fn();
    const detachA = attachToastSink(a);
    const b = vi.fn();
    const detachB = attachToastSink(b);
    detachA();
    showToast('info', 'to b', {});
    expect(b).toHaveBeenCalledWith('info', 'to b', {});
    detachB();
  });
});

describe('toastQueue loader', () => {
  it('asks for the toaster to be loaded when a notification has to wait', () => {
    const load = vi.fn();
    setToasterLoader(load);
    showToast('error', 'needs a toaster', {});
    expect(load).toHaveBeenCalledTimes(1);
    const sink = vi.fn();
    const detach = attachToastSink(sink);
    expect(sink).toHaveBeenCalledWith('error', 'needs a toaster', {});
    showToast('info', 'already there', {});
    expect(load).toHaveBeenCalledTimes(1); // nothing to load once it is mounted
    detach();
    setToasterLoader(null);
  });
});
