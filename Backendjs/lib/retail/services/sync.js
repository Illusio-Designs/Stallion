// Copies / refreshes frames from the Stallion (wholesale) `product` table into `retail_products`.
// - Matches on source_product_id. New frames start hidden (show_on_store=false) with stock 0.
// - Existing frames only get the catalogue facts refreshed (names, size, images); everything the store owns
//   (show_on_store, stock, slug, SEO, title/description edits, mrp) is left alone.
// - The wholesale price (whp) and wholesale stock columns are never selected, so they cannot leak.
const { Op } = require('sequelize');
const RetailProduct = require('../models/RetailProduct');
const { HttpError } = require('./httpCatalog');
const { slugify, productImageUrl } = require('./catalog');

const BATCH = 500;
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;
let running = false;

// image_urls has been stored as an array, a bare string or a double-encoded JSON string. Reduce it to bare file names
// (same rules as the wholesale productController) and build absolute URLs.
function imagesOf(value) {
    let arr = [];
    if (Array.isArray(value)) arr = value;
    else if (typeof value === 'string' && value.trim() && value.trim() !== '[]') {
        let s = value.trim();
        for (let i = 0; i < 3; i += 1) {
            try {
                const parsed = JSON.parse(s);
                if (Array.isArray(parsed)) { arr = parsed; break; }
                if (typeof parsed === 'string') { s = parsed; continue; }
                break;
            } catch (_e) { break; }
        }
        if (!arr.length) arr = [s];
    }
    const seen = new Set();
    const out = [];
    arr.forEach((item) => {
        if (typeof item !== 'string') return;
        const filename = item.split('?')[0].split('#')[0].trim().split('/').pop().split('\\').pop();
        if (!filename || !IMAGE_EXT_RE.test(filename) || seen.has(filename)) return;
        seen.add(filename);
        out.push(productImageUrl(filename));
    });
    return out;
}

const str = (v, max) => {
    const s = v === null || v === undefined ? '' : String(v).trim();
    return s ? s.slice(0, max) : null;
};

