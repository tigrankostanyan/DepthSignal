import { Sequelize } from 'sequelize';
import mysql2 from 'mysql2';

let sequelizeInstance: Sequelize | null = null;

// Get sequelize
export function getSequelize(): Sequelize {
  if (!sequelizeInstance) {
    const {
      MYSQL_HOST,
      MYSQL_PORT,
      MYSQL_USER,
      MYSQL_PASSWORD,
      MYSQL_DATABASE,
      MYSQL_POOL_MAX = 20,
      MYSQL_POOL_MIN = 2,
    } = process.env;

    sequelizeInstance = new Sequelize({
      dialect: 'mysql',
      host: MYSQL_HOST || 'localhost',
      port: parseInt(MYSQL_PORT || '3306', 10),
      username: MYSQL_USER || 'root',
      password: MYSQL_PASSWORD || '',
      database: MYSQL_DATABASE || 'quantscreen_db',
      dialectModule: mysql2,
      logging: false,
      define: {
        underscored: true,
        timestamps: false,
        freezeTableName: true,
      },
      pool: {
        max: parseInt(String(MYSQL_POOL_MAX), 10) || 20,
        min: parseInt(String(MYSQL_POOL_MIN), 10) || 2,
        idle: 10000,
      },
    });
  }
  return sequelizeInstance;
}

// Init sequelize
export async function initSequelize(): Promise<void> {
  await getSequelize().authenticate();
}

// Close sequelize
export async function closeSequelize(): Promise<void> {
  if (sequelizeInstance) {
    await sequelizeInstance.close();
    sequelizeInstance = null;
  }
}

// Sequelize
export const sequelize = getSequelize();
