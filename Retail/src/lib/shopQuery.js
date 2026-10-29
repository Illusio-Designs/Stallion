// Helpers for the URL-driven shop: every filter lives in the query string so pages are linkable and crawlable.
export const FACETS = ['shape', 'frame_type', 'frame_material', 'gender', 'color'];
export const SORTS = [['popular', 'Popular'], ['new', 'Newest'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low']];

const clean = (v) => (Array.isArray(v) ? v[0] : v) || '';

// Reads Next's searchParams into a small, safe object (unknown keys are dropped).
export function pickParams(sp = {}) {
  const out = {};
  const text = ['search', ...FACETS];
  text.forEach((k) => { const v = String(clean(sp[k])).trim().slice(0, 80); if (v) out[k] = v; });
  ['min_price', 'max_price'].forEach((k) => { const v = Math.floor(Number(clean(sp[k]))); if (v > 0) out[k] = String(v); });
  const sort = clean(sp.sort);
  if (SORTS.some(([k]) => k === sort) && sort !== 'popular') out.sort = sort;
  const page = Math.floor(Number(clean(sp.page)));
  if (page > 1) out.page = String(page);
  return out;
}

// Builds "/shop?..." from params with changes applied (a null value removes the key). Changing anything but the page resets paging.
export function shopHref(params, changes = {}) {
  const next = { ...params };
  const keys = Object.keys(changes);
  if (keys.some((k) => k !== 'page')) delete next.page;
  keys.forEach((k) => { if (changes[k] == null || changes[k] === '') delete next[k]; else next[k] = String(changes[k]); });
  const q = new URLSearchParams(next).toString();
  return q ? `/shop?${q}` : '/shop';
}

// The API returns facet options with counts; accept strings or { name | value | label, count }.
export function options(list) {
  return (Array.isArray(list) ? list : [])
    .map((x) => (typeof x === 'string' ? { value: x, count: null } : { value: x.name ?? x.value ?? x.label, count: x.count ?? null }))
    .filter((x) => x.value);
}
