const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// Editable text pages: about, privacy, terms, returns, shipping. `content_key` is the page key
// (API field name is "key"); unique index idx_retail_content_key in retail/dbIndexes.js.
const RetailContent = sequelize.define('RetailContent', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    content_key: { type: DataTypes.STRING(40), allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    body: { type: DataTypes.TEXT('long'), allowNull: true },           // sanitised HTML
}, {
    tableName: 'retail_content',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = RetailContent;
