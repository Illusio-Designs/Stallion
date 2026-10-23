const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

// In-app notification for one user (user_id) or for a group (target_role 'office' = admin and
// order manager). Rows are never deleted; reading only sets read_at.
const Notification = sequelize.define('Notification', {
    notification_id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    user_id: { type: DataTypes.UUID, allowNull: true },
    target_role: { type: DataTypes.STRING(50), allowNull: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    kind: { type: DataTypes.STRING(50), allowNull: true },
    order_id: { type: DataTypes.UUID, allowNull: true },
    read_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
    tableName: 'notifications',
    timestamps: false,
    indexes: [
        { fields: ['user_id', 'read_at'], name: 'idx_notifications_user_read' },
        { fields: ['target_role', 'read_at'], name: 'idx_notifications_role_read' },
    ],
});

module.exports = Notification;
