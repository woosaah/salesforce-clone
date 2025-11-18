import { query as db } from '../../src/config/database';
import bcrypt from 'bcryptjs';

export async function setupTestDB() {
  // Run migrations if needed
  console.log('Setting up test database...');
  // In a real setup, you'd create a separate test database
}

export async function cleanupTestDB() {
  // Clean up test data
  console.log('Cleaning up test database...');
}

export async function createTestTenant(name: string = 'Test Tenant') {
  const tenant = await db(
    `INSERT INTO tenants (tenant_name, subdomain, is_active)
     VALUES ($1, $2, true)
     RETURNING *`,
    [name, `test-${Date.now()}`]
  );

  // Create admin user for tenant
  const hashedPassword = await bcrypt.hash('password123', 10);
  const adminUser = await db(
    `INSERT INTO users (tenant_id, username, email, password_hash, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [tenant[0].tenant_id, 'admin', `admin@${tenant[0].subdomain}.test`, hashedPassword]
  );

  return {
    ...tenant[0],
    admin_user: adminUser[0],
  };
}

export async function deleteTestTenant(tenantId: string) {
  await db('DELETE FROM tenants WHERE tenant_id = $1', [tenantId]);
}

export async function createTestUser(tenantId: string, email: string, role?: string) {
  const hashedPassword = await bcrypt.hash('password123', 10);

  return await db(
    `INSERT INTO users (tenant_id, username, email, password_hash, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [tenantId, email.split('@')[0], email, hashedPassword]
  );
}

export async function getAuthToken(userId: string): Promise<string> {
  // In real tests, you'd generate a proper JWT token
  // For now, return a mock token
  return `mock-token-${userId}`;
}

export async function createTestRecord(
  tenantId: string,
  objectName: string,
  data: any,
  ownerId?: string
) {
  // Set tenant context
  await db(`SET app.current_tenant_id = '${tenantId}'`);

  // Get object
  const object = await db(
    `SELECT object_id FROM objects_meta WHERE tenant_id = $1 AND object_name = $2`,
    [tenantId, objectName]
  );

  if (!object.length) {
    throw new Error(`Object ${objectName} not found`);
  }

  // Create record
  return await db(
    `INSERT INTO object_data (tenant_id, object_id, data, owner_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [tenantId, object[0].object_id, JSON.stringify(data), ownerId]
  );
}

export async function resetDatabase() {
  // Truncate all tables (be careful with this!)
  const tables = [
    'object_data',
    'workflows',
    'users',
    'tenants',
    // Add more tables as needed
  ];

  for (const table of tables) {
    try {
      await db(`TRUNCATE TABLE ${table} CASCADE`);
    } catch (error) {
      console.error(`Error truncating ${table}:`, error);
    }
  }
}
