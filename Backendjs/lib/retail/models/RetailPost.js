const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');
const { htmlToText } = require('../services/sanitizeHtml');

// Blog post. Never hard deleted: status 'archived' hides it. Only 'published' posts whose
// published_at is not in the future are served publicly.
const RetailPost = sequelize.define('RetailPost', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    slug: { type: DataTypes.STRING(200), allowNull: false },           // unique index idx_retail_posts_slug
    title: { type: DataTypes.STRING(255), allowNull: false },
    summary: { type: DataTypes.STRING(600), allowNull: true },
    body: { type: DataTypes.TEXT('long'), allowNull: true },           // sanitised HTML
    cover_image: { type: DataTypes.STRING(500), allowNull: true },
    tags: { type: DataTypes.JSON, allowNull: true },                   // ["sunglasses", "care"]
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft', validate: { isIn: [['draft', 'published', 'archived']] } },
    published_at: { type: DataTypes.DATE, allowNull: true },
    related_product_ids: { type: DataTypes.JSON, allowNull: true },    // RetailProduct ids
    seo_title: { type: DataTypes.STRING(160), allowNull: true },
    seo_description: { type: DataTypes.STRING(400), allowNull: true },
    read_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }, // computed from body on save
}, {
    tableName: 'retail_posts',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
        // ~200 words per minute, never less than one minute.
        beforeSave(post) {
            const words = htmlToText(post.body).split(/\s+/).filter(Boolean).length;
            post.read_minutes = Math.max(1, Math.ceil(words / 200));
        },
    },
});

module.exports = RetailPost;
