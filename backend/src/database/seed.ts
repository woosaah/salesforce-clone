import { pool } from '../config/database';
import { hashPassword } from '../utils/password';

async function seedDatabase() {
  console.log('Starting database seeding...');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if demo tenant already exists
    const existingTenant = await client.query(
      "SELECT * FROM tenants WHERE subdomain = 'birdseed'"
    );

    if (existingTenant.rows.length > 0) {
      console.log('Demo tenant already exists. Skipping seed.');
      await client.query('ROLLBACK');
      return;
    }

    console.log('Creating demo tenant: Bird Seed Business...');

    // Create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (tenant_name, subdomain, subscription_tier, enabled_modules)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      ['Bird Seed Business', 'birdseed', 'professional', JSON.stringify(['sales', 'service', 'products'])]
    );
    const tenant = tenantResult.rows[0];
    const tenantId = tenant.tenant_id;

    console.log(`✓ Tenant created: ${tenant.tenant_name} (${tenant.subdomain})`);

    // Create System Administrator profile
    const adminProfileResult = await client.query(
      `INSERT INTO profiles (tenant_id, profile_name, is_system, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, 'System Administrator', true, 'Full system access with all permissions']
    );
    const adminProfile = adminProfileResult.rows[0];

    console.log(`✓ Profile created: ${adminProfile.profile_name}`);

    // Create Standard User profile
    const standardProfileResult = await client.query(
      `INSERT INTO profiles (tenant_id, profile_name, is_system, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, 'Standard User', true, 'Standard user with limited permissions']
    );
    const standardProfile = standardProfileResult.rows[0];

    console.log(`✓ Profile created: ${standardProfile.profile_name}`);

    // Create roles
    const ceoRoleResult = await client.query(
      `INSERT INTO roles (tenant_id, role_name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [tenantId, 'CEO', 'Chief Executive Officer - highest level access']
    );
    const ceoRole = ceoRoleResult.rows[0];

    const salesManagerRoleResult = await client.query(
      `INSERT INTO roles (tenant_id, role_name, parent_role_id, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, 'Sales Manager', ceoRole.role_id, 'Manages sales team']
    );
    const salesManagerRole = salesManagerRoleResult.rows[0];

    const salesRepRoleResult = await client.query(
      `INSERT INTO roles (tenant_id, role_name, parent_role_id, description)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, 'Sales Representative', salesManagerRole.role_id, 'Sales team member']
    );

    console.log(`✓ Roles created: CEO, Sales Manager, Sales Representative`);

    // Hash password for admin user
    const passwordHash = await hashPassword('admin123');

    // Create admin user
    const adminUserResult = await client.query(
      `INSERT INTO users (tenant_id, username, email, password_hash, first_name, last_name, profile_id, role_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        'admin',
        'admin@birdseed.test',
        passwordHash,
        'Admin',
        'User',
        adminProfile.profile_id,
        ceoRole.role_id,
        true,
      ]
    );
    const adminUser = adminUserResult.rows[0];

    console.log(`✓ Admin user created: ${adminUser.email}`);

    // Create standard objects metadata
    const standardObjects = [
      { name: 'Account', label: 'Account', plural: 'Accounts', description: 'Business accounts and customers' },
      { name: 'Contact', label: 'Contact', plural: 'Contacts', description: 'Individual contacts and people' },
      { name: 'Asset', label: 'Asset', plural: 'Assets', description: 'Customer assets and equipment' },
      { name: 'Product', label: 'Product', plural: 'Products', description: 'Products and services' },
    ];

    console.log('Creating standard objects...');

    for (const obj of standardObjects) {
      // Create object metadata
      const objectResult = await client.query(
        `INSERT INTO objects_meta (tenant_id, object_name, label, plural_label, is_custom, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [tenantId, obj.name, obj.label, obj.plural, false, obj.description, adminUser.user_id]
      );
      const objectMeta = objectResult.rows[0];

      console.log(`  ✓ Object created: ${obj.name}`);

      // Create master record type for each object
      await client.query(
        `INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default, is_master)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [tenantId, obj.name, 'Master', `${obj.name}_Master`, 'Master record type with all fields', true, true, true]
      );

      console.log(`    ✓ Master record type created for ${obj.name}`);

      // Create standard fields for each object
      const standardFields = [
        { name: 'Name', label: 'Name', type: 'text', required: true },
        { name: 'Description', label: 'Description', type: 'textarea', required: false },
        { name: 'Status', label: 'Status', type: 'picklist', required: false,
          picklist: [
            { label: 'Active', value: 'active', is_default: true },
            { label: 'Inactive', value: 'inactive' }
          ]
        },
      ];

      // Add object-specific fields
      if (obj.name === 'Account') {
        standardFields.push(
          { name: 'Industry', label: 'Industry', type: 'picklist', required: false,
            picklist: [
              { label: 'Agriculture', value: 'agriculture' },
              { label: 'Technology', value: 'technology' },
              { label: 'Retail', value: 'retail' },
              { label: 'Healthcare', value: 'healthcare' },
            ]
          },
          { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency', required: false },
          { name: 'Phone', label: 'Phone', type: 'phone', required: false },
          { name: 'Website', label: 'Website', type: 'url', required: false }
        );
      } else if (obj.name === 'Contact') {
        standardFields.push(
          { name: 'Email', label: 'Email', type: 'email', required: false },
          { name: 'Phone', label: 'Phone', type: 'phone', required: false },
          { name: 'Title', label: 'Title', type: 'text', required: false }
        );
      } else if (obj.name === 'Product') {
        standardFields.push(
          { name: 'Price', label: 'Price', type: 'currency', required: false },
          { name: 'ProductCode', label: 'Product Code', type: 'text', required: false },
          { name: 'IsActive', label: 'Is Active', type: 'checkbox', required: false }
        );
      } else if (obj.name === 'Asset') {
        standardFields.push(
          { name: 'SerialNumber', label: 'Serial Number', type: 'text', required: false },
          { name: 'PurchaseDate', label: 'Purchase Date', type: 'date', required: false },
          { name: 'Quantity', label: 'Quantity', type: 'number', required: false }
        );
      }

      for (const field of standardFields) {
        await client.query(
          `INSERT INTO fields_meta (tenant_id, object_id, field_name, label, field_type, is_required, picklist_values)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            tenantId,
            objectMeta.object_id,
            field.name,
            field.label,
            field.type,
            field.required,
            field.picklist ? JSON.stringify(field.picklist) : null,
          ]
        );
      }

      console.log(`    ✓ Created ${standardFields.length} fields for ${obj.name}`);

      // Add full object permissions for admin profile
      await client.query(
        `INSERT INTO object_permissions (tenant_id, profile_id, object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [tenantId, adminProfile.profile_id, obj.name, true, true, true, true, true, true]
      );

      // Add read-only permissions for standard user profile
      await client.query(
        `INSERT INTO object_permissions (tenant_id, profile_id, object_name, can_read, can_create, can_edit, can_delete, can_view_all, can_modify_all)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [tenantId, standardProfile.profile_id, obj.name, true, false, false, false, false, false]
      );
    }

    console.log('✓ Object permissions created');

    // Create some sample data
    console.log('Creating sample records...');

    // Get Account object_id
    const accountObject = await client.query(
      "SELECT object_id FROM objects_meta WHERE tenant_id = $1 AND object_name = 'Account'",
      [tenantId]
    );
    const accountObjectId = accountObject.rows[0].object_id;

    // Create sample accounts
    const sampleAccounts = [
      { Name: 'Acme Corporation', Industry: 'technology', AnnualRevenue: 5000000, Status: 'active', Description: 'Leading tech company' },
      { Name: 'Bird Feeders Inc', Industry: 'agriculture', AnnualRevenue: 1200000, Status: 'active', Description: 'Premium bird feeding solutions' },
      { Name: 'Global Seeds Ltd', Industry: 'agriculture', AnnualRevenue: 2500000, Status: 'active', Description: 'Wholesale seed distributor' },
    ];

    for (const account of sampleAccounts) {
      await client.query(
        `INSERT INTO object_data (tenant_id, object_id, data, owner_id, created_by, modified_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, accountObjectId, JSON.stringify(account), adminUser.user_id, adminUser.user_id, adminUser.user_id]
      );
    }

    console.log(`✓ Created ${sampleAccounts.length} sample accounts`);

    await client.query('COMMIT');

    console.log(`
╔════════════════════════════════════════════════════╗
║          Database Seeding Completed! ✓             ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  Demo Tenant: Bird Seed Business                  ║
║  Subdomain: birdseed                               ║
║                                                    ║
║  Admin Login:                                      ║
║    Email: admin@birdseed.test                      ║
║    Password: admin123                              ║
║                                                    ║
║  Standard Objects Created:                         ║
║    • Account (3 sample records)                    ║
║    • Contact                                       ║
║    • Asset                                         ║
║    • Product                                       ║
║                                                    ║
╚════════════════════════════════════════════════════╝
    `);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run seeding if this script is executed directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('Seeding process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding process failed:', error);
      process.exit(1);
    });
}

export default seedDatabase;
