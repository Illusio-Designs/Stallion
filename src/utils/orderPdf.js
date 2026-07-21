// Shared branded order-PDF generator.
//
// Used by the admin Orders page AND the Distributor Orders page so both download
// an identical invoice — including the Subtotal / offer discount / Total block.
// Pass the table `row` (it carries `originalOrder`) and the page's already-loaded
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
  // Discount-aware totals: gross subtotal, offer discount, final payable.
  const pdfDiscount = Number(order?.discount_total) || 0;
  const pdfSubtotal = order?.subtotal != null ? Number(order.subtotal) : grandTotal;
  const pdfFinal = order?.order_total != null ? Number(order.order_total) : (pdfSubtotal - pdfDiscount);

  const rawDate = order?.order_date || order?.created_at;
  const orderDate = rawDate ? new Date(rawDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');

  // Embed a tiny DejaVu subset so the ₹ symbol renders (jsPDF's built-in
  // Helvetica has no ₹ glyph). We use it ONLY for money strings; everything else
  // stays Helvetica. `RUPEE` = the registered font name.
  const RUPEE = 'DejaVuRupee';
  doc.addFileToVFS('DejaVuRupee.ttf', RUPEE_FONT_BASE64);
  doc.addFont('DejaVuRupee.ttf', RUPEE, 'normal');
  // Draw a money string in the rupee font, then restore Helvetica so the rest of
  // the document is unaffected (font size + colour persist across setFont).
  const drawMoney = (str, x, yy, align) => {
    doc.setFont(RUPEE, 'normal');
    doc.text(str, x, yy, align ? { align } : undefined);
    doc.setFont('helvetica', 'normal');
  };
  const PW = 210;
  const M = 14;
  const INK = [26, 27, 35];
  const MUTE = [107, 111, 125];
  const BRAND = [24, 18, 101];
  const LIGHT = [244, 245, 247];

  // ---- Header band ----
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PW, 32, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('STALLION EYEWEAR LLP', M, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text('Your Vision. Our Passion.', M, 21);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('ORDER', PW - M, 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${row?.orderId || ''}`, PW - M, 20, { align: 'right' });

  // ---- Meta grid ----
  let y = 44;
  const metaL = [['Order ID', row?.orderId], ['Party Name', row?.client], ['Order Type', row?.orderType]];
  const metaR = [['Order Date', orderDate], ['Status', row?.status], ['Total', money(pdfFinal), true]];
  const drawMeta = (pairs, lx) => {
    let yy = y;
    pairs.forEach(([label, value, isMoney]) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...MUTE);
      doc.text(String(label).toUpperCase(), lx, yy);
      doc.setFontSize(10.5);
      doc.setTextColor(...INK);
      if (isMoney) {
        drawMoney(String(value || '-'), lx, yy + 5);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.text(String(value || '-'), lx, yy + 5);
      }
      yy += 13;
    });
  };
  drawMeta(metaL, M);
  drawMeta(metaR, 112);
  y += metaL.length * 13 + 2;

  // ---- Shipping address ----
  if (row?.clientAddress) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTE);
    doc.text('SHIPPING ADDRESS', M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const addrLines = doc.splitTextToSize(String(row.clientAddress), PW - M * 2);
    doc.text(addrLines, M, y + 5);
    y += 5 + addrLines.length * 5 + 4;
  }

  // ---- Billing address (only when it differs from shipping) ----
  if (row?.clientBillingAddress && row.clientBillingAddress !== row.clientAddress) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...MUTE);
    doc.text('BILLING ADDRESS', M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    const billLines = doc.splitTextToSize(String(row.clientBillingAddress), PW - M * 2);
    doc.text(billLines, M, y + 5);
    y += 5 + billLines.length * 5 + 4;
  }

  // ---- Items table ----
  const colNum = M + 2;
  const colProd = M + 12;
  const colQty = 138;
  const colPrice = 168;
  const colAmt = PW - M;
  const tableW = PW - M * 2;

  doc.setFillColor(...BRAND);
  doc.rect(M, y, tableW, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('#', colNum, y + 6);
  doc.text('PRODUCT', colProd, y + 6);
  doc.text('QTY', colQty, y + 6, { align: 'right' });
  doc.text('PRICE', colPrice, y + 6, { align: 'right' });
  doc.text('AMOUNT', colAmt, y + 6, { align: 'right' });
  y += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const rowH = 9;
  if (items.length === 0) {
    doc.setTextColor(...MUTE);
    doc.text('No items', colProd, y + 6);
    y += rowH;
  } else {
    items.forEach((it, i) => {
      if (y > 262) { doc.addPage(); y = 20; }
      if (i % 2 === 1) { doc.setFillColor(...LIGHT); doc.rect(M, y, tableW, rowH, 'F'); }
      doc.setTextColor(...INK);
      doc.text(String(i + 1), colNum, y + 6);
      doc.text(doc.splitTextToSize(it.name, 96)[0], colProd, y + 6);
      doc.text(String(it.qty), colQty, y + 6, { align: 'right' });
      drawMoney(money(it.price), colPrice, y + 6, 'right');
      drawMoney(money(it.subtotal), colAmt, y + 6, 'right');
      y += rowH;
    });
  }

  // table border
  doc.setDrawColor(223, 225, 231);
  doc.line(M, y, PW - M, y);

  // ---- Totals ----
  y += 8;
  const boxX = 120;
  // Subtotal + discount lines above the TOTAL box (only when an offer applied).
  if (pdfDiscount > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTE);
    doc.text('Subtotal', boxX + 4, y + 4);
    doc.setTextColor(...INK);
    drawMoney(money(pdfSubtotal), PW - M - 4, y + 4, 'right');
    doc.setTextColor(...MUTE);
    const offerLabel = (order?.applied_offer && order.applied_offer.title) ? String(order.applied_offer.title) : 'Discount';
    doc.text(doc.splitTextToSize(offerLabel, 70)[0], boxX + 4, y + 10);
    doc.setTextColor(...INK);
    drawMoney(`- ${money(pdfDiscount)}`, PW - M - 4, y + 10, 'right');
    y += 12;
  }
  doc.setFillColor(...LIGHT);
  doc.rect(boxX, y, PW - M - boxX, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...BRAND);
  doc.text('TOTAL', boxX + 4, y + 9);
  drawMoney(money(pdfFinal), PW - M - 4, y + 9, 'right');

  // ---- Notes ----
  if (order?.order_notes) {
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...MUTE);
    doc.text('NOTES', M, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(String(order.order_notes), tableW), M, y + 6);
  }

  // ---- Footer band ----
  doc.setFillColor(...BRAND);
  doc.rect(0, 287, PW, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Thank you for your business  •  Stallion Eyewear LLP', M, 293);
  doc.text(`Generated ${new Date().toLocaleDateString('en-GB')}`, PW - M, 293, { align: 'right' });

  doc.save(`Order-${row?.orderId || 'details'}.pdf`);
}
