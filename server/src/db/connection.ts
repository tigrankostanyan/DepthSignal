// ==========================================
// SEQUELIZE DATABASE INSTANCE & CONNECTION CONFIG
// MySQL Connection Pool & Dialect Setup
// ==========================================

import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '3306', 10);
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'quantscreen_db';
const MYSQL_LOGGING = process.env.MYSQL_LOGGING === 'true';

export const sequelize = new Sequelize(MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD, {
  host: MYSQL_HOST,
  port: MYSQL_PORT,
  dialect: 'mysql',
  logging: MYSQL_LOGGING ? console.log : false,
  pool: {
    max: parseInt(process.env.MYSQL_POOL_MAX || '20', 10),
    min: parseInt(process.env.MYSQL_POOL_MIN || '2', 10),
    acquire: 30000,
    idle: 10000
  },
  define: {
    timestamps: true,
    underscored: true
  }
});

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await sequelize.authenticate();
    console.log('[Sequelize] Successfully connected to MySQL database.');
    return true;
  } catch (error: any) {
    console.warn('[Sequelize] MySQL connection failed or MySQL is offline:', error.message);
    return false;
  }
}

export async function syncDatabase(force: boolean = false): Promise<void> {
  try {
    await sequelize.sync({ force, alter: !force });
    console.log('[Sequelize] Database models synchronized with MySQL.');
  } catch (error: any) {
    console.warn('[Sequelize] MySQL sync error:', error.message);
  }
}
