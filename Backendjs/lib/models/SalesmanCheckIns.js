
const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');
const Salesman = require('./Salesman');

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
    updatedAt: 'updated_at'
});

SalesmanCheckIns.belongsTo(Salesman, {
    foreignKey: 'salesman_id',
    targetKey: 'salesman_id',
    as: 'salesman',
});

module.exports = SalesmanCheckIns;