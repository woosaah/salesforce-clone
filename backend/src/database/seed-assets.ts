import { pool } from '../config/database';

async function seedAssets() {
  const client = await pool.connect();

  try {
    console.log('Starting asset seed data...');

    // Get tenant and user IDs
    const tenantResult = await client.query(
      "SELECT tenant_id FROM tenants WHERE subdomain = 'birdseed'"
    );

    if (tenantResult.rows.length === 0) {
      throw new Error('Bird Seed Business tenant not found. Run main seed first.');
    }

    const tenantId = tenantResult.rows[0].tenant_id;

    const userResult = await client.query(
      "SELECT user_id FROM users WHERE email = 'admin@birdseed.test' LIMIT 1"
    );

    if (userResult.rows.length === 0) {
      throw new Error('Admin user not found. Run main seed first.');
    }

    const userId = userResult.rows[0].user_id;

    // Get account IDs
    const account1 = await client.query(
      `SELECT record_id FROM object_data
       WHERE tenant_id = $1 AND object_name = 'Account' AND data->>'Name' = 'Sunny Bird Breeders'
       LIMIT 1`,
      [tenantId]
    );

    const account2 = await client.query(
      `SELECT record_id FROM object_data
       WHERE tenant_id = $1 AND object_name = 'Account' AND data->>'Name' = 'Pet Paradise Store'
       LIMIT 1`,
      [tenantId]
    );

    const account1Id = account1.rows[0]?.record_id;
    const account2Id = account2.rows[0]?.record_id;

    console.log('Creating assets...');

    // Asset 1: Forklift (In Use)
    const asset1 = await client.query(
      `INSERT INTO assets (
        tenant_id, asset_number, asset_name, description,
        asset_type, category, serial_number, model_number, manufacturer,
        account_id, status, condition,
        purchase_date, purchase_price, current_value,
        current_location, building,
        owner_id, created_by, modified_by
      ) VALUES (
        $1, 'ASSET-000001', 'Forklift FL-100', 'Electric forklift for warehouse operations',
        'Equipment', 'Material Handling', 'FL-2024-001', 'FL-100', 'Industrial Equipment Co',
        $2, 'In Use', 'Good',
        '2023-06-15', 25000.00, 22000.00,
        'Main Warehouse', 'Building A',
        $3, $3, $3
      ) RETURNING asset_id`,
      [tenantId, account1Id, userId]
    );
    const asset1Id = asset1.rows[0].asset_id;

    // Asset 2: Seed Storage Tank (Available)
    const asset2 = await client.query(
      `INSERT INTO assets (
        tenant_id, asset_number, asset_name, description,
        asset_type, category, serial_number, manufacturer,
        status, condition,
        purchase_date, purchase_price, current_value,
        current_location,
        owner_id, created_by, modified_by
      ) VALUES (
        $1, 'ASSET-000002', 'Storage Tank ST-500', '500-gallon seed storage tank',
        'Equipment', 'Storage', 'ST-2023-042', 'Tank Systems Ltd',
        'Available', 'Excellent',
        '2023-09-01', 8500.00, 7800.00,
        'Storage Facility',
        $2, $2, $2
      ) RETURNING asset_id`,
      [tenantId, userId]
    );
    const asset2Id = asset2.rows[0].asset_id;

    // Asset 3: Delivery Van (Under Maintenance)
    const asset3 = await client.query(
      `INSERT INTO assets (
        tenant_id, asset_number, asset_name, description,
        asset_type, category, serial_number, model_number, manufacturer,
        account_id, status, condition,
        purchase_date, purchase_price, current_value,
        current_location,
        owner_id, created_by, modified_by
      ) VALUES (
        $1, 'ASSET-000003', 'Delivery Van DV-01', 'Ford Transit delivery vehicle',
        'Vehicle', 'Transportation', 'VIN123456789', 'Transit 350', 'Ford',
        $2, 'Under Maintenance', 'Good',
        '2022-03-20', 35000.00, 28000.00,
        'Service Center',
        $3, $3, $3
      ) RETURNING asset_id`,
      [tenantId, account2Id, userId]
    );
    const asset3Id = asset3.rows[0].asset_id;

    // Create maintenance records
    console.log('Creating maintenance records...');

    // Maintenance for Forklift
    await client.query(
      `INSERT INTO maintenance_records (
        asset_id, tenant_id, record_number, maintenance_type,
        title, description, start_date, completion_date,
        status, work_performed, parts_cost, labor_cost, total_cost,
        performed_by_id, created_by, modified_by
      ) VALUES (
        $1, $2, 'MAINT-000001', 'Preventive',
        'Quarterly Inspection', 'Routine quarterly maintenance check',
        CURRENT_DATE - INTERVAL '30 days', CURRENT_DATE - INTERVAL '30 days',
        'Completed', 'Checked hydraulics, replaced oil, inspected forks',
        150.00, 200.00, 350.00,
        $3, $3, $3
      )`,
      [asset1Id, tenantId, userId]
    );

    // Maintenance for Delivery Van (current)
    await client.query(
      `INSERT INTO maintenance_records (
        asset_id, tenant_id, record_number, maintenance_type,
        title, description, start_date,
        status, work_performed, parts_cost, labor_cost, total_cost,
        performed_by_id, created_by, modified_by
      ) VALUES (
        $1, $2, 'MAINT-000002', 'Repair',
        'Brake Replacement', 'Replace front brake pads and rotors',
        CURRENT_DATE - INTERVAL '2 days',
        'In Progress', 'Removing old brake pads',
        450.00, 300.00, 750.00,
        $3, $3, $3
      )`,
      [asset3Id, tenantId, userId]
    );

    // Create asset transfer
    console.log('Creating asset transfer...');
    await client.query(
      `INSERT INTO asset_transfers (
        asset_id, tenant_id, transfer_number, transfer_date,
        transfer_type, from_account_id, to_account_id,
        from_location, to_location, reason, status,
        created_by
      ) VALUES (
        $1, $2, 'TRANS-000001', CURRENT_DATE - INTERVAL '60 days',
        'Account', $3, $4,
        'Warehouse A', 'Warehouse B', 'Relocated to optimize operations', 'Completed',
        $5
      )`,
      [asset1Id, tenantId, account2Id, account1Id, userId]
    );

    console.log('✓ Asset seed data created successfully!');
    console.log('✓ Created 3 assets: Forklift, Storage Tank, Delivery Van');
    console.log('✓ Created 2 maintenance records');
    console.log('✓ Created 1 transfer record');

  } catch (error) {
    console.error('Error seeding asset data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed function
seedAssets()
  .then(() => {
    console.log('Asset seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Asset seeding failed:', error);
    process.exit(1);
  });
