const express = require('express');
const router = express.Router();

// Import all route files
const authRoutes = require('./auth');
const rolesRoutes = require('./roles');
const userRoutes = require('./user');
const partyRoutes = require('./party');
const distributorRoutes = require('./distributor');
const salesmanRoutes = require('./salesman');
const cityRoutes = require('./city');
const stateRoutes = require('./state');
const countryRoutes = require('./country');
const zoneRoutes = require('./zone');
const productRoutes = require('./product');
const genderRoutes = require('./gender');
const colorCodesRoutes = require('./color_codes');
const frameColorRoutes = require('./frame_color');
const frameTypeRoutes = require('./frame_type');
const lensMaterialRoutes = require('./lens_material');
const lensColorsRoutes = require('./lens_colors');
const shapesRoutes = require('./shapes');
const frameMaterialRoutes = require('./frame_material');
const brandRoutes = require('./brand');
const collectionRoutes = require('./collection');
const trayRoutes = require('./tray');
const salesmanTrayRoutes = require('./salesman_tray');
const trayProductsRoutes = require('./tray_products');
const eventRoutes = require('./event');
const orderRoutes = require('./order');
const salesmanExpenseRoutes = require('./salesman_expense');

router.use((req, res, next) => {
    const timestamp = new Date();
    const timeString = `${timestamp.getDate()}/${timestamp.getMonth() + 1}/${timestamp.getFullYear()} ${timestamp.getHours()}:${timestamp.getMinutes()}:${timestamp.getSeconds()}`;
    console.log(`-------------------------------- ${req.method} ${req.url} ${timeString} --------------------------------`);
    next();
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/roles', rolesRoutes);
router.use('/users', userRoutes);
router.use('/parties', partyRoutes);
router.use('/distributors', distributorRoutes);
router.use('/salesmen', salesmanRoutes);
router.use('/cities', cityRoutes);
router.use('/states', stateRoutes);
router.use('/countries', countryRoutes);
router.use('/zones', zoneRoutes);
router.use('/products', productRoutes);
router.use('/genders', genderRoutes);
router.use('/color_codes', colorCodesRoutes);
router.use('/frame_colors', frameColorRoutes);
router.use('/frame_types', frameTypeRoutes);
router.use('/lens_materials', lensMaterialRoutes);
router.use('/lens_colors', lensColorsRoutes);
router.use('/shapes', shapesRoutes);
router.use('/frame_materials', frameMaterialRoutes);
router.use('/brands', brandRoutes);
router.use('/collections', collectionRoutes);
router.use('/trays', trayRoutes);
router.use('/salesman_trays', salesmanTrayRoutes);
router.use('/tray_products', trayProductsRoutes);
router.use('/events', eventRoutes);
router.use('/orders', orderRoutes);
router.use('/salesman_expenses', salesmanExpenseRoutes);

// API documentation route
router.get('/docs', (req, res) => {
    res.json({
        message: 'Stallion Optical E-commerce API Documentation',
        version: '1.0.0',
        endpoints: {
            // Authentication endpoints
            auth: '/api/auth',
            roles: '/api/roles',
            users: '/api/users',
            parties: '/api/parties',
            distributors: '/api/distributors',
            salesmen: '/api/salesmen',
            cities: '/api/cities',
            states: '/api/states',
            countries: '/api/countries',
            zones: '/api/zones',

            // Product endpoints
            products: '/api/products',
            genders: '/api/genders',
            color_codes: '/api/color_codes',
            frame_colors: '/api/frame_colors',
            frame_types: '/api/frame_types',
            lens_materials: '/api/lens_materials',
            lens_colors: '/api/lens_colors',
            shapes: '/api/shapes',
            frame_materials: '/api/frame_materials',
            brands: '/api/brands',
            collections: '/api/collections',
            products: '/api/products',
            genders: '/api/genders',
            color_codes: '/api/color_codes',
            frame_colors: '/api/frame_colors',
            frame_types: '/api/frame_types',
            lens_materials: '/api/lens_materials',
            lens_colors: '/api/lens_colors',
            shapes: '/api/shapes',
            frame_materials: '/api/frame_materials',
            brands: '/api/brands',
            collections: '/api/collections',

            // Tray endpoints
            trays: '/api/trays',
            salesman_trays: '/api/salesman_trays',
            tray_products: '/api/tray_products',

            // Event endpoints
            events: '/api/events',

            // Order endpoints
            orders: '/api/orders',

            // Salesman expense endpoints
            salesman_expenses: '/api/salesman_expenses',
        }
    });
});

module.exports = router; 