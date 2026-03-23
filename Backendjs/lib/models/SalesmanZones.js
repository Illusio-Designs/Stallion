
const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');
const Salesman = require('./Salesman');
const Zone = require('./Zone');

const SalesmanZones = sequelize.define('SalesmanZones', {
    zone_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'zones',
            key: 'id'
        }
    },
    salesman_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'salesmen',
            key: 'salesman_id'
        }
    },
}, {
    tableName: 'salesman_zones',
    timestamps: false,
});

SalesmanZones.belongsTo(Salesman, {
    foreignKey: 'salesman_id',
    targetKey: 'salesman_id'
});

SalesmanZones.belongsTo(Zone, {
    foreignKey: 'zone_id',
    targetKey: 'id'
});

module.exports = SalesmanZones;