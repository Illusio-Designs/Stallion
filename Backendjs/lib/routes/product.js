const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticateToken } = require('../middleware/auth');
const { productFileUpload, productImageUpload } = require('../constants/multer');
const parseProductFile = require('../middleware/product_parser');

router.post('/', authenticateToken, productController.getProducts);
router.post('/featured', productController.getFeaturedProducts);
router.get('/images/all', authenticateToken, productController.getAllUploadedImages);
router.post('/create', authenticateToken, productController.createProduct);
router.put('/:id', authenticateToken, productController.updateProduct);
router.delete('/:id', authenticateToken, productController.deleteProduct);
router.delete('/images/:file_name', authenticateToken, productController.deleteProductImage);
router.post('/image-upload', authenticateToken, productImageUpload, productController.uploadProductImage);
router.post('/bulk-upload',
    authenticateToken,
    productFileUpload,
    parseProductFile,
    productController.bulkProductUpload
);
router.post('/product-models', authenticateToken, productController.getProductModels);

module.exports = router;