const { DataTypes } = require('sequelize');
const sequelize = require('../constants/database');

const Country = sequelize.define('Country', {
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
  phone_code: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
  },
}, {
  tableName: 'countries',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Static method to get all active countries
Country.getAllActiveCountries = async function () {
  return await this.findAll({
    where: { is_active: true },
    order: [['name', 'ASC']]
  });
};

// Static method to get country by name
Country.getCountryByName = async function (countryName) {
  return await this.findOne({
    where: {
      name: countryName,
      is_active: true
    }
  });
};

// Static method to initialize default countries
Country.initializeDefaultCountries = async function () {
  const defaultCountries = [
    { name: 'India', code: 'IN', phone_code: '+91', currency: 'INR' },
    { name: 'United States', code: 'US', phone_code: '+1', currency: 'USD' },
    { name: 'United Kingdom', code: 'GB', phone_code: '+44', currency: 'GBP' },
    { name: 'Canada', code: 'CA', phone_code: '+1', currency: 'CAD' },
    { name: 'Australia', code: 'AU', phone_code: '+61', currency: 'AUD' },
    { name: 'Germany', code: 'DE', phone_code: '+49', currency: 'EUR' },
    { name: 'France', code: 'FR', phone_code: '+33', currency: 'EUR' },
    { name: 'Japan', code: 'JP', phone_code: '+81', currency: 'JPY' },
    { name: 'China', code: 'CN', phone_code: '+86', currency: 'CNY' },
    { name: 'Brazil', code: 'BR', phone_code: '+55', currency: 'BRL' }
  ];

  for (const country of defaultCountries) {
    await this.findOrCreate({
      where: { name: country.name },
      defaults: country
    });
  }
};

module.exports = Country;
