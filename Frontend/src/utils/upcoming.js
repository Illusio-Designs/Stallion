// Upcoming (pre-order) products keep no stock: customers can order any quantity.
// The server decides (products.is_upcoming); these helpers only read the flag.

// The most pieces one line may hold (matches the server's sanity limit).
export const MAX_ORDER_QTY = 100000;

// True for is_upcoming = true / 1 / "1" / "true" (the API may send a boolean or a 0/1 number).
export const isUpcoming = (item) => {
  const v = item && item.is_upcoming;
  return v === true || v === 1 || v === '1' || v === 'true';
};

// Highest quantity a stepper may reach: no stock cap for upcoming products, the stock for the rest.
// `stock` null / undefined means unknown, which is treated as no cap (as before).
export const maxQuantity = (item, stock) => {
  if (isUpcoming(item)) return MAX_ORDER_QTY;
  if (stock == null || Number.isNaN(Number(stock))) return MAX_ORDER_QTY;
  return Math.max(0, Math.min(Number(stock), MAX_ORDER_QTY));
};

// A quantity kept between 1 and the highest allowed. Normal products at 0 stock return 0.
export const clampQuantity = (qty, item, stock) => {
  const max = maxQuantity(item, stock);
  const n = Math.floor(Number(qty));
  if (max <= 0) return 0;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, max);
};
