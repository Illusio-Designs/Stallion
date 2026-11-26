// Download rows as a CSV file. columns: [{ label, value: (row) => any }].
const escapeCell = (v) => {
  let s = v == null ? '' : String(v);
  // Neutralise spreadsheet formulas in text coming from user data.
  if (/^[=@]/.test(s) || /^[+-](?![0-9\s.])/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const buildCsv = (columns, rows) => {
  const head = columns.map((c) => escapeCell(c.label)).join(',');
  const body = (rows || []).map((r) => columns.map((c) => escapeCell(c.value(r))).join(','));
  return [head, ...body].join('\r\n');
};

export const downloadCsv = (filename, columns, rows) => {
  if (typeof document === 'undefined') return;
  const csv = `﻿${buildCsv(columns, rows)}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
