const Product = require('../models/Product');
const { logAudit } = require('../utils/auditLogger');
const Brand = require('../models/Brand');
const Collection = require('../models/Collection');
const ColorCode = require('../models/ColorCode');
const Shape = require('../models/Shape');
const LensColor = require('../models/LensColor');
const FrameColor = require('../models/FrameColor');
const FrameType = require('../models/FrameType');
const LensMaterial = require('../models/LensMaterial');
const FrameMaterial = require('../models/FrameMaterial');
const Gender = require('../models/Gender');
const { PRODUCT_IMAGE_UPLOAD_DIR } = require('../constants/multer');
const path = require('path');
const fs = require('fs');
const { Op, Sequelize } = require('sequelize');
const { canManageInventory } = require('../utils/roleHelpers');
const { getListSearchParams } = require('../utils/listSearchHelpers');

const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp)$/i;

// Reduce any historically-messy image_urls value to a clean array of BARE
// FILENAMES. image_urls has been stored as: a real array, an empty array, a
// double-encoded JSON string ("[]" / "[\"...\"]"), stray chars ("[", "]") from
// spreading that string, absolute disk paths, and relative paths — sometimes
// all mixed in one row. We:
//   1. coerce the value into an array (parsing double-encoded strings),
//   2. take only the FILE NAME of each entry (drops the path),
//   3. drop anything that isn't an image file (kills "[", "]", "[]"),
//   4. de-dupe.
// The frontend rebuilds the URL as <IMAGE_BASE>/uploads/products/<filename>.
function normalizeImageUrls(value) {
    let arr = [];
    if (Array.isArray(value)) {
        arr = value;
    } else if (typeof value === 'string') {
        let s = value.trim();
        if (s && s !== '[]') {
            for (let i = 0; i < 3; i++) {
                try {
                    const parsed = JSON.parse(s);
                    if (Array.isArray(parsed)) { arr = parsed; break; }
                    if (typeof parsed === 'string') { s = parsed; continue; }
                    break;
                } catch (_) { break; }
            }
            if (arr.length === 0) arr = [s]; // a single plain path/filename
        }
    }

    const seen = new Set();
    const out = [];
    for (const item of arr) {
        if (typeof item !== 'string') continue;
        const clean = item.split('?')[0].split('#')[0].trim();
        if (!clean) continue;
        // last segment whether the separator is / (URL/posix) or \\ (windows)
        const filename = clean.split('/').pop().split('\\').pop();
        if (!filename || !IMAGE_EXT_RE.test(filename)) continue; // drop "[", "]", non-images
        if (seen.has(filename)) continue;
        seen.add(filename);
        out.push(filename);
    }
    return out;
}

// We store only the bare file name in image_urls now (the URL is assembled on
// the client). Kept as a helper so the intent is explicit at call sites.
function productImagePath(filename) {
    return filename;
}

// How a clean filename array is persisted into the image_urls column:
//   0 files  -> []                       (empty)
//   1 file   -> "filename.png"           (a bare string, as requested)
//   2+ files -> ["a.png", "b.png"]       (array, to keep them all)
function toStoredImageUrls(filenames) {
    const arr = normalizeImageUrls(filenames);
    if (arr.length === 0) return [];
    if (arr.length === 1) return arr[0];
    return arr;
}

const productIncludes = [
    { model: Gender, as: 'gender' },
    { model: ColorCode, as: 'color_code' },
    { model: Shape, as: 'shape' },
    { model: LensColor, as: 'lens_color' },
    { model: FrameColor, as: 'frame_color' },
    { model: FrameType, as: 'frame_type' },
    { model: LensMaterial, as: 'lens_material' },
    { model: FrameMaterial, as: 'frame_material' },
    { model: Brand, as: 'brand' },
    { model: Collection, as: 'collection' },
];

