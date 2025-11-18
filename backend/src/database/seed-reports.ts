import { query } from '../config/database';

async function seedReports() {
  try {
    console.log('🌱 Seeding Reports & Dashboards data...');

    // Get demo tenant
    const tenantResult = await query('SELECT tenant_id FROM tenants LIMIT 1');
    if (tenantResult.length === 0) {
      console.error('❌ No tenant found. Please run base migrations and seeds first.');
      return;
    }
    const tenantId = tenantResult[0].tenant_id;

    // Get demo user
    const userResult = await query(
      'SELECT user_id FROM users WHERE tenant_id = $1 LIMIT 1',
      [tenantId]
    );
    if (userResult.length === 0) {
      console.error('❌ No user found for tenant.');
      return;
    }
    const userId = userResult[0].user_id;

    // Set tenant context
    await query(`SET app.current_tenant_id = '${tenantId}'`);

    // Create report folders
    console.log('  📁 Creating report folders...');
    const folders = await query(
      `INSERT INTO report_folders (tenant_id, folder_name, description, is_public, created_by, modified_by)
       VALUES
        ($1, 'Sales Reports', 'Sales performance and pipeline reports', true, $2, $2),
        ($1, 'Service Reports', 'Customer service and support reports', true, $2, $2),
        ($1, 'Financial Reports', 'Financial analysis and billing reports', true, $2, $2),
        ($1, 'Inventory Reports', 'Stock levels and warehouse reports', true, $2, $2),
        ($1, 'Marketing Reports', 'Campaign performance and ROI reports', true, $2, $2)
       RETURNING folder_id, folder_name`,
      [tenantId, userId]
    );

    const salesFolderId = folders.find((f: any) => f.folder_name === 'Sales Reports').folder_id;
    const serviceFolderId = folders.find((f: any) => f.folder_name === 'Service Reports').folder_id;
    const financialFolderId = folders.find((f: any) => f.folder_name === 'Financial Reports').folder_id;
    const inventoryFolderId = folders.find((f: any) => f.folder_name === 'Inventory Reports').folder_id;
    const marketingFolderId = folders.find((f: any) => f.folder_name === 'Marketing Reports').folder_id;

    console.log(`  ✅ Created ${folders.length} folders`);

    // Create reports
    console.log('  📊 Creating reports...');

    // 1. Sales Pipeline Report
    await query(
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type, report_format,
        columns, filters, sort_by, is_public, folder_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
      [
        tenantId,
        'Sales Pipeline by Stage',
        'Shows all opportunities grouped by stage',
        'Opportunity',
        'summary',
        'table',
        JSON.stringify(['opportunityName', 'amount', 'closeDate', 'stage']),
        JSON.stringify([]),
        JSON.stringify([{ field: 'amount', direction: 'DESC' }]),
        true,
        salesFolderId,
        userId
      ]
    );

    // 2. Won Opportunities Report
    await query(
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type, report_format,
        columns, filters, sort_by, is_public, folder_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
      [
        tenantId,
        'Won Opportunities This Quarter',
        'All closed-won opportunities in current quarter',
        'Opportunity',
        'tabular',
        'table',
        JSON.stringify(['opportunityName', 'amount', 'closeDate', 'accountName']),
        JSON.stringify([{ field: 'stage', operator: '=', value: 'Closed Won' }]),
        JSON.stringify([{ field: 'closeDate', direction: 'DESC' }]),
        true,
        salesFolderId,
        userId
      ]
    );

    // 3. Lead Conversion Report
    await query(
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type, report_format,
        chart_type, columns, is_public, folder_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
      [
        tenantId,
        'Lead Conversion by Source',
        'Lead conversion rates by source',
        'Lead',
        'summary',
        'chart',
        'bar',
        JSON.stringify(['leadSource', 'status']),
        true,
        salesFolderId,
        userId
      ]
    );

    // 4. Open Cases by Priority
    await query(
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type, report_format,
        chart_type, columns, filters, is_public, folder_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
      [
        tenantId,
        'Open Cases by Priority',
        'All open cases grouped by priority',
        'Case',
        'summary',
        'chart',
        'pie',
        JSON.stringify(['priority', 'status']),
        JSON.stringify([{ field: 'status', operator: '!=', value: 'Closed' }]),
        true,
        serviceFolderId,
        userId
      ]
    );

    // 5. Case Resolution Time Report
    await query(
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type, report_format,
        columns, filters, sort_by, is_public, folder_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
      [
        tenantId,
        'Case Resolution Time Analysis',
        'Average case resolution time by priority',
        'Case',
        'tabular',
        'table',
        JSON.stringify(['caseNumber', 'subject', 'priority', 'createdDate', 'closedDate']),
        JSON.stringify([{ field: 'status', operator: '=', value: 'Closed' }]),
        JSON.stringify([{ field: 'closedDate', direction: 'DESC' }]),
        true,
        serviceFolderId,
        userId
      ]
    );

    // 6. Top Products by Revenue
    await query(
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type, report_format,
        chart_type, columns, sort_by, limit_rows, is_public, folder_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
      [
        tenantId,
        'Top 10 Products by Revenue',
        'Best selling products by revenue',
        'Product',
        'summary',
        'chart',
        'bar',
        JSON.stringify(['productName', 'listPrice']),
        JSON.stringify([{ field: 'listPrice', direction: 'DESC' }]),
        10,
        true,
        financialFolderId,
        userId
      ]
    );

    // 7. Revenue Forecast Report
    await query(
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type, report_format,
        chart_type, columns, is_public, folder_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)`,
      [
        tenantId,
        'Monthly Revenue Forecast',
        'Forecasted revenue by month',
        'Opportunity',
        'summary',
        'chart',
        'line',
        JSON.stringify(['closeDate', 'amount']),
        true,
        financialFolderId,
        userId
      ]
    );

    // 8. Invoice Aging Report
    await query(
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type, report_format,
        columns, filters, sort_by, is_public, folder_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
      [
        tenantId,
        'Overdue Invoices',
        'All unpaid invoices past due date',
        'Invoice',
        'tabular',
        'table',
        JSON.stringify(['invoiceNumber', 'accountName', 'totalAmount', 'dueDate', 'status']),
        JSON.stringify([
          { field: 'status', operator: '!=', value: 'Paid' },
          { field: 'dueDate', operator: '<', value: 'TODAY()' }
        ]),
        JSON.stringify([{ field: 'dueDate', direction: 'ASC' }]),
        true,
        financialFolderId,
        userId
      ]
    );

    // 9. Low Stock Alert Report
    await query(
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type, report_format,
        columns, is_public, folder_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
      [
        tenantId,
        'Low Stock Alert',
        'Products below reorder point',
        'InventoryItem',
        'tabular',
        'table',
        JSON.stringify(['productName', 'warehouseName', 'quantityOnHand', 'reorderPoint', 'reorderQuantity']),
        true,
        inventoryFolderId,
        userId
      ]
    );

    // 10. Campaign ROI Report
    await query(
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type, report_format,
        chart_type, columns, sort_by, is_public, folder_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
      [
        tenantId,
        'Campaign ROI Analysis',
        'Marketing campaign return on investment',
        'Campaign',
        'tabular',
        'table',
        null,
        JSON.stringify(['campaignName', 'budgetedCost', 'actualCost', 'actualRevenue', 'status']),
        JSON.stringify([{ field: 'actualRevenue', direction: 'DESC' }]),
        true,
        marketingFolderId,
        userId
      ]
    );

    console.log('  ✅ Created 10 reports');

    // Create dashboards
    console.log('  📊 Creating dashboards...');

    // Get report IDs for dashboard components
    const reports = await query(
      'SELECT report_id, report_name FROM reports WHERE tenant_id = $1',
      [tenantId]
    );

    // Sales Overview Dashboard
    const salesDashboard = await query(
      `INSERT INTO dashboards (
        tenant_id, dashboard_name, description, refresh_interval, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $6)
      RETURNING dashboard_id`,
      [
        tenantId,
        'Sales Overview Dashboard',
        'Comprehensive view of sales performance',
        300, // 5 minutes
        true,
        userId
      ]
    );

    const salesDashboardId = salesDashboard[0].dashboard_id;

    // Add components to sales dashboard
    const pipelineReport = reports.find((r: any) => r.report_name === 'Sales Pipeline by Stage');
    const wonOppsReport = reports.find((r: any) => r.report_name === 'Won Opportunities This Quarter');
    const leadConversionReport = reports.find((r: any) => r.report_name === 'Lead Conversion by Source');

    if (pipelineReport) {
      await query(
        `INSERT INTO dashboard_components (
          dashboard_id, report_id, component_type, component_title,
          position_row, position_col, width, height
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [salesDashboardId, pipelineReport.report_id, 'chart', 'Sales Pipeline', 0, 0, 2, 1]
      );
    }

    if (leadConversionReport) {
      await query(
        `INSERT INTO dashboard_components (
          dashboard_id, report_id, component_type, component_title,
          position_row, position_col, width, height
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [salesDashboardId, leadConversionReport.report_id, 'chart', 'Lead Conversion', 0, 2, 2, 1]
      );
    }

    if (wonOppsReport) {
      await query(
        `INSERT INTO dashboard_components (
          dashboard_id, report_id, component_type, component_title,
          position_row, position_col, width, height
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [salesDashboardId, wonOppsReport.report_id, 'table', 'Recent Wins', 1, 0, 4, 1]
      );
    }

    // Service Metrics Dashboard
    const serviceDashboard = await query(
      `INSERT INTO dashboards (
        tenant_id, dashboard_name, description, refresh_interval, is_public,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $6)
      RETURNING dashboard_id`,
      [
        tenantId,
        'Service Metrics Dashboard',
        'Customer service performance metrics',
        300,
        true,
        userId
      ]
    );

    const serviceDashboardId = serviceDashboard[0].dashboard_id;

    const openCasesReport = reports.find((r: any) => r.report_name === 'Open Cases by Priority');
    const caseResolutionReport = reports.find((r: any) => r.report_name === 'Case Resolution Time Analysis');

    if (openCasesReport) {
      await query(
        `INSERT INTO dashboard_components (
          dashboard_id, report_id, component_type, component_title,
          position_row, position_col, width, height
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [serviceDashboardId, openCasesReport.report_id, 'chart', 'Open Cases by Priority', 0, 0, 2, 1]
      );
    }

    if (caseResolutionReport) {
      await query(
        `INSERT INTO dashboard_components (
          dashboard_id, report_id, component_type, component_title,
          position_row, position_col, width, height
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [serviceDashboardId, caseResolutionReport.report_id, 'table', 'Recent Resolutions', 1, 0, 4, 1]
      );
    }

    console.log('  ✅ Created 2 dashboards with components');

    console.log('✅ Reports & Dashboards seed data completed!');
  } catch (error) {
    console.error('❌ Error seeding Reports & Dashboards data:', error);
    throw error;
  }
}

// Run seeder
if (require.main === module) {
  seedReports()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default seedReports;
