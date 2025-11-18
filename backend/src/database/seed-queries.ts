import { pool, queryWithTenant } from '../config/database';

async function seedQueries() {
  const client = await pool.connect();

  try {
    console.log('Starting Saved Queries seed...');

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

    console.log('Creating saved queries...');

    // Query 1: Hot Leads This Week
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Hot Leads This Week',
        'All hot-rated leads created in the current week',
        "SELECT Name, Company, Phone, Email, Rating, Status FROM Lead WHERE Rating = 'Hot' AND CreatedDate >= THIS_WEEK ORDER BY CreatedDate DESC",
        'Lead',
        true,
        userId
      ]
    );

    // Query 2: Open Opportunities Over $5K
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Open Opportunities Over $5K',
        'High-value open opportunities sorted by close date',
        "SELECT Name, Amount, CloseDate, StageName FROM Opportunity WHERE Amount > 5000 AND IsClosed = false ORDER BY CloseDate",
        'Opportunity',
        true,
        userId
      ]
    );

    // Query 3: Overdue Invoices
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Overdue Invoices',
        'All invoices past their due date that are still unpaid',
        "SELECT InvoiceNumber, TotalAmount, DueDate, Status FROM Invoice WHERE Status = 'Sent' AND DueDate < TODAY ORDER BY DueDate",
        'Invoice',
        true,
        userId
      ]
    );

    // Query 4: Cases Opened This Month
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Cases Opened This Month',
        'All customer support cases created in the current month',
        "SELECT CaseNumber, Subject, Priority, Status, CreatedDate FROM Case WHERE CreatedDate >= THIS_MONTH ORDER BY Priority DESC, CreatedDate DESC",
        'Case',
        true,
        userId
      ]
    );

    // Query 5: Top 10 Customers by Revenue
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Top 10 Customers by Revenue',
        'Top 10 accounts sorted by total revenue',
        "SELECT Name, TotalRevenue, Industry, AnnualRevenue FROM Account WHERE TotalRevenue > 0 ORDER BY TotalRevenue DESC LIMIT 10",
        'Account',
        true,
        userId
      ]
    );

    // Query 6: Assets Due for Maintenance
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Assets Due for Maintenance',
        'Assets with maintenance due in the next 30 days',
        "SELECT AssetName, SerialNumber, Status, NextMaintenanceDate FROM Asset WHERE NextMaintenanceDate <= TODAY + 30 AND Status = 'In Use' ORDER BY NextMaintenanceDate",
        'Asset',
        true,
        userId
      ]
    );

    // Query 7: Active Products
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Active Products',
        'All currently active products in the catalog',
        "SELECT ProductName, ProductCode, StandardPrice, ProductFamily, IsActive FROM Product WHERE IsActive = true ORDER BY ProductFamily, ProductName",
        'Product',
        true,
        userId
      ]
    );

    // Query 8: Closed Won Opportunities This Quarter
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Closed Won Opportunities This Quarter',
        'All opportunities won in the current quarter',
        "SELECT Name, Amount, CloseDate, StageName FROM Opportunity WHERE StageName = 'Closed Won' AND CloseDate >= THIS_QUARTER ORDER BY CloseDate DESC",
        'Opportunity',
        true,
        userId
      ]
    );

    // Query 9: High Priority Open Cases
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'High Priority Open Cases',
        'All high or critical priority cases that are still open',
        "SELECT CaseNumber, Subject, Priority, Status, CreatedDate FROM Case WHERE Priority IN ('High', 'Critical') AND Status != 'Closed' ORDER BY Priority DESC, CreatedDate",
        'Case',
        true,
        userId
      ]
    );

    // Query 10: Contacts Without Email
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Contacts Without Email',
        'Contacts that are missing email addresses',
        "SELECT FirstName, LastName, Phone, Title FROM Contact WHERE Email = NULL ORDER BY LastName, FirstName",
        'Contact',
        false, // Private query
        userId
      ]
    );

    // Query 11: Recently Modified Accounts
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Recently Modified Accounts',
        'Accounts modified in the last 7 days',
        "SELECT Name, Industry, Phone, ModifiedDate FROM Account WHERE ModifiedDate >= TODAY - 7 ORDER BY ModifiedDate DESC LIMIT 50",
        'Account',
        true,
        userId
      ]
    );

    // Query 12: Leads Ready for Conversion
    await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query, object_name, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [
        tenantId,
        'Leads Ready for Conversion',
        'Qualified leads that have not been converted yet',
        "SELECT Name, Company, Email, Rating, Status, LeadScore FROM Lead WHERE Status = 'Qualified' AND IsConverted = false AND Rating IN ('Hot', 'Warm') ORDER BY LeadScore DESC",
        'Lead',
        true,
        userId
      ]
    );

    console.log('Creating query favorites...');

    // Get some query IDs to favorite
    const queries = await queryWithTenant(
      tenantId,
      `SELECT saved_query_id FROM saved_queries WHERE query_name IN ('Hot Leads This Week', 'Overdue Invoices', 'Open Opportunities Over $5K') LIMIT 3`,
      []
    );

    // Add favorites for demo user
    for (const query of queries) {
      await queryWithTenant(
        tenantId,
        'INSERT INTO query_favorites (user_id, saved_query_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [userId, query.saved_query_id]
      );
    }

    console.log('✓ Saved Queries seed completed successfully!');
    console.log(`
Created:
- 12 Saved queries:
  * 11 public queries (visible to all users)
  * 1 private query
- 3 query favorites for demo user

Queries cover:
- Lead management and conversion tracking
- Opportunity pipeline monitoring
- Invoice and payment tracking
- Case management
- Asset maintenance scheduling
- Product catalog queries
- Customer analytics
    `);

  } catch (error) {
    console.error('Error seeding Saved Queries:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if called directly
if (require.main === module) {
  seedQueries()
    .then(() => {
      console.log('Saved Queries seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Saved Queries seed script failed:', error);
      process.exit(1);
    });
}

export default seedQueries;
