import { pool, queryWithTenant } from '../config/database';

async function seedServiceCloud() {
  const client = await pool.connect();

  try {
    console.log('Starting Service Cloud seed...');

    // Get the demo tenant
    const tenantResult = await client.query(
      "SELECT tenant_id FROM tenants WHERE subdomain = 'demo' LIMIT 1"
    );

    if (tenantResult.rows.length === 0) {
      throw new Error('Demo tenant not found. Please run the main seed script first.');
    }

    const tenantId = tenantResult.rows[0].tenant_id;
    console.log(`Using tenant: ${tenantId}`);

    // Get demo user
    const userResult = await client.query(
      "SELECT user_id FROM users WHERE email = 'admin@demo.com' LIMIT 1"
    );
    const userId = userResult.rows[0].user_id;

    // Get some accounts for case association
    const accountsResult = await queryWithTenant(
      tenantId,
      "SELECT record_id FROM object_data WHERE object_name = 'Account' LIMIT 3",
      []
    );
    const accountIds = accountsResult.map((a: any) => a.record_id);

    // Get some contacts for case association
    const contactsResult = await queryWithTenant(
      tenantId,
      "SELECT record_id FROM object_data WHERE object_name = 'Contact' LIMIT 3",
      []
    );
    const contactIds = contactsResult.map((c: any) => c.record_id);

    // Get some assets for case association
    const assetsResult = await queryWithTenant(
      tenantId,
      'SELECT asset_id FROM assets LIMIT 2',
      []
    );
    const assetIds = assetsResult.map((a: any) => a.asset_id);

    console.log('Creating SLA policies...');

    // Create SLA policies
    const slaStandard = await queryWithTenant(
      tenantId,
      `INSERT INTO sla_policies (
        tenant_id, name, description, is_active,
        first_response_hours, resolution_hours_high, resolution_hours_medium,
        resolution_hours_low, business_hours_only
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING sla_policy_id`,
      [
        tenantId,
        'Standard Support',
        'Standard SLA for general support cases',
        true,
        4,  // 4 hours first response
        24, // 24 hours for high priority
        72, // 72 hours for medium
        120, // 120 hours for low
        true
      ]
    );

    const slaPremium = await queryWithTenant(
      tenantId,
      `INSERT INTO sla_policies (
        tenant_id, name, description, is_active,
        first_response_hours, resolution_hours_high, resolution_hours_medium,
        resolution_hours_low, business_hours_only
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING sla_policy_id`,
      [
        tenantId,
        'Premium Support',
        '24/7 premium support with faster response times',
        true,
        1,  // 1 hour first response
        8,  // 8 hours for high priority
        24, // 24 hours for medium
        48, // 48 hours for low
        false // 24/7 support
      ]
    );

    console.log('Creating escalation rules...');

    // Create escalation rules
    await queryWithTenant(
      tenantId,
      `INSERT INTO escalation_rules (
        tenant_id, name, is_active, criteria_json,
        escalate_after_hours, new_priority, assign_to_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenantId,
        'Escalate Unresolved High Priority',
        true,
        JSON.stringify({ priority: 'High', status: 'New' }),
        2, // Escalate after 2 hours
        'Critical',
        userId
      ]
    );

    await queryWithTenant(
      tenantId,
      `INSERT INTO escalation_rules (
        tenant_id, name, is_active, criteria_json,
        escalate_after_hours, new_priority, assign_to_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenantId,
        'Escalate Overdue Cases',
        true,
        JSON.stringify({ status: 'In Progress' }),
        48, // Escalate after 48 hours
        'High',
        userId
      ]
    );

    console.log('Creating service contracts...');

    // Create service contracts
    const contract1 = await queryWithTenant(
      tenantId,
      `INSERT INTO service_contracts (
        tenant_id, contract_number, account_id, contract_name,
        start_date, end_date, contract_term_months,
        sla_policy_id, support_level, status,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $11)
      RETURNING service_contract_id`,
      [
        tenantId,
        'SC-00001',
        accountIds[0] || null,
        'Premium Support Contract - Enterprise',
        '2025-01-01',
        '2025-12-31',
        12,
        slaPremium[0].sla_policy_id,
        'Premium',
        'Active',
        userId
      ]
    );

    const contract2 = await queryWithTenant(
      tenantId,
      `INSERT INTO service_contracts (
        tenant_id, contract_number, account_id, contract_name,
        start_date, end_date, contract_term_months,
        sla_policy_id, support_level, status,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $11)
      RETURNING service_contract_id`,
      [
        tenantId,
        'SC-00002',
        accountIds[1] || null,
        'Standard Support Contract',
        '2025-01-01',
        '2025-06-30',
        6,
        slaStandard[0].sla_policy_id,
        'Standard',
        'Active',
        userId
      ]
    );

    console.log('Creating queues...');

    // Create queues
    const queueSupport = await queryWithTenant(
      tenantId,
      `INSERT INTO queues (
        tenant_id, queue_name, description, object_type, is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING queue_id`,
      [
        tenantId,
        'General Support',
        'General customer support queue',
        'Case',
        true
      ]
    );

    const queueTechnical = await queryWithTenant(
      tenantId,
      `INSERT INTO queues (
        tenant_id, queue_name, description, object_type, is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING queue_id`,
      [
        tenantId,
        'Technical Support',
        'Technical issues and troubleshooting',
        'Case',
        true
      ]
    );

    // Add user to queues
    await queryWithTenant(
      tenantId,
      `INSERT INTO queue_members (queue_id, user_id)
      VALUES ($1, $2), ($3, $2)`,
      [queueSupport[0].queue_id, userId, queueTechnical[0].queue_id]
    );

    console.log('Creating knowledge articles...');

    // Create knowledge articles
    const article1 = await queryWithTenant(
      tenantId,
      `INSERT INTO knowledge_articles (
        tenant_id, article_number, title, summary, content,
        article_type, category, keywords, is_visible_in_portal,
        publish_status, version_number, published_date,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, $13)
      RETURNING article_id`,
      [
        tenantId,
        'KA-00001',
        'Getting Started with Bird Feed Products',
        'A comprehensive guide to our bird feed product line',
        `# Getting Started with Bird Feed Products

## Overview
Our premium bird feed products are designed to attract a variety of bird species to your backyard or commercial aviaries.

## Product Categories

### Canary Mix
- Premium blend for canaries and finches
- High protein content
- Contains millet, canary seed, and niger seed

### Wild Bird Mix
- Attracts a variety of wild bird species
- Suitable for all seasons
- Contains sunflower seeds, peanuts, and mixed grains

## Storage Instructions
- Keep in a cool, dry place
- Use airtight containers to prevent moisture
- Store away from direct sunlight

## Feeding Tips
1. Provide fresh water daily
2. Clean feeding areas regularly
3. Monitor consumption and adjust quantities accordingly

For more information, contact our support team.`,
        'How-To',
        'Products',
        'bird feed, canary, finch, wild birds, feeding',
        true,
        'Published',
        1,
        CURRENT_TIMESTAMP,
        userId
      ]
    );

    const article2 = await queryWithTenant(
      tenantId,
      `INSERT INTO knowledge_articles (
        tenant_id, article_number, title, summary, content,
        article_type, category, keywords, is_visible_in_portal,
        publish_status, version_number, published_date,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, $13)
      RETURNING article_id`,
      [
        tenantId,
        'KA-00002',
        'Troubleshooting Delivery Issues',
        'Steps to resolve common delivery problems',
        `# Troubleshooting Delivery Issues

## Common Issues

### Delayed Delivery
If your delivery is delayed:
1. Check your order status in the customer portal
2. Verify the shipping address
3. Contact support with your order number

### Missing Items
1. Review the packing slip
2. Check all packages received
3. Report missing items within 48 hours

### Damaged Products
1. Document damage with photos
2. Keep all packaging materials
3. File a claim within 24 hours

## Contact Information
- Email: support@demo.com
- Phone: 1-800-BIRDFEED
- Hours: Mon-Fri 9AM-5PM

## Resolution Time
Most delivery issues are resolved within 2-3 business days.`,
        'Troubleshooting',
        'Delivery',
        'delivery, shipping, damaged, missing items, tracking',
        true,
        'Published',
        1,
        CURRENT_TIMESTAMP,
        userId
      ]
    );

    const article3 = await queryWithTenant(
      tenantId,
      `INSERT INTO knowledge_articles (
        tenant_id, article_number, title, summary, content,
        article_type, category, keywords, is_visible_in_portal,
        publish_status, version_number,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $12)
      RETURNING article_id`,
      [
        tenantId,
        'KA-00003',
        'Return and Refund Policy',
        'Understanding our return and refund process',
        `# Return and Refund Policy

## Eligibility
- Products must be returned within 30 days
- Items must be unopened and in original packaging
- Perishable items cannot be returned

## Process
1. Contact customer service to initiate return
2. Receive return authorization number
3. Package items securely
4. Ship to our returns center

## Refund Timeline
- Refunds processed within 5-7 business days
- Original payment method will be credited
- Shipping costs are non-refundable

For questions, please contact our support team.`,
        'FAQ',
        'Returns',
        'return, refund, policy, exchange',
        true,
        'Draft',
        1,
        userId
      ]
    );

    // Add some votes to published articles
    await queryWithTenant(
      tenantId,
      `UPDATE knowledge_articles SET helpful_count = 15, not_helpful_count = 2, view_count = 127
      WHERE article_id = $1`,
      [article1[0].article_id]
    );

    await queryWithTenant(
      tenantId,
      `UPDATE knowledge_articles SET helpful_count = 8, not_helpful_count = 1, view_count = 54
      WHERE article_id = $1`,
      [article2[0].article_id]
    );

    console.log('Creating cases...');

    // Create cases
    const case1 = await queryWithTenant(
      tenantId,
      `INSERT INTO cases (
        tenant_id, case_number, subject, description,
        status, priority, origin, type,
        account_id, contact_id, asset_id,
        sla_policy_id, service_contract_id,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14, $14)
      RETURNING case_id`,
      [
        tenantId,
        'CASE-00001',
        'Incorrect product received in shipment',
        'Customer ordered Canary Mix but received Finch Mix instead. Need replacement order shipped ASAP.',
        'New',
        'High',
        'Phone',
        'Problem',
        accountIds[0] || null,
        contactIds[0] || null,
        null,
        slaStandard[0].sla_policy_id,
        contract2[0].service_contract_id,
        userId
      ]
    );

    const case2 = await queryWithTenant(
      tenantId,
      `INSERT INTO cases (
        tenant_id, case_number, subject, description,
        status, priority, origin, type,
        account_id, contact_id, asset_id,
        sla_policy_id, service_contract_id,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14, $14)
      RETURNING case_id`,
      [
        tenantId,
        'CASE-00002',
        'Equipment malfunction - Forklift not starting',
        'The forklift (Asset: ASSET-000001) won\'t start. Display shows error code E-42. Operations are halted.',
        'In Progress',
        'Critical',
        'Email',
        'Problem',
        accountIds[1] || null,
        contactIds[1] || null,
        assetIds[0] || null,
        slaPremium[0].sla_policy_id,
        contract1[0].service_contract_id,
        userId
      ]
    );

    const case3 = await queryWithTenant(
      tenantId,
      `INSERT INTO cases (
        tenant_id, case_number, subject, description,
        status, priority, origin, type,
        account_id, contact_id,
        sla_policy_id,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $12)
      RETURNING case_id`,
      [
        tenantId,
        'CASE-00003',
        'Question about bulk pricing',
        'Interested in purchasing 500kg of Wild Bird Mix monthly. What discounts are available?',
        'New',
        'Low',
        'Web',
        'Question',
        accountIds[2] || null,
        contactIds[2] || null,
        slaStandard[0].sla_policy_id,
        userId
      ]
    );

    const case4 = await queryWithTenant(
      tenantId,
      `INSERT INTO cases (
        tenant_id, case_number, subject, description,
        status, priority, origin, type, reason,
        account_id, contact_id,
        sla_policy_id, service_contract_id,
        closed_date, resolution,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16, $16)
      RETURNING case_id`,
      [
        tenantId,
        'CASE-00004',
        'Request product information sheet',
        'Need detailed nutritional information for all bird feed products for our website.',
        'Closed',
        'Medium',
        'Email',
        'Request',
        'Product Information',
        accountIds[0] || null,
        contactIds[0] || null,
        slaStandard[0].sla_policy_id,
        contract2[0].service_contract_id,
        new Date(),
        'Sent comprehensive product information sheets for all three product lines via email. Customer confirmed receipt and satisfaction.',
        userId
      ]
    );

    console.log('Creating case comments...');

    // Add comments to cases
    await queryWithTenant(
      tenantId,
      `INSERT INTO case_comments (
        case_id, comment, is_internal, created_by
      ) VALUES ($1, $2, $3, $4)`,
      [
        case1[0].case_id,
        'Verified order details. Original order was OPP-00001 for Canary Mix. Shipping error confirmed.',
        true,
        userId
      ]
    );

    await queryWithTenant(
      tenantId,
      `INSERT INTO case_comments (
        case_id, comment, is_internal, created_by
      ) VALUES ($1, $2, $3, $4)`,
      [
        case1[0].case_id,
        'Replacement order created and expedited shipping arranged. Estimated delivery: 2 business days.',
        false,
        userId
      ]
    );

    await queryWithTenant(
      tenantId,
      `INSERT INTO case_comments (
        case_id, comment, is_internal, created_by
      ) VALUES ($1, $2, $3, $4)`,
      [
        case2[0].case_id,
        'Error code E-42 indicates battery connection issue. Dispatched technician to site.',
        true,
        userId
      ]
    );

    await queryWithTenant(
      tenantId,
      `INSERT INTO case_comments (
        case_id, comment, is_internal, created_by
      ) VALUES ($1, $2, $3, $4)`,
      [
        case2[0].case_id,
        'Our technician is en route and should arrive within 2 hours to diagnose and repair the issue.',
        false,
        userId
      ]
    );

    await queryWithTenant(
      tenantId,
      `INSERT INTO case_comments (
        case_id, comment, is_internal, created_by
      ) VALUES ($1, $2, $3, $4)`,
      [
        case3[0].case_id,
        'For bulk orders over 400kg/month, we offer 15% discount. For 500kg, that would be 18% discount.',
        false,
        userId
      ]
    );

    console.log('Creating solutions...');

    // Create solutions
    const solution1 = await queryWithTenant(
      tenantId,
      `INSERT INTO solutions (
        tenant_id, solution_number, title, description,
        status, is_visible_in_portal,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING solution_id`,
      [
        tenantId,
        'SOL-00001',
        'Replace incorrect shipment',
        'Standard process for replacing incorrectly shipped products:\n1. Verify original order\n2. Create replacement order with expedited shipping\n3. Arrange pickup of incorrect items (optional)\n4. Update customer with tracking information',
        'Published',
        true,
        userId
      ]
    );

    const solution2 = await queryWithTenant(
      tenantId,
      `INSERT INTO solutions (
        tenant_id, solution_number, title, description,
        status, is_visible_in_portal,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING solution_id`,
      [
        tenantId,
        'SOL-00002',
        'Forklift Error Code E-42 Resolution',
        'Error code E-42 troubleshooting:\n1. Check battery connections and terminals\n2. Inspect wiring harness for damage\n3. Test battery voltage (should be 24V minimum)\n4. Clean corroded terminals\n5. If issue persists, replace battery connection module',
        'Published',
        false,
        userId
      ]
    );

    // Link solutions to cases
    await queryWithTenant(
      tenantId,
      `INSERT INTO case_solutions (case_id, solution_id, created_by)
      VALUES ($1, $2, $3)`,
      [case1[0].case_id, solution1[0].solution_id, userId]
    );

    await queryWithTenant(
      tenantId,
      `INSERT INTO case_solutions (case_id, solution_id, created_by)
      VALUES ($1, $2, $3)`,
      [case2[0].case_id, solution2[0].solution_id, userId]
    );

    console.log('Creating case milestones...');

    // Create case milestones for SLA tracking
    await queryWithTenant(
      tenantId,
      `INSERT INTO case_milestones (
        case_id, milestone_type, target_date, is_completed
      ) VALUES ($1, $2, $3, $4)`,
      [
        case1[0].case_id,
        'First Response',
        new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
        true
      ]
    );

    await queryWithTenant(
      tenantId,
      `INSERT INTO case_milestones (
        case_id, milestone_type, target_date, is_completed
      ) VALUES ($1, $2, $3, $4)`,
      [
        case1[0].case_id,
        'Resolution',
        new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        false
      ]
    );

    await queryWithTenant(
      tenantId,
      `INSERT INTO case_milestones (
        case_id, milestone_type, target_date, is_completed, completion_date
      ) VALUES ($1, $2, $3, $4, $5)`,
      [
        case2[0].case_id,
        'First Response',
        new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
        true,
        new Date()
      ]
    );

    await queryWithTenant(
      tenantId,
      `INSERT INTO case_milestones (
        case_id, milestone_type, target_date, is_completed
      ) VALUES ($1, $2, $3, $4)`,
      [
        case2[0].case_id,
        'Resolution',
        new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours from now
        false
      ]
    );

    console.log('✓ Service Cloud seed completed successfully!');
    console.log(`
Created:
- 2 SLA policies (Standard, Premium)
- 2 Escalation rules
- 2 Service contracts
- 2 Queues with members
- 3 Knowledge articles (2 published, 1 draft)
- 4 Cases (2 open, 1 closed, 1 in progress)
- 5 Case comments
- 2 Solutions
- 4 Case milestones
    `);

  } catch (error) {
    console.error('Error seeding Service Cloud:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  seedServiceCloud()
    .then(() => {
      console.log('Service Cloud seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Service Cloud seed script failed:', error);
      process.exit(1);
    });
}

export default seedServiceCloud;
