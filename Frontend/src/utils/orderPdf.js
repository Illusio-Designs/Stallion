// Shared branded order-PDF generator (monochrome theme, boxed + tabular).
//
// Used by the admin Orders page AND the Distributor Orders page so both download
// an identical invoice — dark/white/grey to match the app, with boxed sections
// and a ruled items table. Includes the Subtotal / offer discount / Total block.
// Pass the table `row` (it carries `originalOrder`) and the page's loaded
// `products` list for product-name resolution.

import { getProductsByIds } from '../services/apiService';
import { RUPEE_FONT_BASE64 } from './rupeeFont';

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

/**
 * Generate and save a branded order PDF.
 * @param {object} row       table row: { orderId, client, orderType, status, value,
 *                            clientAddress?, clientBillingAddress?, originalOrder }
 * @param {Array}  products  optional loaded products for name resolution
 */
export async function downloadOrderPdf(row, products = []) {
  const order = row?.originalOrder || {};
  const orderItems = parseOrderItems(order?.order_items);
  const list = Array.isArray(products) ? products : [];

  // Resolve product names: embedded -> loaded products -> by-id lookup.
  const nameFrom = (it, lookup) =>
    it.model_no || it.product?.model_no || it.product_name || it.product?.product_name ||
    lookup[String(it.product_id)] ||
    list.find(p => String(p.product_id || p.id) === String(it.product_id))?.model_no ||
    list.find(p => String(p.product_id || p.id) === String(it.product_id))?.product_name || null;

  const unresolved = [...new Set(orderItems.filter(it => !nameFrom(it, {})).map(it => String(it.product_id)).filter(Boolean))];
  const lookup = {};
  if (unresolved.length > 0) {
    try {
      const fetched = await getProductsByIds(unresolved);
      fetched.forEach((p) => { lookup[String(p.product_id ?? p.id)] = p.model_no || p.product_name || p.name; });
    } catch { /* ignore */ }
  }

  const items = orderItems.map((it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.price) || 0;
    return { name: String(nameFrom(it, lookup) || 'Unknown Product'), qty, price, subtotal: qty * price };
  });
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
  const CW = PW - M * 2;               // content width
  // ---- Monochrome palette (matches the app theme) ----
  const INK = [26, 27, 35];            // primary text
  const MUTE = [110, 114, 128];        // labels / secondary
  const DARK = [22, 23, 29];           // header / footer / table head + total band
  const LIGHT = [246, 247, 249];       // subtle section fill
  const ZEBRA = [250, 250, 251];       // alternate table row
  const BORDER = [221, 223, 229];      // hairline borders

  // Embed the ₹ glyph (jsPDF Helvetica lacks it); used only for money strings.
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
    if (isMoney) {
      doc.setFontSize(10.5);
      money$(String(v2 || '-'), M + 4 + colGap, my + 5);
    } else {
      doc.text(String(v2 || '-'), M + 4 + colGap, my + 5);
    }
    my += metaRowH;
  });
  // vertical divider between the two meta columns
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
    const lineH = 4.6;
    const aH = 6 + (addr ? 5 + shipLines.length * lineH : 0) + (billing ? 5 + billLines.length * lineH + 2 : 0);
    rect(M, y, CW, aH);
    let ay = y + 6;
    if (addr) {
      label('Shipping Address', M + 4, ay);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
      doc.text(shipLines, M + 4, ay + 5);
      ay += 5 + shipLines.length * lineH;
    }
    if (billing) {
      ay += 2;
      label('Billing Address', M + 4, ay);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...INK);
      doc.text(billLines, M + 4, ay + 5);
    }
    y += aH + 6;
  }

  // ================= Items table =================
  // Column geometry (right-aligned numeric columns).
  const amtW = 30, priceW = 30, qtyW = 18, numW = 9;
  const amtR = PW - M, amtL = amtR - amtW;
  const priceR = amtL, priceL = priceR - priceW;
  const qtyR = priceL, qtyL = qtyR - qtyW;
  const prodL = M + numW;
  const pad = 2.5;
  const headH = 9, rowH = 8.5;

  const tableTop = y;
  // header
  doc.setFillColor(...DARK); doc.rect(M, y, CW, headH, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
  doc.text('#', M + pad, y + 6);
  doc.text('PRODUCT', prodL + pad, y + 6);
  doc.text('QTY', qtyR - pad, y + 6, { align: 'right' });
  doc.text('PRICE', priceR - pad, y + 6, { align: 'right' });
  doc.text('AMOUNT', amtR - pad, y + 6, { align: 'right' });
  y += headH;

  // body rows
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  if (items.length === 0) {
    doc.setTextColor(...MUTE); doc.text('No items', prodL + pad, y + 6); y += rowH;
  } else {
    items.forEach((it, i) => {
      if (y > 250) {
        // simple page break: close the table border and start a new page
        doc.setDrawColor(...BORDER); doc.setLineWidth(0.3); doc.rect(M, tableTop, CW, y - tableTop);
        doc.addPage(); y = 20;
      }
      if (i % 2 === 1) { doc.setFillColor(...ZEBRA); doc.rect(M, y, CW, rowH, 'F'); }
      doc.setTextColor(...INK);
      doc.text(String(i + 1), M + pad, y + 5.8);
      doc.text(doc.splitTextToSize(it.name, (qtyL - prodL) - pad * 2)[0], prodL + pad, y + 5.8);
      doc.text(String(it.qty), qtyR - pad, y + 5.8, { align: 'right' });
      money$(money(it.price), priceR - pad, y + 5.8, 'right');
      money$(money(it.subtotal), amtR - pad, y + 5.8, 'right');
      // row separator
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.2);
      doc.line(M, y + rowH, PW - M, y + rowH);
      y += rowH;
    });
  }
  // outer table border + column separators
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.rect(M, tableTop, CW, y - tableTop);
  [qtyL, priceL, amtL].forEach((cx) => doc.line(cx, tableTop + headH, cx, y));

  // ================= Totals box (right) =================
  y += 6;
  const tW = 78, tX = PW - M - tW;
  const totRows = pdfDiscount > 0 ? 2 : 0;
  const totH = totRows * 7 + 13;
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
  // TOTAL band
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
