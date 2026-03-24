const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');
const Salesman = require('./Salesman');

const SalesmanTargets = sequelize.define('SalesmanTargets', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    salesman_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        references: {
            model: 'salesmen',
            key: 'salesman_id'
        }
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    target_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    order_type: {
        type: DataTypes.ENUM('party_order', 'distributor_order', 'event_order', 'visit_order', 'whatsapp_order'),
        allowNull: true
    },
    target_status: {
        type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
        allowNull: false,
        defaultValue: 'pending'
    },
    target_description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    target_remarks: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    completed_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    }
}, {
    tableName: 'salesman_targets',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

SalesmanTargets.belongsTo(Salesman, {
    foreignKey: 'salesman_id',
    targetKey: 'salesman_id',
    as: 'salesman',
});

module.exports = SalesmanTargets;