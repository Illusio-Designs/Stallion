const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// One question/answer, grouped by category on the storefront. Hidden with is_active=false, never deleted.
const RetailFaq = sequelize.define('RetailFaq', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    category: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'General' },
    question: { type: DataTypes.STRING(400), allowNull: false },
    answer: { type: DataTypes.TEXT, allowNull: false },                // sanitised HTML
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
    tableName: 'retail_faqs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = RetailFaq;
