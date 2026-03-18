const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
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

class ProductController {
    async getFeaturedProducts(req, res) {
        try {
            const { collection_id } = req.body;
            if (!collection_id || collection_id === '' || collection_id === 'all') {
                const products = await Product.findAll({ limit: 6 });
                if (!products || products.length === 0) {
                    return res.status(404).json({ error: 'Featured products not found' });
                }
                return res.status(200).json(products);
            }
            const products = await Product.findAll({ where: { collection_id: collection_id }, limit: 6 });
            if (!products || products.length === 0) {
                return res.status(404).json({ error: 'Featured products not found' });
            }
            res.status(200).json(products);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getProducts(req, res) {
        try {
            const { page, limit } = req.query;
            if (!page || !limit) {
                return res.status(400).json({ error: 'Page and limit are required' });
            }
            if (isNaN(page) || isNaN(limit)) {
                return res.status(400).json({ error: 'Page and limit must be numbers' });
            }
            const { price, collection_id, brand_id, color_code_id, shape_id, lens_color_id, frame_color_id, frame_type_id, lens_material_id, frame_material_id, gender_id } = req.body;
            const filter = {};

            if (collection_id) {
                filter.collection_id = collection_id;
            }
            if (brand_id) {
                filter.brand_id = brand_id;
            }
            if (color_code_id) {
                filter.color_code_id = color_code_id;
            }
            if (shape_id) {
                filter.shape_id = shape_id;
            }
            if (lens_color_id) {
                filter.lens_color_id = lens_color_id;
            }
            if (frame_color_id) {
                filter.frame_color_id = frame_color_id;
            }
            if (frame_type_id) {
                filter.frame_type_id = frame_type_id;
            }
            if (lens_material_id) {
                filter.lens_material_id = lens_material_id;
            }
            if (frame_material_id) {
                filter.frame_material_id = frame_material_id;
            }
            if (gender_id) {
                filter.gender_id = gender_id;
            }
            if (price) {
                filter.mrp = {
                    [Op.gte]: price.min,
                    [Op.lte]: price.max
                };
            }
            const products = await Product.findAll(
                {
                    where: filter, limit: parseInt(limit), offset: (parseInt(page) - 1) * parseInt(limit)
                });
            if (!products || products.length === 0) {
                return res.status(404).json({ error: 'Products not found' });
            }
            res.status(200).json(products);
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
            await AuditLog.create({
                user_id: user.user_id,
                action: 'create',
                description: 'Product created',
                table_name: 'products',
                record_id: product.product_id,
                old_values: null,
                new_values: product,
                ip_address: req.ip,
                created_at: new Date()
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
            await Product.update({
                model_no: model_no || product.model_no,
                gender_id: gender_id || product.gender_id,
                color_code_id: color_code_id || product.color_code_id,
                shape_id: shape_id || product.shape_id,
                lens_color_id: lens_color_id || product.lens_color_id,
                frame_color_id: frame_color_id || product.frame_color_id,
                frame_type_id: frame_type_id || product.frame_type_id,
                lens_material_id: lens_material_id || product.lens_material_id,
                frame_material_id: frame_material_id || product.frame_material_id,
                image_urls: image_urls || product.image_urls,
                mrp: mrp || product.mrp,
                whp: whp || product.whp,
                size_mm: size_mm || product.size_mm,
                warehouse_qty: warehouse_qty || product.warehouse_qty,
                tray_qty: tray_qty || product.tray_qty,
                total_qty: total_qty || product.total_qty,
                status: status || product.status,
                brand_id: brand_id || product.brand_id,
                collection_id: collection_id || product.collection_id,
                updated_at: new Date(),
            }, { where: { product_id: id } });

            await AuditLog.create({
                user_id: user.user_id,
                action: 'update',
                description: 'Product updated',
                table_name: 'products',
                record_id: id,
                old_values: product,
                new_values: req.body,
                ip_address: req.ip,
                created_at: new Date()
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
            const product = await Product.destroy({ where: { product_id: id } });
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }
            await AuditLog.create({
                user_id: user.user_id,
                action: 'delete',
                description: 'Product deleted',
                table_name: 'products',
                record_id: id,
                old_values: product,
                new_values: null,
                ip_address: req.ip,
                created_at: new Date()
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
            console.log("withPath", withPath);
            // MySQL JSON columns don't support LIKE reliably; use JSON_CONTAINS for JSON arrays,
            // plus a fallback LIKE for any legacy string storage.
            const product = await Product.findOne({
                where: {
                    [Op.or]: [
                        Sequelize.where(
                            Sequelize.fn('JSON_CONTAINS', Sequelize.col('image_urls'), JSON.stringify(withPath)),
                            1
                        ),
                        { image_urls: { [Op.like]: `%${withPath}%` } },
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

            if (!product_id) {
                return res.status(200).json({
                    message: 'Product image uploaded successfully',
                    data: fileInfos,
                });
            }

            // Find the product
            const product = await Product.findOne({ where: { product_id: product_id } });
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // Get existing image_urls or initialize empty array
            let image_urls = product.image_urls || [];
            const oldImageUrls = [...image_urls];

            // Add all uploaded image paths to the array
            for (const fileInfo of fileInfos) {
                image_urls.push(fileInfo.path);
            }

            let status = product.status;
            if (status === 'draft') {
                status = 'active';
            }

            // Update product with new image_urls
            await Product.update(
                { image_urls: image_urls, status: status, updated_at: new Date() },
                { where: { product_id: product_id } }
            );

            // Create audit log
            await AuditLog.create({
                user_id: req.user.user_id,
                action: 'update',
                description: 'Product image saved',
                table_name: 'products',
                record_id: product.product_id,
                old_values: { image_urls: oldImageUrls },
                new_values: { image_urls: image_urls },
                ip_address: req.ip,
                created_at: new Date()
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
            const allProductImages = allProducts
                .map((product) => product.image_urls)
                .flat()
                .filter((u) => typeof u === 'string');

            const normalize = (p) => (typeof p === 'string' ? p.replace(/^\/+/, '') : '');
            const assignedSet = new Set(allProductImages.map(normalize));

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
                    const isAssigned = assignedSet.has(normalize(url));
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
                        Product.update({
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
                        }, { where: { product_id: existingProduct.product_id } });
                        await AuditLog.create({
                            user_id: user.user_id,
                            action: 'update',
                            description: 'Product updated via bulk upload',
                            table_name: 'products',
                            record_id: existingProduct.product_id,
                            old_values: existingProduct,
                            new_values: {
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
                            },
                            ip_address: req.ip || 'N/A',
                            created_at: new Date()
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
                        await AuditLog.create({
                            user_id: user.user_id,
                            action: 'create',
                            description: 'Product created via bulk upload',
                            table_name: 'products',
                            record_id: product.product_id,
                            old_values: null,
                            new_values: product,
                            ip_address: req.ip || 'N/A',
                            created_at: new Date()
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
            if (!products || products.length === 0) {
                return res.status(404).json({ error: 'Products not found' });
            }
            res.status(200).json(products);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ProductController();