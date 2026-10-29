'use client';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { getUser, getUserRoles } from '../services/authService';
import { getRetailAccess } from '../services/api/retailApi';
import { accessFromRoles, parseAccess, readSavedSide, resolveSide, writeSavedSide } from '../utils/retailSide';

/**
 * Which sides (Wholesale / Retail) the signed-in person may open.
 *
 * On app load the roles give an immediate answer; GET /api/retail/access then confirms it (the server is
 * the source of truth). If the server cannot be reached the answer from the roles stays. One shared store,
 * so the header, menu, bottom bar and the route guard always agree.
 */
const FIRST = { ready: false, access: { wholesale: true, retail: false }, saved: null, userKey: null, confirmed: false };
let snap = FIRST;
const listeners = new Set();
let inflight = null;
let wired = false;

const emit = (next) => { snap = next; listeners.forEach((l) => l()); };
const keyOf = (u) => (u ? String(u.user_id ?? u.id ?? u.email ?? 'user') : null);

const refresh = () => {
  if (typeof window === 'undefined') return;
  const user = getUser();
  const userKey = keyOf(user);
  if (!user) {
    if (!snap.ready || snap.userKey !== null) emit({ ...FIRST, ready: true, saved: readSavedSide() });
    return;
  }
  // The same person is already known: nothing to do.
  if (snap.ready && snap.userKey === userKey) return;
  emit({ ready: true, access: accessFromRoles(getUserRoles()), saved: readSavedSide(), userKey, confirmed: false });
  if (inflight === userKey) return;
  inflight = userKey;
  getRetailAccess()
    .then((res) => {
      const parsed = parseAccess(res);
      if (parsed && snap.userKey === userKey) emit({ ...snap, access: parsed, confirmed: true });
    })
    .catch(() => { /* keep the answer from the roles */ })
    .finally(() => { if (inflight === userKey) inflight = null; });
};

const wire = () => {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  // Login, logout and an expired session all fire authChange: ask again for whoever is signed in now.
  window.addEventListener('authChange', () => { snap = { ...FIRST, saved: readSavedSide() }; inflight = null; refresh(); });
};

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const getSnapshot = () => snap;
const getServerSnapshot = () => FIRST;

/**
 * @param {string} [currentPage] page key on screen. A retail page means the Retail side, a wholesale page the Wholesale side.
 * @returns {{ready:boolean, access:{wholesale:boolean,retail:boolean}, hasBoth:boolean, side:'wholesale'|'retail', rememberSide:(s:string)=>void}}
 */
export function useRetailAccess(currentPage) {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => { wire(); refresh(); }, []);
  const rememberSide = useCallback((side) => {
    writeSavedSide(side);
    emit({ ...snap, saved: side });
  }, []);
  const side = resolveSide(s.access, currentPage, s.saved);
  const hasBoth = s.access.wholesale && s.access.retail;
  return { ready: s.ready, access: s.access, hasBoth, side, saved: s.saved, rememberSide };
}

/** Current answer outside React (event handlers): { ready, access, saved }. */
export const getRetailSnapshot = () => snap;

export default useRetailAccess;
