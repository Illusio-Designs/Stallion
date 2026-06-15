const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const fs = require('fs');
const path = require('path');
const productController = require('../controllers/productController');

/**
 * Middleware to parse Excel/CSV files and create products
 * Expects req.file to be set by multer middleware
 */
const parseProductFile = async (req, res, next) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        let products = [];
        const filePaths = []; // Track all file paths for cleanup

        for (const file of req.files) {
            const filePath = file.path;
            filePaths.push(filePath); // Track this file path
            const fileExt = path.extname(file.originalname).toLowerCase();
            // Parse file based on extension
            if (fileExt === '.csv') {
                // Read and parse CSV file
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                const records = parse(fileContent, {
                    columns: true,
                    skip_empty_lines: true,
                    trim: true
                });

                // Map CSV records to product objects
                products.push(...records.map(record => ({
                    model_no: record.model_no || record.modelNo || record['Model No'] || record['Model Number'],
                    gender: (record.gender || record.gender || record['Gender'] || record.gender) || null,
                    color_code: (record.color_code || record.colorCode || record['Color Code'] || record['Color Code']) || null,
                    shape: (record.shape || record.shape || record['Shape'] || record.shape) || null,
                    lens_color: (record.lens_color || record.lensColor || record['Lens Color'] || record.lensColor) || null,
                    frame_color: (record.frame_color || record.frameColor || record['Frame Color'] || record['Frame Color']) || null,
                    frame_type: (record.frame_type || record.frameType || record['Frame Type'] || record.frameType) || null,
                    lens_material: (record.lens_material || record.lensMaterial || record['Lens Material'] || record.lensMaterial) || null,
                    frame_material: (record.frame_material || record.frameMaterial || record['Frame Material'] || record.frameMaterial) || null,
                    mrp: (record.mrp || record.MRP || record['MRP']) || null,
                    whp: (record.whp || record.WHP || record['WHP']) || null,
                    size_mm: record.size_mm || record.sizeMm || record['Size (mm)'] || record.size || null,
                    warehouse_qty: (record.warehouse_qty || record.warehouseQty || record['Warehouse Qty'] || record.warehouse || 0) || 0,
                    status: record.status || record.Status || 'draft',
                    brand: record.brand || record.Brand || record['Brand'] || record.brand || null,
                    collection: record.collection || record.Collection || record['Collection'] || record.collection || null,
                })));

            } else if (fileExt === '.xlsx' || fileExt === '.xls') {
                // Read and parse Excel file
                const workbook = XLSX.readFile(filePath);
                const sheetName = workbook.SheetNames[0]; // Use first sheet
                const worksheet = workbook.Sheets[sheetName];
                const records = XLSX.utils.sheet_to_json(worksheet);

                // Map Excel records to product objects
                products.push(...records.map(record => ({
                    model_no: record.model_no || record.modelNo || record['Model No'] || record['Model Number'] || record['MODEL_NO'],
                    gender: record.gender || record.gender || record['Gender'] || record.gender || record['GENDER_ID'] || null,
                    color_code: record.color_code || record.colorCode || record['Color Code'] || record.colorCode || record['COLOR_CODE_ID'] || null,
                    shape: record.shape || record.shape || record['Shape'] || record.shape || record['SHAPE_ID'] || null,
                    lens_color: record.lens_color || record.lensColor || record['Lens Color'] || record['Lens Color'] || record['LENS_COLOR_ID'] || null,
                    frame_color: record.frame_color || record.frameColor || record['Frame Color'] || record['Frame Color'] || record['FRAME_COLOR_ID'] || null,
                    frame_type: (record.frame_type || record.frameType || record['Frame Type'] || record['Frame Type'] || record['FRAME_TYPE_ID']) || null,
                    lens_material: (record.lens_material || record.lensMaterial || record['Lens Material'] || record['Lens Material'] || record['LENS_MATERIAL_ID']) || null,
                    frame_material: (record.frame_material || record.frameMaterial || record['Frame Material'] || record['Frame Material'] || record['FRAME_MATERIAL_ID']) || null,
                    mrp: (record.mrp || record.MRP || record['MRP']) || null,
                    whp: (record.whp || record.WHP || record['WHP']) || null,
                    size_mm: record.size_mm || record.sizeMm || record['Size (mm)'] || record.size || record['SIZE_MM'] || null,
                    warehouse_qty: (record.warehouse_qty || record.warehouseQty || record['Warehouse Qty'] || record.warehouse || record['WAREHOUSE_QTY'] || 0) || 0,
                    status: record.status || record.Status || record['STATUS'] || 'draft',
                    brand: record.brand || record.Brand || record['Brand'] || record['BRAND_ID'] || null,
                    collection: record.collection || record.Collection || record['Collection'] || record.collection || record['COLLECTION_ID'] || null,
                })));

            } else {
                // Clean up uploaded file if format not supported
                fs.unlinkSync(filePath);
                return res.status(400).json({
                    success: false,
                    message: 'Unsupported file format. Only CSV and Excel files are allowed.'
                });
            }
        }
        // Filter out invalid products (must have model_no at minimum)
        products = products.filter(product => product.model_no);

        if (products.length === 0) {
            // Clean up all uploaded files
            filePaths.forEach(filePath => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            });
            return res.status(400).json({
                success: false,
                message: 'No valid products found in the file'
            });
        }

        // Store products in request for bulkProductUpload
        req.products = products;
        req.filePaths = filePaths;

        // Call bulkProductUpload
        const result = await productController.bulkProductUpload(products, req.user, req);

        // Clean up all uploaded files after processing
        filePaths.forEach(filePath => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });

        // Send response
        if (result.success) {
            return res.status(200).json({
                success: true,
                message: result.message,
                data: result.data,
                totalProcessed: products.length
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.message,
                data: result.data,
                totalProcessed: products.length,
            });
        }

    } catch (error) {
        // Clean up all uploaded files on error
        if (req.files && Array.isArray(req.files)) {
            req.files.forEach(file => {
                if (file && file.path && fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }

        console.error('Product file parsing error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error parsing product file: ' + error.message
        });
    }
};

module.exports = parseProductFile;

