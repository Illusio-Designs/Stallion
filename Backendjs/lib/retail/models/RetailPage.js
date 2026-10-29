const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// SEO settings for one storefront path ("/", "/shop", "/blog"...). One row per path
// (unique index idx_retail_pages_path in retail/dbIndexes.js).
const RetailPage = sequelize.define('RetailPage', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    path: { type: DataTypes.STRING(200), allowNull: false },
    title: { type: DataTypes.STRING(160), allowNull: true },
    description: { type: DataTypes.STRING(400), allowNull: true },
    og_image: { type: DataTypes.STRING(500), allowNull: true },
    canonical: { type: DataTypes.STRING(500), allowNull: true },
    noindex: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
    tableName: 'retail_pages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = RetailPage;
