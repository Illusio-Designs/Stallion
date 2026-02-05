/**
 * CREATE TABLE parties (
party_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
party_name VARCHAR(255) NOT NULL,
trade_name VARCHAR(255),
contact_person VARCHAR(255),
email VARCHAR(255),
phone VARCHAR(20),
address TEXT,
country_id UUID,
state_id UUID,
city_id UUID,
zone_id UUID,
pincode VARCHAR(10),
gstin VARCHAR(15),
pan VARCHAR(10),
is_active BOOLEAN DEFAULT true,
created_by UUID,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 * 
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Party = sequelize.define('Party', {
    party_id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    party_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    trade_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    contact_person: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    country_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'countries',
            key: 'id'
        }
    },
    state_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'states',
            key: 'id'
        }
    },
    city_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'cities',
            key: 'id'
        }
    },
    zone_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
            model: 'zones',
            key: 'id'
        }
    },
    pincode: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    gstin: {
        type: DataTypes.STRING(15),
        allowNull: true
    },
    pan: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    created_by: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
        }
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    },
    credit_days: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    },
    prefered_courier: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: 'users',
            key: 'user_id'
        }
    }
}, {
    tableName: 'parties',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Party;