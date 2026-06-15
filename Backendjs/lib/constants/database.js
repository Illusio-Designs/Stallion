const { Sequelize } = require('sequelize');
require('dotenv').config();

// Index definitions: lib/constants/dbIndexes.js
// Applied idempotently on startup via DatabaseManager.syncIndexes()

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false, // Set to console.log to see SQL queries
    pool: {
      max: 10,
      min: 0,
      acquire: 60000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true, // Use snake_case for column names
      freezeTableName: true // Don't pluralize table names
    }
  }
);

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

//testConnection();

module.exports = sequelize; 