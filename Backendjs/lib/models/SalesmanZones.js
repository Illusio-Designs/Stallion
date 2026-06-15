
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
    indexes: [
        { fields: ['salesman_id'], name: 'idx_salesman_zones_salesman_id' },
        { fields: ['zone_id'], name: 'idx_salesman_zones_zone_id' },
        { fields: ['salesman_id', 'zone_id'], name: 'idx_salesman_zones_salesman_zone_unique', unique: true },
    ],
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