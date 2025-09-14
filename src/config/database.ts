import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/brillprime_db';

// PostgreSQL connection configuration
const client = postgres(connectionString, {
  prepare: false,
  max: 10, // Maximum number of connections in the pool
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
  onnotice: () => {}, // Disable notices
});

export const db = drizzle(client, { schema });

// Test database connection
export const testConnection = async () => {
  try {
    await client`SELECT 1`;
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Graceful shutdown
export const closeConnection = async () => {
  try {
    await client.end();
    console.log('🔌 Database connection closed');
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
};

export default db;