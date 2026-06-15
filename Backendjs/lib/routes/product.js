const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken } = require('../middleware/auth');
const { isProductManager, checkRole } = require('../middleware/roleAuth');
const { productFileUpload, productImageUpload } = require('../constants/multer');
const parseProductFile = require('../middleware/product_parser');

router.post('/', authenticateToken, productController.getProducts);
router.post('/featured', productController.getFeaturedProducts);
router.get('/images/all', authenticateToken, isProductManager, productController.getAllUploadedImages);
router.post('/create', authenticateToken, isProductManager, productController.createProduct);
router.put('/:id', authenticateToken, checkRole(['admin', 'product_manager', 'tray_manager']), productController.updateProduct);
router.delete('/:id', authenticateToken, isProductManager, productController.deleteProduct);
router.delete('/images/:file_name', authenticateToken, isProductManager, productController.deleteProductImage);
router.post('/image-upload', authenticateToken, isProductManager, productImageUpload, productController.uploadProductImage);
router.post('/bulk-upload',
    authenticateToken,
    isProductManager,
    productFileUpload,
    parseProductFile,
    productController.bulkProductUpload
);
router.post('/product-models', authenticateToken, productController.getProductModels);

module.exports = router;
