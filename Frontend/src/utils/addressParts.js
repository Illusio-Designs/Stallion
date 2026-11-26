// An address shown as separate parts (address line, city, state, pincode, country) instead of one
// long text. The server sends the parts; older data falls back to the single text.
const ROWS = [['line', 'Address'], ['city', 'City'], ['state', 'State'], ['pincode', 'Pincode'], ['country', 'Country']];

// [[label, value], ...] with the empty ones left out
export const addressRows = (parts, fallbackText = '') => {
  const rows = parts ? ROWS.map(([key, label]) => [label, String(parts[key] || '').trim()]).filter(([, v]) => v) : [];
  if (rows.length) return rows;
  return fallbackText ? [['Address', String(fallbackText)]] : [];
};
