import { pool } from '../config/database';

async function seedSales() {
  const client = await pool.connect();

  try {
    console.log('Starting sales cloud seed data...');

    const tenantResult = await client.query("SELECT tenant_id FROM tenants WHERE subdomain = 'birdseed'");
    if (tenantResult.rows.length === 0) {
      throw new Error('Bird Seed Business tenant not found. Run main seed first.');
    }
    const tenantId = tenantResult.rows[0].tenant_id;

    const userResult = await client.query("SELECT user_id FROM users WHERE email = 'admin@birdseed.test' LIMIT 1");
    if (userResult.rows.length === 0) {
      throw new Error('Admin user not found. Run main seed first.');
    }
    const userId = userResult.rows[0].user_id;

    // Create opportunity stages
    console.log('Creating opportunity stages...');
    const stages = [
      { name: 'Prospecting', order: 1, probability: 10, category: 'Pipeline', is_closed: false, is_won: false },
      { name: 'Qualification', order: 2, probability: 25, category: 'Pipeline', is_closed: false, is_won: false },
      { name: 'Needs Analysis', order: 3, probability: 40, category: 'Best Case', is_closed: false, is_won: false },
      { name: 'Proposal', order: 4, probability: 60, category: 'Best Case', is_closed: false, is_won: false },
      { name: 'Negotiation', order: 5, probability: 80, category: 'Commit', is_closed: false, is_won: false },
      { name: 'Closed Won', order: 6, probability: 100, category: 'Closed', is_closed: true, is_won: true },
      { name: 'Closed Lost', order: 7, probability: 0, category: 'Omitted', is_closed: true, is_won: false },
    ];

    for (const stage of stages) {
      await client.query(
        `INSERT INTO opportunity_stages (tenant_id, stage_name, stage_order, probability, forecast_category, is_closed, is_won)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id, stage_name) DO NOTHING`,
        [tenantId, stage.name, stage.order, stage.probability, stage.category, stage.is_closed, stage.is_won]
      );
    }

    // Create products
    console.log('Creating products...');
    const product1 = await client.query(
      `INSERT INTO products (tenant_id, product_code, product_name, description, product_family, standard_price, cost_price, is_active, created_by, modified_by)
       VALUES ($1, 'CM-20-P', 'Canary Mix Premium - 20kg', 'Premium blend for canaries', 'Bird Seed', 52.00, 35.00, true, $2, $2)
       RETURNING product_id`,
      [tenantId, userId]
    );

    const product2 = await client.query(
      `INSERT INTO products (tenant_id, product_code, product_name, description, product_family, standard_price, cost_price, is_active, created_by, modified_by)
       VALUES ($1, 'FM-20-S', 'Finch Mix Standard - 20kg', 'Standard finch seed mix', 'Bird Seed', 48.00, 32.00, true, $2, $2)
       RETURNING product_id`,
      [tenantId, userId]
    );

    const product3 = await client.query(
      `INSERT INTO products (tenant_id, product_code, product_name, description, product_family, standard_price, cost_price, is_active, created_by, modified_by)
       VALUES ($1, 'WB-20', 'Wild Bird Mix - 20kg', 'General wild bird seed', 'Bird Seed', 35.00, 24.00, true, $2, $2)
       RETURNING product_id`,
      [tenantId, userId]
    );

    // Create leads
    console.log('Creating sample leads...');
    await client.query(
      `INSERT INTO leads (tenant_id, lead_number, first_name, last_name, company, email, phone, status, rating, lead_source, owner_id, created_by, modified_by)
       VALUES
       ($1, 'LEAD-00001', 'John', 'Smith', 'Smith Family Aviaries', 'john@smithaviary.co.nz', '021 555 1234', 'New', 'Hot', 'Referral', $2, $2, $2),
       ($1, 'LEAD-00002', 'Sarah', 'Johnson', 'Pet Paradise Ltd', 'sarah@petparadise.co.nz', '021 555 5678', 'Contacted', 'Warm', 'Web', $2, $2, $2)`,
      [tenantId, userId]
    );

    // Get existing accounts
    const accounts = await client.query(
      `SELECT record_id, data->>'Name' as name FROM object_data WHERE tenant_id = $1 AND object_name = 'Account' LIMIT 2`,
      [tenantId]
    );

    if (accounts.rows.length >= 2) {
      // Create opportunities
      console.log('Creating sample opportunities...');
      const opp1 = await client.query(
        `INSERT INTO opportunities (tenant_id, opportunity_number, opportunity_name, account_id, amount, close_date, stage_name, probability, type, owner_id, created_by, modified_by)
         VALUES ($1, 'OPP-00001', 'Annual Supply Contract', $2, 15000.00, CURRENT_DATE + INTERVAL '30 days', 'Proposal', 60, 'New Business', $3, $3, $3)
         RETURNING opportunity_id`,
        [tenantId, accounts.rows[0].record_id, userId]
      );

      const opp2 = await client.query(
        `INSERT INTO opportunities (tenant_id, opportunity_number, opportunity_name, account_id, amount, close_date, stage_name, probability, type, owner_id, created_by, modified_by)
         VALUES ($1, 'OPP-00002', 'Wholesale Agreement', $2, 45000.00, CURRENT_DATE + INTERVAL '60 days', 'Negotiation', 80, 'New Business', $3, $3, $3)
         RETURNING opportunity_id`,
        [tenantId, accounts.rows[1].record_id, userId]
      );

      // Add products to opportunities
      console.log('Adding products to opportunities...');
      await client.query(
        `INSERT INTO opportunity_products (opportunity_id, product_id, line_number, quantity, unit_price, total_price)
         VALUES
         ($1, $2, 1, 50, 52.00, 2600.00),
         ($1, $3, 2, 30, 48.00, 1440.00)`,
        [opp1.rows[0].opportunity_id, product1.rows[0].product_id, product2.rows[0].product_id]
      );

      await client.query(
        `INSERT INTO opportunity_products (opportunity_id, product_id, line_number, quantity, unit_price, total_price)
         VALUES
         ($1, $2, 1, 100, 35.00, 3500.00),
         ($1, $3, 2, 50, 52.00, 2600.00)`,
        [opp2.rows[0].opportunity_id, product3.rows[0].product_id, product1.rows[0].product_id]
      );
    }

    console.log('✓ Sales Cloud seed data created successfully!');
    console.log('✓ Created 7 opportunity stages');
    console.log('✓ Created 3 products');
    console.log('✓ Created 2 leads');
    console.log('✓ Created 2 opportunities with products');

  } catch (error) {
    console.error('Error seeding sales data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedSales()
  .then(() => {
    console.log('Sales seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Sales seeding failed:', error);
    process.exit(1);
  });
