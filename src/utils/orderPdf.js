// Shared branded order-PDF generator (monochrome theme, boxed + tabular).
//
// Used by the admin Orders page AND the Distributor Orders page so both download
// an identical invoice — dark/white/grey to match the app, with boxed sections
// and a ruled items table that shows a PRODUCT IMAGE, title, qty and total.
// Pass the table `row` (it carries `originalOrder`) and the page's loaded
// `products` list for product name/image resolution.

import { getProductsByIds } from '../services/apiService';
import { RUPEE_FONT_BASE64 } from './rupeeFont';

const IMG_BASE = (process.env.NEXT_PUBLIC_IMAGE_BASE_URL || 'https://api.stallioneyewear.in').replace(/\/+$/, '');

const parseOrderItems = (orderItems) => {
  if (!orderItems) return [];
  if (Array.isArray(orderItems)) return orderItems;
  if (typeof orderItems === 'string') {
    try { const parsed = JSON.parse(orderItems); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  if (typeof orderItems === 'object') return Object.values(orderItems);
  return [];
};

// Build the public URL of a product's first image from its image_urls (which may
// be a JSON string, an array of bare filenames, or full paths).
const firstImageUrl = (imageUrls) => {
  let arr = imageUrls;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { arr = [arr]; } }
  if (!Array.isArray(arr) || arr.length === 0) return null;
  let f = String(arr[0] || '').replace(/^\/+/, '').replace(/([\]"\\])+$/, '');
  if (!f) return null;
  if (f.startsWith('http')) return f;
  const name = f.split('/').pop();
  return `${IMG_BASE}/uploads/products/${encodeURIComponent(name)}`;
};

// Load an image URL and return a JPEG data-URL (square, white-matted) suitable for
// jsPDF.addImage. Uses a canvas so webp is decoded and re-encoded to JPEG (jsPDF
// can't embed webp). Resolves null on any failure (CORS/network/format) so the
// PDF still generates without the thumbnail.
const loadThumb = (url) => new Promise((resolve) => {
  if (!url || typeof window === 'undefined' || typeof document === 'undefined') return resolve(null);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const S = 150;
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, S, S);
      const scale = Math.min(S / img.width, S / img.height) || 1;
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
      resolve(c.toDataURL('image/jpeg', 0.85));
    } catch { resolve(null); }
  };
  img.onerror = () => resolve(null);
  img.src = url;
});

/**
 * Generate and save a branded order PDF.
 * @param {object} row       table row: { orderId, client, orderType, status, value,
 *                            clientAddress?, clientBillingAddress?, originalOrder }
 * @param {Array}  products  optional loaded products for name/image resolution
 */
