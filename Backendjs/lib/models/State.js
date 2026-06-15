const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');
const Country = require('./Country');

const State = sequelize.define('State', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  code: {
    type: DataTypes.STRING(10),
    allowNull: true,
    unique: true,
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
}, {
  tableName: 'states',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Static method to get states by country
State.getStatesByCountry = async function (countryId) {
  return await this.findAll({
    where: {
      country_id: countryId,
      is_active: true
    },
    order: [['name', 'ASC']]
  });
};

// Static method to get state by name
State.getStateByName = async function (stateName, countryId = null) {
  const whereClause = {
    name: stateName,
    is_active: true
  };

  if (countryId) {
    whereClause.country_id = countryId;
  }

  return await this.findOne({ where: whereClause });
};

State.initializeDefaultStates = async function () {
  const defaultStates = require('../../data/states.json');
  const country = await Country.getCountryByName('India');
  if (!country) {
    throw new Error('India country not found');
  }
  for (const state of defaultStates) {
    await this.findOrCreate({
      where: { name: state.name },
      defaults: {
        name: state.name,
        code: state.code,
        country_id: country.id,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
  }
};

module.exports = State; 