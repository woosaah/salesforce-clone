import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'salesforce_clone',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
};

// Create connection pool
export const pool = new Pool(poolConfig);

// Test connection
pool.on('connect', () => {
  console.log('Database connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
  process.exit(-1);
});

// Helper function to execute queries with tenant context
export async function queryWithTenant<T = any>(
  tenantId: string,
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    // Set tenant context for RLS
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    // Reset tenant context
    await client.query(`RESET app.current_tenant_id`);
    client.release();
  }
}

// Helper function to execute queries without tenant context (for system operations)
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows;
}

// Helper function to begin transaction with tenant context
export async function getClientWithTenant(tenantId: string) {
  const client = await pool.connect();
  await client.query(`SET app.current_tenant_id = '${tenantId}'`);
  return client;
}

// Test database connection
export async function testConnection(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection test successful:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

export default pool;
