const { Sequelize } = require('sequelize');
require('dotenv').config();
async function clearDb() {
    try {
        console.log('Clearing database...');

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

        await sequelize.authenticate();
        console.log('Database connected successfully');
        await sequelize.getQueryInterface().dropTable('user_roles');
        console.log('User roles table dropped');
        await sequelize.getQueryInterface().dropTable('users');
        console.log('Users table dropped');
        process.exit(0);
    } catch (error) {
        console.error('Error clearing database:', error.message);
    }
}

clearDb();