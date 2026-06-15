const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Cities = sequelize.define('Cities', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(211),
    allowNull: false,
  },
  state_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'states',
      key: 'id'
    }
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'cities',
  timestamps: false, // This table doesn't use standard timestamps
  indexes: [
    {
      unique: true,
      fields: ['name', 'state_id'],
      name: 'cities_name_state_unique'
    }
  ]
});

// Define associations
Cities.associate = function (models) {
  Cities.hasMany(models.Zone, {
    foreignKey: 'city_id',
    as: 'zones'
  });

  Cities.belongsTo(models.State, {
    foreignKey: 'state_id',
    as: 'state'
  });
};

// Static method to get cities by state with zones
Cities.getCitiesByStateWithZones = async function (stateId) {
  return await this.findAll({
    where: {
      state_id: stateId,
      is_active: true
    },
    include: [{
      model: sequelize.models.Zone,
      as: 'zones',
      where: { is_active: true },
      required: false
    }],
    order: [['name', 'ASC'], ['zones', 'sort_order', 'ASC']]
  });
};

// Static method to get cities by state
Cities.getCitiesByState = async function (stateId) {
  return await this.findAll({
    where: {
      state_id: stateId,
      is_active: true
    },
    order: [['name', 'ASC']]
  });
};

// Static method to get city by name
Cities.getCityByName = async function (cityName, stateId = null) {
  const whereClause = {
    name: cityName,
    is_active: true
  };

  if (stateId) {
    whereClause.state_id = stateId;
  }

  return await this.findOne({ where: whereClause });
};

// Static method to get city with zones
Cities.getCityWithZones = async function (cityId) {
  return await this.findOne({
    where: {
      id: cityId,
      is_active: true
    },
    include: [{
      model: sequelize.models.Zone,
      as: 'zones',
      where: { is_active: true },
      required: false
    }]
  });
};

// Static method to search cities by name (for auto-complete)
Cities.searchCities = async function (searchTerm, limit = 10) {
  return await this.findAll({
    where: {
      name: {
        [sequelize.Op.like]: `%${searchTerm}%`
      },
      is_active: true
    },
    limit: limit,
    order: [['name', 'ASC']]
  });
};

module.exports = Cities; 