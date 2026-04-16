import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool: mysql.Pool | null = null;

export const getDb = () => {
  if (!pool) {
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_NAME) {
      console.warn('MySQL environment variables missing. Database operations may fail.');
      return null;
    }

    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }
  return pool;
};

export const query = async (sql: string, params?: any[]) => {
  const db = getDb();
  if (!db) throw new Error('Database connection not initialized');
  const [results] = await db.execute(sql, params);
  return results;
};