async function syncFromStallion({ refreshMrp = false } = {}) {
    if (running) throw new HttpError(409, 'A sync is already running. Please wait for it to finish.');
    running = true;
    try {
        // Required here (not at the top) so the retail module does not pull in the wholesale models until it needs them.
        const Product = require('../../models/Product');
        const Gender = require('../../models/Gender');
        const ColorCode = require('../../models/ColorCode');
        const Shape = require('../../models/Shape');
        const LensColor = require('../../models/LensColor');
        const FrameColor = require('../../models/FrameColor');
        const FrameType = require('../../models/FrameType');
        const LensMaterial = require('../../models/LensMaterial');
        const FrameMaterial = require('../../models/FrameMaterial');
        const Brand = require('../../models/Brand');

        const existing = await RetailProduct.findAll({ attributes: { exclude: ['description'] } });
        const bySource = new Map();
        const slugs = new Set();
        existing.forEach((r) => {
            slugs.add(String(r.slug).toLowerCase());
            if (r.source_product_id) bySource.set(r.source_product_id, r);
        });

        const takeSlug = (modelNo, colorName) => {
            const base = slugify(modelNo);
            const candidates = [base, colorName ? `${base}-${slugify(colorName, 40)}` : null].filter(Boolean);
            for (const c of candidates) if (!slugs.has(c)) { slugs.add(c); return c; }
            for (let n = 2; n < 1000; n += 1) {
                const c = `${candidates[candidates.length - 1]}-${n}`;
                if (!slugs.has(c)) { slugs.add(c); return c; }
            }
            const c = `${base}-${Date.now().toString(36)}`;
            slugs.add(c);
            return c;
        };

        const result = { created: 0, updated: 0, skipped: 0, failed: 0 };
        const seenIds = [];
        const now = new Date();

        for (let offset = 0; ; offset += BATCH) {
            // eslint-disable-next-line no-await-in-loop
            const batch = await Product.findAll({
                attributes: ['product_id', 'model_no', 'mrp', 'size_mm', 'image_urls', 'is_active'], // deliberately no whp / quantities
                include: [
                    { model: Gender, as: 'gender', attributes: ['gender_name'] },
                    { model: ColorCode, as: 'color_code', attributes: ['color_code'] },
                    { model: Shape, as: 'shape', attributes: ['shape_name'] },
                    { model: LensColor, as: 'lens_color', attributes: ['lens_color'] },
                    { model: FrameColor, as: 'frame_color', attributes: ['frame_color'] },
                    { model: FrameType, as: 'frame_type', attributes: ['frame_type'] },
                    { model: LensMaterial, as: 'lens_material', attributes: ['lens_material'] },
                    { model: FrameMaterial, as: 'frame_material', attributes: ['frame_material'] },
                    { model: Brand, as: 'brand', attributes: ['brand_name'] },
                ],
                order: [['created_at', 'ASC'], ['product_id', 'ASC']],
                limit: BATCH,
                offset,
            });
            if (!batch.length) break;

            for (const src of batch) {
                try {
                    const modelNo = str(src.model_no, 255);
                    if (!modelNo) { result.skipped += 1; continue; }
                    seenIds.push(src.product_id);

                    const color = str((src.frame_color && src.frame_color.frame_color) || (src.color_code && src.color_code.color_code), 80);
                    const facts = {
                        model_no: modelNo,
                        brand_name: str(src.brand && src.brand.brand_name, 120),
                        shape: str(src.shape && src.shape.shape_name, 80),
                        frame_type: str(src.frame_type && src.frame_type.frame_type, 80),
                        frame_material: str(src.frame_material && src.frame_material.frame_material, 80),
                        lens_color: str(src.lens_color && src.lens_color.lens_color, 80),
                        lens_material: str(src.lens_material && src.lens_material.lens_material, 80),
                        gender: str(src.gender && src.gender.gender_name, 40),
                        color,
                        size_mm: str(src.size_mm, 40),
                        images: imagesOf(src.image_urls),
                    };
                    const mrp = Math.max(0, Number(src.mrp) || 0);
                    const current = bySource.get(src.product_id);

                    if (!current) {
                        // eslint-disable-next-line no-await-in-loop
                        const created = await RetailProduct.create({
                            ...facts,
                            source_product_id: src.product_id,
                            slug: takeSlug(modelNo, color),
                            title: [facts.brand_name, modelNo].filter(Boolean).join(' '),
                            mrp,
                            stock: 0,
                            show_on_store: false,
                            is_active: src.is_active !== false,
                            synced_at: now,
                        });
                        bySource.set(src.product_id, created);
                        result.created += 1;
                        continue;
                    }

                    const patch = {};
                    Object.keys(facts).forEach((k) => {
                        const a = k === 'images' ? JSON.stringify(facts[k]) : facts[k];
                        const cur = k === 'images' ? JSON.stringify(Array.isArray(current.images) ? current.images : []) : current[k];
                        if ((a === null ? null : a) !== (cur === undefined ? null : cur)) patch[k] = facts[k];
                    });
                    if ((refreshMrp || !(Number(current.mrp) > 0)) && mrp !== Number(current.mrp)) patch.mrp = mrp;
                    if (src.is_active === false && current.is_active) patch.is_active = false; // wholesale switch-off hides it; never turns it back on
                    if (!current.title) patch.title = [facts.brand_name, modelNo].filter(Boolean).join(' ');

                    if (Object.keys(patch).length) {
                        // eslint-disable-next-line no-await-in-loop
                        await current.update({ ...patch, synced_at: now });
                        result.updated += 1;
                    } else {
                        result.skipped += 1;
                    }
                } catch (err) {
                    result.failed += 1;
                    console.error('[retail] sync row failed:', src.product_id, err.message);
                }
            }
            if (batch.length < BATCH) break;
        }

        // Stamp untouched rows so "last synced" is meaningful; silent keeps updated_at (and sitemaps) unchanged.
        for (let i = 0; i < seenIds.length; i += BATCH) {
            // eslint-disable-next-line no-await-in-loop
            await RetailProduct.update({ synced_at: now }, { where: { source_product_id: { [Op.in]: seenIds.slice(i, i + BATCH) }, synced_at: { [Op.or]: [null, { [Op.lt]: now }] } }, silent: true });
        }
        return result;
    } finally {
        running = false;
    }
}

module.exports = { syncFromStallion, imagesOf };
