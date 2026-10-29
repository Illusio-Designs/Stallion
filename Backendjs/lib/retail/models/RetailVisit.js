const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// A visit ping from the storefront: one per browser session (repeats inside 30 minutes are dropped).
// `source` is worked out when saved: utm_source, else the referrer's host, else 'direct'.
const RetailVisit = sequelize.define('RetailVisit', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    session_id: { type: DataTypes.STRING(64), allowNull: false },
    landing_page: { type: DataTypes.STRING(500), allowNull: true }, // path only, no query string
    referrer: { type: DataTypes.STRING(500), allowNull: true },
    source: { type: DataTypes.STRING(120), allowNull: false, defaultValue: 'direct' },
    utm_source: { type: DataTypes.STRING(150), allowNull: true },
    utm_medium: { type: DataTypes.STRING(150), allowNull: true },
    utm_campaign: { type: DataTypes.STRING(150), allowNull: true },
    utm_term: { type: DataTypes.STRING(150), allowNull: true },
    utm_content: { type: DataTypes.STRING(150), allowNull: true },
}, {
    tableName: 'retail_visits',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { name: 'idx_retail_visits_session_id', fields: ['session_id'] },
        { name: 'idx_retail_visits_created_at', fields: ['created_at'] },
        { name: 'idx_retail_visits_source', fields: ['source'] },
    ],
});

module.exports = RetailVisit;
