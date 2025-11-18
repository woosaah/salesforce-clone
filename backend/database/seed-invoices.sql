-- Seed Invoicing Data for Bird Seed Business
-- Run after main seed.ts has executed

-- First, get the tenant_id and user_id
DO $$
DECLARE
  v_tenant_id UUID;
  v_admin_user_id UUID;
  v_account1_id UUID;
  v_account2_id UUID;
  v_account3_id UUID;
  v_contact1_id UUID;
  v_contact2_id UUID;
  v_invoice1_id UUID;
  v_invoice2_id UUID;
  v_invoice3_id UUID;
BEGIN
  -- Get tenant ID for Bird Seed Business
  SELECT tenant_id INTO v_tenant_id
  FROM tenants
  WHERE subdomain = 'birdseed';

  -- Get admin user ID
  SELECT user_id INTO v_admin_user_id
  FROM users
  WHERE email = 'admin@birdseed.test'
  LIMIT 1;

  -- Get account IDs (these should exist from main seed)
  SELECT record_id INTO v_account1_id
  FROM object_data
  WHERE tenant_id = v_tenant_id
    AND object_name = 'Account'
    AND data->>'Name' = 'Sunny Bird Breeders'
  LIMIT 1;

  SELECT record_id INTO v_account2_id
  FROM object_data
  WHERE tenant_id = v_tenant_id
    AND object_name = 'Account'
    AND data->>'Name' = 'Pet Paradise Store'
  LIMIT 1;

  SELECT record_id INTO v_account3_id
  FROM object_data
  WHERE tenant_id = v_tenant_id
    AND object_name = 'Account'
    AND data->>'Name' = 'Global Seeds Co'
  LIMIT 1;

  -- Get contact IDs
  SELECT record_id INTO v_contact1_id
  FROM object_data
  WHERE tenant_id = v_tenant_id
    AND object_name = 'Contact'
    AND data->>'LastName' = 'Johnson'
  LIMIT 1;

  SELECT record_id INTO v_contact2_id
  FROM object_data
  WHERE tenant_id = v_tenant_id
    AND object_name = 'Contact'
    AND data->>'LastName' = 'Williams'
  LIMIT 1;

  -- Create invoice settings for tenant
  INSERT INTO invoice_settings (
    tenant_id,
    invoice_prefix,
    starting_number,
    next_invoice_number,
    default_payment_terms,
    default_tax_rate,
    tax_label,
    tax_number,
    company_name,
    company_address,
    company_phone,
    company_email,
    company_website
  ) VALUES (
    v_tenant_id,
    'INV',
    1,
    4, -- Next will be INV-00004
    'Net 30',
    15.00,
    'GST',
    '12-345-678',
    'Bird Seed Business Ltd',
    jsonb_build_object(
      'street', '123 Seed Street',
      'city', 'Wellington',
      'state', 'Wellington',
      'postal_code', '6011',
      'country', 'New Zealand'
    ),
    '+64 4 123 4567',
    'billing@birdseedbusiness.nz',
    'www.birdseedbusiness.nz'
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Invoice 1: Paid Invoice
  INSERT INTO invoices (
    invoice_id,
    tenant_id,
    invoice_number,
    account_id,
    contact_id,
    invoice_date,
    due_date,
    sent_date,
    paid_date,
    payment_terms,
    status,
    subtotal,
    tax_rate,
    tax_amount,
    discount_amount,
    shipping_amount,
    total_amount,
    amount_paid,
    amount_due,
    currency_code,
    billing_address,
    notes,
    terms_and_conditions,
    owner_id,
    created_by,
    modified_by
  ) VALUES (
    uuid_generate_v4(),
    v_tenant_id,
    'INV-00001',
    v_account1_id,
    v_contact1_id,
    CURRENT_DATE - INTERVAL '45 days',
    CURRENT_DATE - INTERVAL '15 days',
    CURRENT_DATE - INTERVAL '44 days',
    CURRENT_DATE - INTERVAL '20 days',
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
    jsonb_build_object(
      'street', '456 Breeder Lane',
      'city', 'Auckland',
      'postal_code', '1010',
      'country', 'New Zealand'
    ),
    'Thank you for your business!',
    'Payment due within 30 days. Late payments may incur additional charges.',
    v_admin_user_id,
    v_admin_user_id,
    v_admin_user_id
  ) RETURNING invoice_id INTO v_invoice1_id;

  -- Line items for Invoice 1
  INSERT INTO invoice_line_items (invoice_id, line_number, description, quantity, unit_price, line_total)
  VALUES
    (v_invoice1_id, 1, 'Premium Sunflower Seeds - 25kg Bag', 20, 45.00, 900.00),
    (v_invoice1_id, 2, 'Canary Mix - 10kg Bag', 30, 20.00, 600.00);

  -- Payment for Invoice 1
  INSERT INTO invoice_payments (
    invoice_id,
    tenant_id,
    payment_date,
    amount_paid,
    payment_method,
    reference_number,
    notes,
    processed_by
  ) VALUES (
    v_invoice1_id,
    v_tenant_id,
    CURRENT_DATE - INTERVAL '20 days',
    1750.00,
    'Bank Transfer',
    'TXN-2024-001234',
    'Payment received in full',
    v_admin_user_id
  );

  -- Invoice 2: Partially Paid Invoice
  INSERT INTO invoices (
    invoice_id,
    tenant_id,
    invoice_number,
    account_id,
    contact_id,
    invoice_date,
    due_date,
    sent_date,
    payment_terms,
    status,
    subtotal,
    tax_rate,
    tax_amount,
    discount_amount,
    shipping_amount,
    total_amount,
    amount_paid,
    amount_due,
    currency_code,
    billing_address,
    notes,
    owner_id,
    created_by,
    modified_by
  ) VALUES (
    uuid_generate_v4(),
    v_tenant_id,
    'INV-00002',
    v_account2_id,
    v_contact2_id,
    CURRENT_DATE - INTERVAL '20 days',
    CURRENT_DATE + INTERVAL '10 days',
    CURRENT_DATE - INTERVAL '19 days',
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
    jsonb_build_object(
      'street', '789 Paradise Road',
      'city', 'Christchurch',
      'postal_code', '8011',
      'country', 'New Zealand'
    ),
    'Bulk order discount applied',
    v_admin_user_id,
    v_admin_user_id,
    v_admin_user_id
  ) RETURNING invoice_id INTO v_invoice2_id;

  -- Line items for Invoice 2
  INSERT INTO invoice_line_items (invoice_id, line_number, description, quantity, unit_price, discount_amount, line_total)
  VALUES
    (v_invoice2_id, 1, 'Wild Bird Mix - 20kg Bag', 50, 35.00, 100.00, 1650.00),
    (v_invoice2_id, 2, 'Premium Sunflower Seeds - 25kg Bag', 20, 45.00, 100.00, 800.00),
    (v_invoice2_id, 3, 'Bird Feeder - Deluxe Model', 15, 50.00, 0, 750.00);

  -- Partial payment for Invoice 2
  INSERT INTO invoice_payments (
    invoice_id,
    tenant_id,
    payment_date,
    amount_paid,
    payment_method,
    reference_number,
    notes,
    processed_by
  ) VALUES (
    v_invoice2_id,
    v_tenant_id,
    CURRENT_DATE - INTERVAL '15 days',
    2000.00,
    'Credit Card',
    'CC-4567',
    'Partial payment - balance to follow',
    v_admin_user_id
  );

  -- Invoice 3: Draft Invoice (not sent yet)
  INSERT INTO invoices (
    invoice_id,
    tenant_id,
    invoice_number,
    account_id,
    invoice_date,
    due_date,
    payment_terms,
    status,
    subtotal,
    tax_rate,
    tax_amount,
    discount_amount,
    shipping_amount,
    total_amount,
    amount_paid,
    amount_due,
    currency_code,
    notes,
    owner_id,
    created_by,
    modified_by
  ) VALUES (
    uuid_generate_v4(),
    v_tenant_id,
    'INV-00003',
    v_account3_id,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
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
    v_admin_user_id,
    v_admin_user_id,
    v_admin_user_id
  ) RETURNING invoice_id INTO v_invoice3_id;

  -- Line items for Invoice 3
  INSERT INTO invoice_line_items (invoice_id, line_number, description, quantity, unit_price, line_total)
  VALUES
    (v_invoice3_id, 1, 'Organic Millet Seeds - 5kg Bag', 25, 18.00, 450.00),
    (v_invoice3_id, 2, 'Canary Mix - 10kg Bag', 20, 20.00, 400.00);

  RAISE NOTICE 'Invoice seed data created successfully!';
  RAISE NOTICE 'Created 3 invoices: INV-00001 (Paid), INV-00002 (Partially Paid), INV-00003 (Draft)';

END $$;
