const { DataTypes } = require('sequelize');
const sequelize = require('../../constants/database');

// Contact form messages. `handled` is flipped by the team from the admin.
const RetailMessage = sequelize.define('RetailMessage', {
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    name: { type: DataTypes.STRING(120), allowNull: false },
    contact: { type: DataTypes.STRING(190), allowNull: false }, // phone or email, as typed
    message: { type: DataTypes.TEXT, allowNull: false },
    handled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    handled_at: { type: DataTypes.DATE, allowNull: true },
    handled_by: { type: DataTypes.STRING(120), allowNull: true },
}, {
    tableName: 'retail_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { name: 'idx_retail_messages_handled_created', fields: ['handled', 'created_at'] },
    ],
});

module.exports = RetailMessage;
