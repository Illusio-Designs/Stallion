// Small formatting helpers for the Retail screens: rupees, Indian time (IST), slugs, SEO length hints.

/** 12500 -> "₹12,500". Blank for a missing number. */
export const rupees = (v) => {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

/** A count with Indian digit grouping; "—" when the server did not send it. */
export const count = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('en-IN'));

const IST = 'Asia/Kolkata';

/** "29 Oct, 4:10 pm" in India time, whatever the phone's time zone. */
export const istDateTime = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(d);
  const g = (t) => (parts.find((p) => p.type === t) || {}).value || '';
  return `${g('day')} ${g('month')}, ${g('hour')}:${g('minute')} ${g('dayPeriod').toLowerCase()}`;
};

/** "29 Oct 2026" in India time. */
export const istDate = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' }).format(d);
};

/** "Out for delivery" from "out_for_delivery". */
export const sentence = (s) => {
  const t = String(s || '').replace(/[_-]+/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
};

/** A readable address: "frame-title-here" from "Frame title here!". */
export const slugify = (s) => String(s || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 120);

export const TITLE_RANGE = [30, 60];
export const DESC_RANGE = [70, 155];

/** Length check for a search title or description. */
export const lengthHint = (text, [min, max]) => {
  const n = String(text || '').trim().length;
  if (n === 0) return { n, tone: 'bad', label: 'Missing' };
  if (n < min) return { n, tone: 'mute', label: 'Too short' };
  if (n > max) return { n, tone: 'bad', label: 'Too long' };
  return { n, tone: 'ok', label: 'Good' };
};

/** Worst of the title and description checks, for the table's Status column. */
export const seoStatus = (title, description) => {
  const t = lengthHint(title, TITLE_RANGE);
  const d = lengthHint(description, DESC_RANGE);
  const rank = { ok: 0, mute: 1, bad: 2 };
  return rank[t.tone] >= rank[d.tone] ? (t.tone === 'ok' ? t : { ...t, label: `Title: ${t.label.toLowerCase()}` }) : { ...d, label: `Description: ${d.label.toLowerCase()}` };
};

/** Public host used in the Google-style preview. */
export const STORE_HOST = process.env.NEXT_PUBLIC_RETAIL_HOST || 'stallioneyewear.in';

/** "stallioneyewear.in › shop › frame" from a path. */
export const crumbUrl = (path) => {
  const segs = String(path || '/').split('/').filter(Boolean);
  return [STORE_HOST, ...segs].join(' › ');
};

/** Funnel step names as people say them. */
const STEP_LABELS = {
  visit: 'Visited the store',
  visits: 'Visited the store',
  view_item: 'Opened a product',
  product_view: 'Opened a product',
  add_to_cart: 'Added to cart',
  begin_checkout: 'Started checkout',
  purchase: 'Placed an order',
  order: 'Placed an order',
  orders: 'Placed an order',
};
export const stepLabel = (step) => STEP_LABELS[String(step || '').toLowerCase()] || sentence(step);

const firstDefined = (...vals) => vals.find((v) => v !== undefined && v !== null);
const num = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * GET /orders/summary -> { counts by status, revenue today and 30 days }. The contract does not fix the
 * field names, so the usual spellings are all read; anything missing stays null (shown as a dash).
 */
export const normalizeOrderSummary = (raw) => {
  const s = raw && typeof raw === 'object' ? raw : {};
  let counts = firstDefined(s.counts, s.by_status, s.status_counts, s.statuses, {});
  if (Array.isArray(counts)) counts = Object.fromEntries(counts.map((c) => [String(c.status), Number(c.count) || 0]));
  const rev = s.revenue && typeof s.revenue === 'object' ? s.revenue : {};
  const today = s.today && typeof s.today === 'object' ? s.today : {};
  return {
    counts: counts || {},
    ordersToday: num(firstDefined(s.orders_today, s.today_orders, today.orders, today.count)),
    revenueToday: num(firstDefined(s.revenue_today, s.today_revenue, today.revenue, rev.today)),
    revenue30: num(firstDefined(s.revenue_30_days, s.revenue_30d, s.revenue_last_30_days, s.revenue_30, rev.last_30_days, rev['30d'], rev.last30, rev.days_30)),
    total: num(firstDefined(s.total, s.total_orders)),
  };
};

/** One order from the list or the detail answer, read with the usual field spellings. */
export const normalizeOrder = (o) => {
  const r = o && typeof o === 'object' ? o : {};
  const rawItems = firstDefined(r.items, r.order_items, []);
  const rawTimeline = firstDefined(r.timeline, r.events, r.history, []);
  // The detail answer nests the address and the shipment; the list answer is flat. Read both.
  const a = r.address && typeof r.address === 'object' ? r.address : {};
  const sh = r.shipment && typeof r.shipment === 'object' ? r.shipment : {};
  const addr = [firstDefined(a.line1, r.address_line1), firstDefined(a.line2, r.address_line2), firstDefined(a.city, r.city), firstDefined(a.state, r.state), firstDefined(a.pincode, r.pincode)].filter(Boolean);
  return {
    ...r,
    courier: firstDefined(r.courier, sh.courier, null),
    awb: firstDefined(r.awb, sh.awb, null),
    tracking_url: firstDefined(r.tracking_url, sh.tracking_url, null),
    city: firstDefined(r.city, a.city, ''),
    allowed_next: Array.isArray(r.allowed_next) ? r.allowed_next : null,
    id: r.id,
    order_number: firstDefined(r.order_number, r.number, r.id),
    customer_name: firstDefined(r.customer_name, r.customer?.name, r.name, ''),
    customer_phone: firstDefined(r.customer_phone, r.customer?.phone, r.phone, ''),
    customer_email: firstDefined(r.customer_email, r.customer?.email, r.email, ''),
    status: String(firstDefined(r.status, 'pending')).toLowerCase(),
    total: num(r.total),
    address_text: addr.join(', '),
    items: (Array.isArray(rawItems) ? rawItems : []).map((i) => {
      const qty = num(firstDefined(i.quantity, i.qty)) || 0;
      const price = num(firstDefined(i.price, i.unit_price, i.mrp));
      return {
        key: firstDefined(i.id, i.product_id, i.model_no, i.title),
        title: firstDefined(i.title, i.product_title, i.model_no, i.name, 'Frame'),
        model_no: i.model_no || '',
        image: firstDefined(i.image, i.image_url, ''),
        quantity: qty,
        price,
        line_total: firstDefined(num(i.line_total), price !== null ? price * qty : null),
      };
    }),
    timeline: (Array.isArray(rawTimeline) ? rawTimeline : []).map((t, idx) => ({
      key: firstDefined(t.id, idx),
      status: String(firstDefined(t.status, t.to_status, '')).toLowerCase(),
      note: firstDefined(t.note, t.message, ''),
      at: firstDefined(t.at, t.created_at, t.createdAt, ''),
    })),
  };
};

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' };
const decode = (t) => String(t).replace(/&(?:amp|lt|gt|quot|#39|#x27|nbsp);/g, (m) => ENTITIES[m]);
const escapeHtml = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The server keeps a frame description as sanitised HTML. The frame form edits it as plain text:
 * paragraphs become blank-line separated blocks, <br> a new line, entities are decoded.
 */
export const descriptionToText = (html) => decode(String(html || '')
  .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, ''))
  .trim();

/** Plain text from the frame form -> the HTML the server stores (escaped, paragraphs and line breaks kept). */
export const textToDescription = (text) => {
  const t = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!t) return '';
  return t.split(/\n{2,}/).map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`).join('');
};
