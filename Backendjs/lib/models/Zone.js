const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Zone = sequelize.define('Zone', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  city_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'cities',
      key: 'id'
    }
  },
  state_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'states',
      key: 'id'
    }
  },
  country_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'countries',
      key: 'id'
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  zone_code: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: true,
  }
}, {
  tableName: 'zones',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['name', 'state_id'],
      name: 'zones_name_state_unique'
    }
  ]
});

// Static method to get zones by state
Zone.getZonesByState = async function (stateId) {
  return await this.findAll({
    where: {
      state_id: stateId,
      is_active: true
    },
    order: [['sort_order', 'ASC'], ['name', 'ASC']]
  });
};

// Static method to get zone by name in a state
Zone.getZoneByNameAndState = async function (zoneName, stateId) {
  return await this.findOne({
    where: {
      name: zoneName,
      state_id: stateId,
      is_active: true
    }
  });
};

module.exports = Zone; 