export async function downloadOrderPdf(row, products = []) {
  const order = row?.originalOrder || {};
  const orderItems = parseOrderItems(order?.order_items);
  const list = Array.isArray(products) ? products : [];

  // Product map (id -> product) from the passed list, filled in with a single
  // by-id fetch for any products not already loaded (for name + image_urls).
  const productMap = new Map(list.map((p) => [String(p.product_id || p.id), p]));
  const missing = [...new Set(
    orderItems.map((it) => String(it.product_id)).filter((id) => id && id !== 'undefined' && !productMap.has(id))
  )];
  if (missing.length > 0) {
    try {
      const fetched = await getProductsByIds(missing);
      fetched.forEach((p) => productMap.set(String(p.product_id ?? p.id), p));
    } catch { /* ignore */ }
  }

  const items = orderItems.map((it) => {
    const p = productMap.get(String(it.product_id)) || {};
    const qty = Number(it.quantity) || 0;
    const price = Number(it.price) || 0;
    const name = it.model_no || it.product?.model_no || it.product_name || it.product?.product_name
      || p.model_no || p.product_name || p.name || 'Unknown Product';
    const imgUrl = firstImageUrl(it.image_urls || p.image_urls);
    return { name: String(name), qty, price, subtotal: qty * price, imgUrl };
  });
  // Fetch all thumbnails in parallel (graceful — nulls are fine).
  const thumbs = await Promise.all(items.map((it) => loadThumb(it.imgUrl)));
  items.forEach((it, i) => { it.thumb = thumbs[i]; });

  const grandTotal = items.reduce((s, it) => s + it.subtotal, 0) ||
    parseFloat(String(row?.value || '').replace(/[^0-9.]/g, '')) || 0;
  const pdfDiscount = Number(order?.discount_total) || 0;
  const pdfSubtotal = order?.subtotal != null ? Number(order.subtotal) : grandTotal;
  const pdfFinal = order?.order_total != null ? Number(order.order_total) : (pdfSubtotal - pdfDiscount);

  const rawDate = order?.order_date || order?.created_at;
  const orderDate = rawDate ? new Date(rawDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');

  const PW = 210;
  const M = 14;
  const CW = PW - M * 2;
  const INK = [26, 27, 35];
  const MUTE = [110, 114, 128];
  const DARK = [22, 23, 29];
  const LIGHT = [246, 247, 249];
  const ZEBRA = [250, 250, 251];
  const BORDER = [221, 223, 229];

  const RUPEE = 'DejaVuRupee';
  doc.addFileToVFS('DejaVuRupee.ttf', RUPEE_FONT_BASE64);
  doc.addFont('DejaVuRupee.ttf', RUPEE, 'normal');
  const money$ = (str, x, yy, align) => {
    doc.setFont(RUPEE, 'normal');
    doc.text(str, x, yy, align ? { align } : undefined);
    doc.setFont('helvetica', 'normal');
  };
  const rect = (x, yy, w, h, { fill, border = true } = {}) => {
    if (fill) { doc.setFillColor(...fill); doc.rect(x, yy, w, h, 'F'); }
    if (border) { doc.setDrawColor(...BORDER); doc.setLineWidth(0.3); doc.rect(x, yy, w, h); }
  };
  const label = (text, x, yy) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...MUTE);
    doc.text(String(text).toUpperCase(), x, yy);
  };

  // ================= Header band =================
  doc.setFillColor(...DARK);
  doc.rect(0, 0, PW, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text('STALLION EYEWEAR LLP', M, 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(200, 201, 208);
  doc.text('Your Vision. Our Passion.', M, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('ORDER', PW - M, 13, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(200, 201, 208);
  doc.text(`${row?.orderId || ''}`, PW - M, 19, { align: 'right' });

  // ================= Meta box =================
  let y = 40;
  const metaRowH = 12;
  const metaH = metaRowH * 3 + 6;
  rect(M, y, CW, metaH, { fill: LIGHT });
  const colGap = CW / 2;
  const meta = [
    ['Order ID', row?.orderId, 'Order Date', orderDate],
    ['Party Name', row?.client, 'Status', row?.status],
    ['Order Type', row?.orderType, 'Total', money(pdfFinal), true],
  ];
  let my = y + 7;
  meta.forEach(([l1, v1, l2, v2, isMoney]) => {
    label(l1, M + 4, my);
    label(l2, M + 4 + colGap, my);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...INK);
    doc.text(String(v1 || '-'), M + 4, my + 5);
    if (isMoney) { doc.setFontSize(10.5); money$(String(v2 || '-'), M + 4 + colGap, my + 5); }
    else { doc.text(String(v2 || '-'), M + 4 + colGap, my + 5); }
    my += metaRowH;
  });
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.line(M + colGap, y + 3, M + colGap, y + metaH - 3);
  y += metaH + 6;

  // ================= Address box =================
  const addr = row?.clientAddress ? String(row.clientAddress) : '';
  const billing = (row?.clientBillingAddress && row.clientBillingAddress !== row.clientAddress) ? String(row.clientBillingAddress) : '';
  if (addr || billing) {
    doc.setFontSize(9.5);
    const shipLines = addr ? doc.splitTextToSize(addr, CW - 8) : [];
    const billLines = billing ? doc.splitTextToSize(billing, CW - 8) : [];
    const lh = 4.6;
    const aH = 6 + (addr ? 5 + shipLines.length * lh : 0) + (billing ? 5 + billLines.length * lh + 2 : 0);
    rect(M, y, CW, aH);
    let ay = y + 6;
    if (addr) {
      label('Shipping Address', M + 4, ay);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
      doc.text(shipLines, M + 4, ay + 5); ay += 5 + shipLines.length * lh;
    }
    if (billing) {
      ay += 2; label('Billing Address', M + 4, ay);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
      doc.text(billLines, M + 4, ay + 5);
    }
    y += aH + 6;
  }

  // ================= Items table (image · title · qty · total) =================
  const totalW = 32, qtyW = 18, imgColW = 16;
  const totalR = PW - M, totalL = totalR - totalW;
  const qtyR = totalL, qtyL = qtyR - qtyW;
  const imgL = M, prodL = M + imgColW, prodR = qtyL;
  const pad = 3;
  const headH = 9, rowH = 15, thumb = 11;

  const drawTableHead = () => {
    doc.setFillColor(...DARK); doc.rect(M, y, CW, headH, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('PRODUCT', imgL + pad, y + 6);
    doc.text('QTY', qtyR - pad, y + 6, { align: 'right' });
    doc.text('TOTAL', totalR - pad, y + 6, { align: 'right' });
    y += headH;
  };

  let tableTop = y;
  drawTableHead();

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  if (items.length === 0) {
    doc.setTextColor(...MUTE); doc.text('No items', prodL + pad, y + 6); y += rowH;
  } else {
    items.forEach((it, i) => {
      if (y + rowH > 268) {
        doc.setDrawColor(...BORDER); doc.setLineWidth(0.3); doc.rect(M, tableTop, CW, y - tableTop);
        [imgColW + M, qtyL, totalL].forEach((cx) => doc.line(cx, tableTop + headH, cx, y));
        doc.addPage(); y = 20; tableTop = y; drawTableHead();
      }
      if (i % 2 === 1) { doc.setFillColor(...ZEBRA); doc.rect(M, y, CW, rowH, 'F'); }
      // thumbnail (or a light placeholder box)
      const ix = imgL + (imgColW - thumb) / 2, iy = y + (rowH - thumb) / 2;
      if (it.thumb) {
        try { doc.addImage(it.thumb, 'JPEG', ix, iy, thumb, thumb); } catch { /* skip */ }
      } else {
        doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
        doc.rect(ix, iy, thumb, thumb, 'FD');
      }
      // title (up to 2 lines), vertically centred
      doc.setTextColor(...INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      const nameLines = doc.splitTextToSize(it.name, (prodR - prodL) - pad * 2).slice(0, 2);
      const nameY = y + rowH / 2 - (nameLines.length - 1) * 2 + 1;
      doc.text(nameLines, prodL + pad, nameY);
      // qty + total, vertically centred
      const midY = y + rowH / 2 + 1.5;
      doc.text(String(it.qty), qtyR - pad, midY, { align: 'right' });
      money$(money(it.subtotal), totalR - pad, midY, 'right');
      // row separator
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.2); doc.line(M, y + rowH, PW - M, y + rowH);
      y += rowH;
    });
  }
  // outer border + column separators
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.rect(M, tableTop, CW, y - tableTop);
  [M + imgColW, qtyL, totalL].forEach((cx) => doc.line(cx, tableTop + headH, cx, y));

  // ================= Totals box (right) =================
  y += 6;
  const tW = 78, tX = PW - M - tW;
  const totH = (pdfDiscount > 0 ? 2 : 0) * 7 + 13;
  rect(tX, y, tW, totH, { fill: LIGHT });
  let ty = y + 6;
  if (pdfDiscount > 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...MUTE);
    doc.text('Subtotal', tX + 4, ty);
    doc.setTextColor(...INK); money$(money(pdfSubtotal), PW - M - 4, ty, 'right');
    ty += 7;
    doc.setTextColor(...MUTE);
    const offerLabel = (order?.applied_offer && order.applied_offer.title) ? String(order.applied_offer.title) : 'Discount';
    doc.text(doc.splitTextToSize(offerLabel, 44)[0], tX + 4, ty);
    doc.setTextColor(...INK); money$(`- ${money(pdfDiscount)}`, PW - M - 4, ty, 'right');
    ty += 5;
  }
  doc.setFillColor(...DARK); doc.rect(tX, ty, tW, 11, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text('TOTAL', tX + 4, ty + 7.5);
  money$(money(pdfFinal), PW - M - 4, ty + 7.5, 'right');
  y = ty + 11 + 6;

  // ================= Notes box =================
  if (order?.order_notes) {
    doc.setFontSize(9.5);
    const noteLines = doc.splitTextToSize(String(order.order_notes), CW - 8);
    const nH = 6 + 5 + noteLines.length * 4.6;
    rect(M, y, CW, nH);
    label('Notes', M + 4, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
    doc.text(noteLines, M + 4, y + 11);
  }

  // ================= Footer band =================
  doc.setFillColor(...DARK);
  doc.rect(0, 287, PW, 10, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text('Thank you for your business  •  Stallion Eyewear LLP', M, 293);
  doc.setTextColor(200, 201, 208);
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, PW - M, 293, { align: 'right' });

  doc.save(`Order-${row?.orderId || 'details'}.pdf`);
}
