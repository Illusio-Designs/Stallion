const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: true
    },
    action: {
        type: DataTypes.ENUM('create', 'update', 'delete'),
        allowNull: false
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    table_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    record_id: {
        type: DataTypes.STRING(36),
        allowNull: true
    },
    old_values: {
        type: DataTypes.JSON,
        allowNull: true
    },
    new_values: {
        type: DataTypes.JSON,
        allowNull: true
    },
    ip_address: {
        type: DataTypes.STRING,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'audit_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
        { fields: ['user_id'], name: 'idx_audit_logs_user_id' },
        { fields: ['table_name'], name: 'idx_audit_logs_table_name' },
        { fields: ['record_id'], name: 'idx_audit_logs_record_id' },
        { fields: ['action'], name: 'idx_audit_logs_action' },
        { fields: ['created_at'], name: 'idx_audit_logs_created_at' },
        { fields: ['table_name', 'record_id'], name: 'idx_audit_logs_table_record' },
    ],
});

const User = require('./User');
AuditLog.belongsTo(User, { foreignKey: 'user_id', constraints: false });

module.exports = AuditLog;
