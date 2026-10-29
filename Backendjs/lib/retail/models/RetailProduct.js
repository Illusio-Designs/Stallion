const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// The store's OWN copy of a frame. Filled by the sync from the Stallion catalogue
// (source_product_id) and then edited here. Stock is kept separately from wholesale stock.
const RetailProduct = sequelize.define('RetailProduct', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    source_product_id: { type: DataTypes.UUID, allowNull: true, unique: true },
    model_no: { type: DataTypes.STRING(255), allowNull: false },
    slug: { type: DataTypes.STRING(280), allowNull: false, unique: true },
    title: { type: DataTypes.STRING(255), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    brand_name: { type: DataTypes.STRING(120), allowNull: true },
    shape: { type: DataTypes.STRING(80), allowNull: true },
    frame_type: { type: DataTypes.STRING(80), allowNull: true },
    frame_material: { type: DataTypes.STRING(80), allowNull: true },
    lens_color: { type: DataTypes.STRING(80), allowNull: true },
    lens_material: { type: DataTypes.STRING(80), allowNull: true },
    gender: { type: DataTypes.STRING(40), allowNull: true },
    color: { type: DataTypes.STRING(80), allowNull: true },
    size_mm: { type: DataTypes.STRING(40), allowNull: true },
    mrp: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    images: { type: DataTypes.JSON, allowNull: true },          // ["https://.../a.webp", ...], first is primary
    show_on_store: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    total_sold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    seo_title: { type: DataTypes.STRING(160), allowNull: true },
    seo_description: { type: DataTypes.STRING(400), allowNull: true },
    synced_at: { type: DataTypes.DATE, allowNull: true },
}, {
    tableName: 'retail_products',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = RetailProduct;
