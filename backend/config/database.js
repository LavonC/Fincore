const { Sequelize } = require('sequelize');
require('dotenv').config();

// MySQL database configuration
const sequelize = new Sequelize(
  process.env.DB_NAME || 'dbms_project',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    dialect: 'mysql',
    port: process.env.DB_PORT || 3306,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false
  }
);

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to MySQL database successfully.');
  } catch (error) {
    console.error('Unable to connect to MySQL database:', error);
  }
};

testConnection();

module.exports = sequelize;