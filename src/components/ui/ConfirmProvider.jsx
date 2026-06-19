'use client';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

const ConfirmContext = createContext(null);

/**
 * Provides a promise-based confirm() so call sites can replace window.confirm
 * with a near-identical await:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm('Delete this?'))) return;
 *   // or: await confirm({ title, message, confirmLabel: 'Delete', danger: true })
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, opts: {} });
  const resolver = useRef(null);

  const confirm = useCallback((optsOrMessage) => {
    const opts = typeof optsOrMessage === 'string'
      ? { message: optsOrMessage }
      : (optsOrMessage || {});
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({ open: true, opts });
    });
  }, []);

  const settle = useCallback((result) => {
    setState((s) => ({ ...s, open: false }));
    const resolve = resolver.current;
    resolver.current = null;
    resolve?.(result);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        title={state.opts.title}
        message={state.opts.message}
        confirmLabel={state.opts.confirmLabel}
        cancelLabel={state.opts.cancelLabel}
        danger={state.opts.danger}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  );
}

/**
 * Returns confirm(optsOrMessage) -> Promise<boolean>. Falls back to native
 * window.confirm if used outside a ConfirmProvider (keeps call sites safe).
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (ctx) return ctx;
  return (optsOrMessage) => Promise.resolve(
    typeof window !== 'undefined'
      ? window.confirm(typeof optsOrMessage === 'string' ? optsOrMessage : (optsOrMessage?.message || 'Are you sure?'))
      : true
  );
}

export default ConfirmProvider;
