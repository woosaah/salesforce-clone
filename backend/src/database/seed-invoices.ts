import { pool } from '../config/database';

async function seedInvoices() {
  const client = await pool.connect();

  try {
    console.log('Starting invoice seed data...');

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

    const account3 = await client.query(
      `SELECT record_id FROM object_data
       WHERE tenant_id = $1 AND object_name = 'Account' AND data->>'Name' = 'Global Seeds Co'
       LIMIT 1`,
      [tenantId]
    );

    const account1Id = account1.rows[0]?.record_id;
    const account2Id = account2.rows[0]?.record_id;
    const account3Id = account3.rows[0]?.record_id;

    if (!account1Id || !account2Id || !account3Id) {
      throw new Error('Required accounts not found. Run main seed first.');
    }

    // Create invoice settings
    console.log('Creating invoice settings...');
    await client.query(
      `INSERT INTO invoice_settings (
        tenant_id, invoice_prefix, starting_number, next_invoice_number,
        default_payment_terms, default_tax_rate, tax_label, tax_number,
        company_name, company_address, company_phone, company_email, company_website
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (tenant_id) DO NOTHING`,
      [
        tenantId,
        'INV',
        1,
        4, // Next will be INV-00004
        'Net 30',
        15.00,
        'GST',
        '12-345-678',
        'Bird Seed Business Ltd',
        JSON.stringify({
          street: '123 Seed Street',
          city: 'Wellington',
          state: 'Wellington',
          postal_code: '6011',
          country: 'New Zealand',
        }),
        '+64 4 123 4567',
        'billing@birdseedbusiness.nz',
        'www.birdseedbusiness.nz',
      ]
    );

    // Invoice 1: Paid Invoice
    console.log('Creating Invoice 1 (Paid)...');
    const invoice1 = await client.query(
      `INSERT INTO invoices (
        tenant_id, invoice_number, account_id, invoice_date, due_date,
        sent_date, paid_date, payment_terms, status,
        subtotal, tax_rate, tax_amount, discount_amount, shipping_amount,
        total_amount, amount_paid, amount_due, currency_code,
        billing_address, notes, terms_and_conditions,
        owner_id, created_by, modified_by
      ) VALUES (
        $1, $2, $3, CURRENT_DATE - INTERVAL '45 days', CURRENT_DATE - INTERVAL '15 days',
        CURRENT_DATE - INTERVAL '44 days', CURRENT_DATE - INTERVAL '20 days', $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18, $18
      ) RETURNING invoice_id`,
      [
        tenantId,
        'INV-00001',
        account1Id,
        'Net 30',
        'Paid',
        1500.00,
        15.00,
        225.00,
        0,
        25.00,
        1750.00,
        1750.00,
        0,
        'NZD',
        JSON.stringify({
          street: '456 Breeder Lane',
          city: 'Auckland',
          postal_code: '1010',
          country: 'New Zealand',
        }),
        'Thank you for your business!',
        'Payment due within 30 days. Late payments may incur additional charges.',
        userId,
      ]
    );

    const invoice1Id = invoice1.rows[0].invoice_id;

    await client.query(
      `INSERT INTO invoice_line_items (invoice_id, line_number, description, quantity, unit_price, line_total)
       VALUES ($1, $2, $3, $4, $5, $6), ($1, $7, $8, $9, $10, $11)`,
      [
        invoice1Id,
        1,
        'Premium Sunflower Seeds - 25kg Bag',
        20,
        45.00,
        900.00,
        2,
        'Canary Mix - 10kg Bag',
        30,
        20.00,
        600.00,
      ]
    );

    await client.query(
      `INSERT INTO invoice_payments (
        invoice_id, tenant_id, payment_date, amount_paid, payment_method,
        reference_number, notes, processed_by
      ) VALUES ($1, $2, CURRENT_DATE - INTERVAL '20 days', $3, $4, $5, $6, $7)`,
      [
        invoice1Id,
        tenantId,
        1750.00,
        'Bank Transfer',
        'TXN-2024-001234',
        'Payment received in full',
        userId,
      ]
    );

    // Invoice 2: Partially Paid Invoice
    console.log('Creating Invoice 2 (Partially Paid)...');
    const invoice2 = await client.query(
      `INSERT INTO invoices (
        tenant_id, invoice_number, account_id, invoice_date, due_date,
        sent_date, payment_terms, status,
        subtotal, tax_rate, tax_amount, discount_amount, shipping_amount,
        total_amount, amount_paid, amount_due, currency_code,
        billing_address, notes,
        owner_id, created_by, modified_by
      ) VALUES (
        $1, $2, $3, CURRENT_DATE - INTERVAL '20 days', CURRENT_DATE + INTERVAL '10 days',
        CURRENT_DATE - INTERVAL '19 days', $4, $5,
        $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17, $17
      ) RETURNING invoice_id`,
      [
        tenantId,
        'INV-00002',
        account2Id,
        'Net 30',
        'Partially Paid',
        3200.00,
        15.00,
        480.00,
        200.00,
        50.00,
        3530.00,
        2000.00,
        1530.00,
        'NZD',
        JSON.stringify({
          street: '789 Paradise Road',
          city: 'Christchurch',
          postal_code: '8011',
          country: 'New Zealand',
        }),
        'Bulk order discount applied',
        userId,
      ]
    );

    const invoice2Id = invoice2.rows[0].invoice_id;

    await client.query(
      `INSERT INTO invoice_line_items (invoice_id, line_number, description, quantity, unit_price, discount_amount, line_total)
       VALUES
       ($1, $2, $3, $4, $5, $6, $7),
       ($1, $8, $9, $10, $11, $12, $13),
       ($1, $14, $15, $16, $17, $18, $19)`,
      [
        invoice2Id,
        1,
        'Wild Bird Mix - 20kg Bag',
        50,
        35.00,
        100.00,
        1650.00,
        2,
        'Premium Sunflower Seeds - 25kg Bag',
        20,
        45.00,
        100.00,
        800.00,
        3,
        'Bird Feeder - Deluxe Model',
        15,
        50.00,
        0,
        750.00,
      ]
    );

    await client.query(
      `INSERT INTO invoice_payments (
        invoice_id, tenant_id, payment_date, amount_paid, payment_method,
        reference_number, notes, processed_by
      ) VALUES ($1, $2, CURRENT_DATE - INTERVAL '15 days', $3, $4, $5, $6, $7)`,
      [
        invoice2Id,
        tenantId,
        2000.00,
        'Credit Card',
        'CC-4567',
        'Partial payment - balance to follow',
        userId,
      ]
    );

    // Invoice 3: Draft Invoice
    console.log('Creating Invoice 3 (Draft)...');
    const invoice3 = await client.query(
      `INSERT INTO invoices (
        tenant_id, invoice_number, account_id, invoice_date, due_date,
        payment_terms, status,
        subtotal, tax_rate, tax_amount, discount_amount, shipping_amount,
        total_amount, amount_paid, amount_due, currency_code,
        notes, owner_id, created_by, modified_by
      ) VALUES (
        $1, $2, $3, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
        $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, $16
      ) RETURNING invoice_id`,
      [
        tenantId,
        'INV-00003',
        account3Id,
        'Net 30',
        'Draft',
        850.00,
        15.00,
        127.50,
        0,
        15.00,
        992.50,
        0,
        992.50,
        'NZD',
        'Draft invoice - review before sending',
        userId,
      ]
    );

    const invoice3Id = invoice3.rows[0].invoice_id;

    await client.query(
      `INSERT INTO invoice_line_items (invoice_id, line_number, description, quantity, unit_price, line_total)
       VALUES ($1, $2, $3, $4, $5, $6), ($1, $7, $8, $9, $10, $11)`,
      [
        invoice3Id,
        1,
        'Organic Millet Seeds - 5kg Bag',
        25,
        18.00,
        450.00,
        2,
        'Canary Mix - 10kg Bag',
        20,
        20.00,
        400.00,
      ]
    );

    console.log('✓ Invoice seed data created successfully!');
    console.log('✓ Created 3 invoices: INV-00001 (Paid), INV-00002 (Partially Paid), INV-00003 (Draft)');
  } catch (error) {
    console.error('Error seeding invoice data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seed function
seedInvoices()
  .then(() => {
    console.log('Invoice seeding completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Invoice seeding failed:', error);
    process.exit(1);
  });