class ProductController {
    async getFeaturedProducts(req, res) {
        try {
            const { collection_id } = req.body;
            if (!collection_id || collection_id === '' || collection_id === 'all') {
                const products = await Product.findAll({ limit: 6 });
                return res.status(200).json(products);
            }
            const products = await Product.findAll({ where: { collection_id: collection_id }, limit: 6 });
            res.status(200).json(products);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getProducts(req, res) {
        try {
            const { page, limit, search: searchQuery } = req.query;
            if (!page || !limit) {
                return res.status(400).json({ error: 'Page and limit are required' });
            }
            if (isNaN(page) || isNaN(limit)) {
                return res.status(400).json({ error: 'Page and limit must be numbers' });
            }
            const pageNum = parseInt(page, 10);
            const limitNum = parseInt(limit, 10);
            const { price, collection_id, brand_id, color_code_id, shape_id, lens_color_id, frame_color_id, frame_type_id, lens_material_id, frame_material_id, gender_id, search: searchBody } = req.body;
            const { name: nameQuery } = getListSearchParams(req);
            const search = (searchQuery || searchBody || nameQuery || '').trim();
            const conditions = [];

            if (collection_id) {
                conditions.push({ collection_id });
            }
            if (brand_id) {
                conditions.push({ brand_id });
            }
            if (color_code_id) {
                conditions.push({ color_code_id });
            }
            if (shape_id) {
                conditions.push({ shape_id });
            }
            if (lens_color_id) {
                conditions.push({ lens_color_id });
            }
            if (frame_color_id) {
                conditions.push({ frame_color_id });
            }
            if (frame_type_id) {
                conditions.push({ frame_type_id });
            }
            if (lens_material_id) {
                conditions.push({ lens_material_id });
            }
            if (frame_material_id) {
                conditions.push({ frame_material_id });
            }
            if (gender_id) {
                conditions.push({ gender_id });
            }
            if (price) {
                conditions.push({
                    mrp: {
                        [Op.gte]: price.min,
                        [Op.lte]: price.max
                    }
                });
            }
            if (search) {
                const searchTerm = `%${search}%`;
                conditions.push({
                    [Op.or]: [
                        { model_no: { [Op.like]: searchTerm } },
                        { size_mm: { [Op.like]: searchTerm } },
                        { status: { [Op.like]: searchTerm } },
                    ]
                });
            }
            const where = conditions.length > 0 ? { [Op.and]: conditions } : {};
            const { count, rows: products } = await Product.findAndCountAll({
                where,
                include: productIncludes,
                limit: limitNum,
                offset: (pageNum - 1) * limitNum,
                distinct: true,
            });
            res.status(200).json({
                data: products,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total: count,
                    totalPages: Math.ceil(count / limitNum) || 0,
                }
            });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: error.message });
        }
    }
    async createProduct(req, res) {
        try {
            const user = req.user;
            const { model_no, gender_id, color_code_id, shape_id, lens_color_id,
                frame_color_id, frame_type_id, lens_material_id, frame_material_id,
                mrp, whp, size_mm, warehouse_qty, status, brand_id, collection_id, image_urls } = req.body;
            if (!model_no || !gender_id || !color_code_id || !shape_id || !lens_color_id
                || !frame_color_id || !frame_type_id || !lens_material_id || !frame_material_id
                || !mrp || !whp || !size_mm || !warehouse_qty
                || !status || !brand_id || !collection_id) {
                return res.status(400).json({ error: 'All fields are required' });
            }
            const brand = await Brand.findOne({ where: { brand_id: brand_id } });
            if (!brand) {
                return res.status(404).json({ error: 'Brand not found' });
            }
            const collection = await Collection.findOne({ where: { collection_id: collection_id } });
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            const existingProduct = await Product.findOne({ where: { model_no: model_no, color_code_id: color_code_id } });
            if (existingProduct) {
                return res.status(400).json({ error: 'Product already exists' });
            }
            const product = await Product.create({
                model_no,
                gender_id,
                color_code_id,
                shape_id,
                lens_color_id,
                frame_color_id,
                frame_type_id,
                lens_material_id,
                frame_material_id,
                image_urls,
                mrp,
                whp,
                size_mm,
                warehouse_qty,
                tray_qty: 0,
                total_qty: warehouse_qty,
                status,
                brand_id,
                collection_id,
                created_at: new Date(),
                updated_at: new Date(),
            });
            await logAudit({
                req,
                action: 'create',
                description: 'Product created',
                tableName: 'product',
                recordId: product.product_id,
                oldValues: null,
                newValues: product,
            });
            res.status(200).json(product);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: error.message });
        }
    }
    async updateProduct(req, res) {
        try {
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Product ID is required' });
            }
            const user = req.user;
            const { model_no, gender_id, color_code_id, shape_id, lens_color_id, frame_color_id,
                frame_type_id, lens_material_id, frame_material_id, mrp, whp, size_mm,
                warehouse_qty, tray_qty, total_qty, status, brand_id, collection_id, image_urls } = req.body;
            const product = await Product.findByPk(id);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }
            const brand = await Brand.findOne({ where: { brand_id: brand_id } });
            if (!brand) {
                return res.status(404).json({ error: 'Brand not found' });
            }
            const collection = await Collection.findOne({ where: { collection_id: collection_id } });
            if (!collection) {
                return res.status(404).json({ error: 'Collection not found' });
            }
            const oldSnapshot = product.toJSON();
            const updatePayload = {
                model_no: model_no !== undefined ? model_no : product.model_no,
                gender_id: gender_id !== undefined ? gender_id : product.gender_id,
                color_code_id: color_code_id !== undefined ? color_code_id : product.color_code_id,
                shape_id: shape_id !== undefined ? shape_id : product.shape_id,
                lens_color_id: lens_color_id !== undefined ? lens_color_id : product.lens_color_id,
                frame_color_id: frame_color_id !== undefined ? frame_color_id : product.frame_color_id,
                frame_type_id: frame_type_id !== undefined ? frame_type_id : product.frame_type_id,
                lens_material_id: lens_material_id !== undefined ? lens_material_id : product.lens_material_id,
                frame_material_id: frame_material_id !== undefined ? frame_material_id : product.frame_material_id,
                image_urls: image_urls !== undefined ? image_urls : product.image_urls,
                mrp: mrp !== undefined ? mrp : product.mrp,
                whp: whp !== undefined ? whp : product.whp,
                size_mm: size_mm !== undefined ? size_mm : product.size_mm,
                status: status !== undefined ? status : product.status,
                brand_id: brand_id !== undefined ? brand_id : product.brand_id,
                collection_id: collection_id !== undefined ? collection_id : product.collection_id,
                updated_at: new Date(),
            };

            if (canManageInventory(req.userRoleName)) {
                if (warehouse_qty !== undefined) updatePayload.warehouse_qty = warehouse_qty;
                if (tray_qty !== undefined) updatePayload.tray_qty = tray_qty;
                if (total_qty !== undefined) updatePayload.total_qty = total_qty;
            } else if (warehouse_qty !== undefined || tray_qty !== undefined || total_qty !== undefined) {
                return res.status(403).json({ error: 'Only admin or tray manager can update inventory quantities' });
            }

            await Product.update(updatePayload, { where: { product_id: id } });

            await logAudit({
                req,
                action: 'update',
                description: 'Product updated',
                tableName: 'product',
                recordId: id,
                oldValues: oldSnapshot,
                newValues: { ...oldSnapshot, ...updatePayload },
            });
            res.status(200).json({ message: 'Product updated successfully' });
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: error.message });
        }
    }
    async deleteProduct(req, res) {
        try {
            const user = req.user;
            const id = req.params.id;
            if (!id) {
                return res.status(400).json({ error: 'Product ID is required' });
            }
            const product = await Product.findOne({ where: { product_id: id } });
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }
            const snapshot = product.toJSON();
            await product.destroy();
            await logAudit({
                req,
                action: 'delete',
                description: 'Product deleted',
                tableName: 'product',
                recordId: id,
                oldValues: snapshot,
                newValues: null,
            });
            res.status(200).json({ message: 'Product deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async deleteProductImage(req, res) {
        try {
            const file_name = req.params.file_name;
            if (!file_name) {
                return res.status(400).json({ error: 'Product image File name is required' });
            }
            const uploadsPath = path.join(__dirname, '..', '..', 'uploads', PRODUCT_IMAGE_UPLOAD_DIR, file_name);
            if (!fs.existsSync(uploadsPath)) {
                return res.status(404).json({ error: 'Product image not found' });
            }
            const withPath = `uploads/${PRODUCT_IMAGE_UPLOAD_DIR}/${file_name}`;
            // image_urls now stores bare filenames; older rows may still hold the
            // path. Match either so the "assigned" guard works for both.
            const product = await Product.findOne({
                where: {
                    [Op.or]: [
                        Sequelize.where(
                            Sequelize.fn('JSON_CONTAINS', Sequelize.col('image_urls'), JSON.stringify(file_name)),
                            1
                        ),
                        Sequelize.where(
                            Sequelize.fn('JSON_CONTAINS', Sequelize.col('image_urls'), JSON.stringify(withPath)),
                            1
                        ),
                        { image_urls: { [Op.like]: `%${file_name}%` } },
                    ],
                },
            });
            if (product) {
                return res.status(409).json({ message: 'Product image assigned to product.' });
                // console.log("product found", product.product_id);
                // const rawUrls = product.image_urls;
                // console.log("rawUrls", rawUrls);
                // let image_urls = [];
                // if (Array.isArray(rawUrls)) {
                //     image_urls = rawUrls;
                // } else if (typeof rawUrls === 'string') {
                //     try {
                //         const parsed = JSON.parse(rawUrls);
                //         image_urls = Array.isArray(parsed) ? parsed : [];
                //     } catch (_) {
                //         image_urls = [];
                //     }
                // }
                // console.log("image_urls", image_urls);
                // const normalize = (p) => (typeof p === 'string' ? p.replace(/^\/+/, '') : '');
                // const target1 = normalize(withPath);
                // const target2 = normalize(`/${withPath}`);
                // console.log("target1", target1);
                // console.log("target2", target2);
                // const filtered = image_urls.filter((url) => {
                //     const u = normalize(url);
                //     return !(u === target1 || u === target2 || u.endsWith(`/${file_name}`));
                // });
                // console.log("filtered", filtered);
                // await Product.update({ image_urls: filtered }, { where: { product_id: product.product_id } });
            }
            fs.unlinkSync(uploadsPath);
            res.status(200).json({ message: 'Product image deleted successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async uploadProductImage(req, res) {
        try {
            const fileInfos = req.fileInfos;
            const { product_id } = req.body;

            if (!fileInfos || fileInfos.length === 0) {
                return res.status(400).json({ error: 'Image not found' });
            }

            // No product_id => auto-map each image to a product by matching the
            // uploaded file name to model_no (e.g. "RB2140.jpg" -> model_no
            // "RB2140"). The multer middleware keeps the upload's original name as
            // originalName. Two-pass match: exact base name first, then a variant
            // with a short trailing "-n"/"_n"/"(n)" suffix stripped (so RB2140-1,
            // RB2140_2 all map to RB2140) without chopping digits that belong to
            // the model_no. A model_no on several products attaches to ALL of them.
            if (!product_id) {
                const stripVariantSuffix = (name) =>
                    String(name || '').replace(/(?:[\s._-]\d{1,2}|\s*\(\d{1,2}\))$/, '').trim();
                const baseOf = (originalName) => {
                    const ext = path.extname(originalName || '');
                    return path.basename(originalName || '', ext).trim();
                };

                const items = fileInfos.map((f) => {
                    const exact = baseOf(f.originalName || f.filename);
                    return { file: f, exact, stripped: stripVariantSuffix(exact) };
                });

                const candidateKeys = [...new Set(
                    items.flatMap((i) => [i.exact, i.stripped]).filter(Boolean).map((k) => k.toLowerCase())
                )];

                let products = [];
                if (candidateKeys.length > 0) {
                    products = await Product.findAll({
                        where: Sequelize.where(
                            Sequelize.fn('LOWER', Sequelize.col('model_no')),
                            { [Op.in]: candidateKeys }
                        ),
                    });
                }

                const byModel = new Map(); // lower(model_no) -> [products]
                for (const p of products) {
                    const k = String(p.model_no || '').toLowerCase();
                    if (!byModel.has(k)) byModel.set(k, []);
                    byModel.get(k).push(p);
                }

                const appendsByProduct = new Map(); // product_id -> { product, paths }
                const attached = [];
                const unmatched = [];

                for (const { file, exact, stripped } of items) {
                    const matches = byModel.get(exact.toLowerCase())
                        || byModel.get(stripped.toLowerCase())
                        || [];
                    if (matches.length === 0) {
                        unmatched.push(file.originalName || file.filename);
                        continue;
                    }
                    const targetIds = [];
                    for (const product of matches) {
                        if (!appendsByProduct.has(product.product_id)) {
                            appendsByProduct.set(product.product_id, { product, paths: [] });
                        }
                        appendsByProduct.get(product.product_id).paths.push(productImagePath(file.filename));
                        targetIds.push(product.product_id);
                    }
                    attached.push({
                        file: file.originalName || file.filename,
                        model_no: matches[0].model_no,
                        product_ids: targetIds,
                    });
                }

                for (const { product, paths } of appendsByProduct.values()) {
                    const existing = normalizeImageUrls(product.image_urls);
                    const oldImageUrls = [...existing];
                    const image_urls = [...new Set([...existing, ...paths])];
                    const status = product.status === 'draft' ? 'active' : product.status;
                    await Product.update(
                        { image_urls: toStoredImageUrls(image_urls), status, updated_at: new Date() },
                        { where: { product_id: product.product_id } }
                    );
                    await logAudit({
                        req,
                        action: 'update',
                        description: 'Product image auto-mapped by model number',
                        tableName: 'product',
                        recordId: product.product_id,
                        oldValues: { image_urls: oldImageUrls },
                        newValues: { image_urls },
                    });
                }

                return res.status(200).json({
                    message: 'Product images auto-mapped by model number',
                    data: fileInfos,
                    attached,
                    unmatched,
                    summary: {
                        attached: attached.length,
                        unmatched: unmatched.length,
                        productsUpdated: appendsByProduct.size,
                    },
                });
            }

            // Find the product
            const product = await Product.findOne({ where: { product_id: product_id } });
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // Get existing image_urls as a clean array (handles double-encoded "[]").
            let image_urls = normalizeImageUrls(product.image_urls);
            const oldImageUrls = [...image_urls];

            // Add all uploaded image paths (stored as portable relative paths).
            for (const fileInfo of fileInfos) {
                const rel = productImagePath(fileInfo.filename);
                if (!image_urls.includes(rel)) image_urls.push(rel);
            }

            let status = product.status;
            if (status === 'draft') {
                status = 'active';
            }

            // Update product with new image_urls
            await Product.update(
                { image_urls: toStoredImageUrls(image_urls), status: status, updated_at: new Date() },
                { where: { product_id: product_id } }
            );

            // Create audit log
            await logAudit({
                req,
                action: 'update',
                description: 'Product image saved',
                tableName: 'product',
                recordId: product.product_id,
                oldValues: { image_urls: oldImageUrls },
                newValues: { image_urls: image_urls },
            });

            // Fetch updated product
            const updatedProduct = await Product.findOne({ where: { product_id: product_id } });
            return res.status(200).json({
                message: 'Product image saved successfully',
                data: fileInfos,
                product: updatedProduct
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    // One-time / on-demand re-link: scan the uploads/products folder and attach
    // each file to the product(s) whose model_no matches the file's ORIGINAL name
    // (the stored name is "<original>-<13-digit timestamp><ext>"). Writes the
    // path into the product's image_urls. Idempotent — re-running won't duplicate.
    async relinkImagesToProducts(req, res) {
        try {
            const uploadsPath = path.join(__dirname, '..', '..', 'uploads', PRODUCT_IMAGE_UPLOAD_DIR);
            if (!fs.existsSync(uploadsPath)) {
                return res.status(404).json({ error: 'Upload directory not found' });
            }
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const files = fs.readdirSync(uploadsPath)
                .filter((f) => imageExtensions.includes(path.extname(f).toLowerCase()));

            const stripVariantSuffix = (name) =>
                String(name || '').replace(/(?:[\s._-]\d{1,2}|\s*\(\d{1,2}\))$/, '').trim();
            // Recover the original base name: drop ext, then the "-<13 digit timestamp>".
            const baseKeysFor = (file) => {
                const ext = path.extname(file);
                let base = path.basename(file, ext).replace(/-\d{13}$/, '').trim();
                const exact = base;
                const stripped = stripVariantSuffix(base);
                return [exact, stripped].filter(Boolean);
            };

            const fileKeys = files.map((f) => ({ file: f, keys: baseKeysFor(f) }));
            const allKeys = [...new Set(
                fileKeys.flatMap((fk) => fk.keys).filter(Boolean).map((k) => k.toLowerCase())
            )];

            let products = [];
            if (allKeys.length > 0) {
                products = await Product.findAll({
                    where: Sequelize.where(
                        Sequelize.fn('LOWER', Sequelize.col('model_no')),
                        { [Op.in]: allKeys }
                    ),
                });
            }

            const byModel = new Map();
            for (const p of products) {
                const k = String(p.model_no || '').toLowerCase();
                if (!byModel.has(k)) byModel.set(k, []);
                byModel.get(k).push(p);
            }

            const appendsByProduct = new Map(); // product_id -> { product, paths:Set }
            const linked = [];
            const unmatched = [];

            for (const { file, keys } of fileKeys) {
                const matches = byModel.get(keys[0].toLowerCase())
                    || byModel.get((keys[1] || '').toLowerCase())
                    || [];
                if (matches.length === 0) { unmatched.push(file); continue; }
                const rel = productImagePath(file);
                const targetIds = [];
                for (const product of matches) {
                    if (!appendsByProduct.has(product.product_id)) {
                        appendsByProduct.set(product.product_id, { product, paths: new Set() });
                    }
                    appendsByProduct.get(product.product_id).paths.add(rel);
                    targetIds.push(product.product_id);
                }
                linked.push({ file, model_no: matches[0].model_no, product_ids: targetIds });
            }

            let productsUpdated = 0;
            for (const { product, paths } of appendsByProduct.values()) {
                const existing = normalizeImageUrls(product.image_urls);
                const merged = [...new Set([...existing, ...paths])];
                // Update when there's something new OR when the stored value is
                // dirty (corrupted array / double-encoded string / paths) so the
                // re-link also CLEANS old rows down to bare filenames.
                const stored = toStoredImageUrls(merged);
                if (JSON.stringify(stored) === JSON.stringify(product.image_urls)) continue;
                const status = product.status === 'draft' ? 'active' : product.status;
                await Product.update(
                    { image_urls: stored, status, updated_at: new Date() },
                    { where: { product_id: product.product_id } }
                );
                productsUpdated++;
                await logAudit({
                    req,
                    action: 'update',
                    description: 'Product images re-linked from uploads folder',
                    tableName: 'product',
                    recordId: product.product_id,
                    oldValues: { image_urls: existing },
                    newValues: { image_urls: merged },
                });
            }

            return res.status(200).json({
                message: 'Re-link complete',
                summary: {
                    files: files.length,
                    linked: linked.length,
                    unmatched: unmatched.length,
                    productsUpdated,
                },
                linked,
                unmatched,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getAllUploadedImages(req, res) {
        try {
            const uploadsPath = path.join(__dirname, '..', '..', 'uploads', PRODUCT_IMAGE_UPLOAD_DIR);

            // Check if directory exists
            if (!fs.existsSync(uploadsPath)) {
                return res.status(404).json({
                    error: 'Upload directory not found',
                    images: []
                });
            }

            // Read all files from the directory
            const files = fs.readdirSync(uploadsPath);
            // MySQL JSON column: filter products whose `image_urls` is a non-empty JSON array.
            const allProducts = await Product.findAll({
                where: Sequelize.where(
                    Sequelize.fn('JSON_LENGTH', Sequelize.col('image_urls')),
                    { [Op.gt]: 0 }
                ),
            });
            // Bare filenames assigned to any product (normalizeImageUrls reduces
            // every stored entry — filename / path / legacy garbage — to a filename).
            const assignedSet = new Set(
                allProducts.flatMap((product) => normalizeImageUrls(product.image_urls))
            );

            // Filter only image files and get their details
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const images = files
                .filter(file => {
                    const ext = path.extname(file).toLowerCase();
                    return imageExtensions.includes(ext);
                })
                .map(file => {
                    const filePath = path.join(uploadsPath, file);
                    const stats = fs.statSync(filePath);
                    const url = `/uploads/${PRODUCT_IMAGE_UPLOAD_DIR}/${file}`;
                    const isAssigned = assignedSet.has(file);
                    return {
                        filename: file,
                        path: filePath,
                        url: url,
                        size: stats.size,
                        uploadedAt: stats.birthtime,
                        modifiedAt: stats.mtime,
                        isAssigned: isAssigned
                    };
                })
                // Sort by upload date (newest first)
                .sort((a, b) => b.uploadedAt - a.uploadedAt);

            res.status(200).json({
                success: true,
                count: images.length,
                images: images
            });
        } catch (error) {
            res.status(500).json({
                error: error.message,
                success: false
            });
        }
    }

    async hasData(data) {
        if (!data || data === undefined || data === null || data === '') {
            return false;
        }
        return true;
    }

    async bulkProductUpload(data, user, req) {
        try {
            if (!Array.isArray(data)) {
                return { success: false, message: 'Data must be an array' };
            }

            const createdProducts = [];
            const updatedProducts = [];
            const errors = [];
            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                try {
                    const { model_no, gender, color_code, shape, lens_color, frame_color,
                        frame_type, lens_material, frame_material, mrp, whp, size_mm,
                        warehouse_qty, brand, collection } = item;

                    let { status } = item;

                    if (!this.hasData(model_no) || !this.hasData(gender) || !this.hasData(color_code)
                        || !this.hasData(shape) || !this.hasData(lens_color) || !this.hasData(frame_color)
                        || !this.hasData(frame_type) || !this.hasData(lens_material) || !this.hasData(frame_material)
                        || !this.hasData(mrp) || !this.hasData(whp) || !this.hasData(size_mm)
                        || !this.hasData(warehouse_qty) || !this.hasData(brand) || !this.hasData(collection)) {
                        errors.push({ row: i + 1, model_no: model_no || 'N/A', error: 'All fields are required' });
                        errorCount++;
                        continue;
                    }

                    if (!this.hasData(status)) {
                        status = 'draft';
                    }

                    let brandModel = await Brand.findOne({ where: { brand_name: brand } });
                    if (!brandModel) {
                        brandModel = await Brand.create({ brand_name: brand });
                    }

                    let collectionModel = await Collection.findOne({ where: { collection_name: collection } });
                    if (!collectionModel) {
                        collectionModel = await Collection.create({ collection_name: collection, brand_id: brandModel.brand_id });
                    }
                    let colorCodeModel = await ColorCode.findOne({ where: { color_code: color_code } });
                    if (!colorCodeModel) {
                        colorCodeModel = await ColorCode.create({ color_code: color_code });
                    }
                    let shapeModel = await Shape.findOne({ where: { shape_name: shape } });
                    if (!shapeModel) {
                        shapeModel = await Shape.create({ shape_name: shape });
                    }

                    let lensColorModel = await LensColor.findOne({ where: { lens_color: lens_color } });
                    if (!lensColorModel) {
                        lensColorModel = await LensColor.create({ lens_color: lens_color });
                    }

                    let frameColorModel = await FrameColor.findOne({ where: { frame_color: frame_color } });
                    if (!frameColorModel) {
                        frameColorModel = await FrameColor.create({ frame_color: frame_color });
                    }

                    let frameTypeModel = await FrameType.findOne({ where: { frame_type: frame_type } });
                    if (!frameTypeModel) {
                        frameTypeModel = await FrameType.create({ frame_type: frame_type });
                    }

                    let lensMaterialModel = await LensMaterial.findOne({ where: { lens_material: lens_material } });
                    if (!lensMaterialModel) {
                        lensMaterialModel = await LensMaterial.create({ lens_material: lens_material });
                    }

                    let frameMaterialModel = await FrameMaterial.findOne({ where: { frame_material: frame_material } });
                    if (!frameMaterialModel) {
                        frameMaterialModel = await FrameMaterial.create({ frame_material: frame_material });
                    }

                    let genderModel = await Gender.findOne({ where: { gender_name: gender } });
                    if (!genderModel) {
                        genderModel = await Gender.create({ gender_name: gender });
                    }

                    // Check if product with same model_no already exists
                    const existingProduct = await Product.findOne({
                        where: {
                            model_no, color_code_id: colorCodeModel.color_code_id
                        }
                    });
                    if (existingProduct) {
                        const bulkUpdatePayload = {
                            status: status,
                            warehouse_qty: warehouse_qty,
                            mrp: mrp,
                            whp: whp,
                            size_mm: size_mm,
                            brand_id: brandModel.brand_id,
                            collection_id: collectionModel.collection_id,
                            gender_id: genderModel.gender_id,
                            color_code_id: colorCodeModel.color_code_id,
                            shape_id: shapeModel.shape_id,
                            lens_color_id: lensColorModel.lens_color_id,
                            frame_color_id: frameColorModel.frame_color_id,
                            frame_type_id: frameTypeModel.frame_type_id,
                            lens_material_id: lensMaterialModel.lens_material_id,
                            frame_material_id: frameMaterialModel.frame_material_id,
                            updated_at: new Date(),
                        };
                        const oldSnapshot = existingProduct.toJSON();
                        Product.update(bulkUpdatePayload, { where: { product_id: existingProduct.product_id } });
                        await logAudit({
                            req,
                            action: 'update',
                            description: 'Product updated via bulk upload',
                            tableName: 'product',
                            recordId: existingProduct.product_id,
                            oldValues: oldSnapshot,
                            newValues: { ...oldSnapshot, ...bulkUpdatePayload },
                        });
                        updatedProducts.push(existingProduct);
                        successCount++;
                        continue;
                    }

                    const product = await Product.create({
                        model_no,
                        gender_id: genderModel.gender_id,
                        color_code_id: colorCodeModel.color_code_id,
                        shape_id: shapeModel.shape_id,
                        lens_color_id: lensColorModel.lens_color_id,
                        frame_color_id: frameColorModel.frame_color_id,
                        frame_type_id: frameTypeModel.frame_type_id,
                        lens_material_id: lensMaterialModel.lens_material_id,
                        frame_material_id: frameMaterialModel.frame_material_id,
                        image_urls: [],
                        mrp,
                        whp,
                        size_mm,
                        warehouse_qty,
                        tray_qty: 0,
                        total_qty: warehouse_qty,
                        status,
                        brand_id: brandModel.brand_id,
                        collection_id: collectionModel.collection_id,
                        created_at: new Date(),
                        updated_at: new Date(),
                    });

                    createdProducts.push(product);

                    // Create audit log if user is provided
                    if (user && req) {
                        await logAudit({
                            req,
                            action: 'create',
                            description: 'Product created via bulk upload',
                            tableName: 'product',
                            recordId: product.product_id,
                            oldValues: null,
                            newValues: product,
                        });
                    }

                    successCount++;
                } catch (error) {
                    errors.push({ row: i + 1, model_no: item.model_no || 'N/A', error: error.message });
                    errorCount++;
                }
            }

            return {
                success: successCount > 0,
                message: `Bulk upload completed. ${successCount} products created, ${errorCount} errors.`,
                data: {
                    created: createdProducts,
                    errors: errors,
                    successCount,
                    errorCount,
                    total: data.length
                }
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    async getProductModels(req, res) {
        try {
            const { model_no } = req.body;
            if (!model_no) {
                return res.status(400).json({ error: 'Model number is required' });
            }
            const products = await Product.findAll({ where: { model_no: model_no } });
            res.status(200).json(products);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ProductController();