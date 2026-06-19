
const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');
const Salesman = require('./Salesman');
const Order = require('./Order');
const { SalesmanCheckInType } = require('../constants/enums');

const SalesmanCheckIns = sequelize.define('SalesmanCheckIns', {
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
    check_in_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    party_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'parties',
            key: 'party_id'
        }
    },
    contact_person: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM(SalesmanCheckInType.VISIT, SalesmanCheckInType.ORDERED),
        allowNull: false
    },
    order_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'order',
            key: 'order_id'
        }
    },
    in_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    out_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    next_visit_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true
    },
    longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true
    },
    check_in_remarks: {
        type: DataTypes.TEXT,
        allowNull: true
    },
}, {
    tableName: 'salesman_check_ins',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { fields: ['salesman_id'], name: 'idx_salesman_check_ins_salesman_id' },
        { fields: ['party_id'], name: 'idx_salesman_check_ins_party_id' },
        { fields: ['check_in_date'], name: 'idx_salesman_check_ins_date' },
        { fields: ['order_id'], name: 'idx_salesman_check_ins_order_id' },
        { fields: ['type'], name: 'idx_salesman_check_ins_type' },
    ],
});

SalesmanCheckIns.belongsTo(Salesman, {
    foreignKey: 'salesman_id',
    targetKey: 'salesman_id',
    as: 'salesman',
});

SalesmanCheckIns.belongsTo(Order, {
    foreignKey: 'order_id',
    targetKey: 'order_id',
    as: 'order',
});

module.exports = SalesmanCheckIns;
