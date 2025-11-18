import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all dashboards
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { is_public } = req.query;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    let whereClause = ' AND (d.created_by = $1 OR d.is_public = true)';
    const params: any[] = [userId];

    if (is_public !== undefined) {
      whereClause += ' AND d.is_public = $' + (params.length + 1);
      params.push(is_public === 'true');
    }

    const dashboards = await queryWithTenant(
      tenantId,
      `SELECT d.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM dashboard_components dc WHERE dc.dashboard_id = d.dashboard_id) as component_count
       FROM dashboards d
       LEFT JOIN users u ON d.created_by = u.user_id
       WHERE 1=1 ${whereClause}
       ORDER BY d.modified_date DESC`,
      params
    );

    res.json({ success: true, data: dashboards });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single dashboard with components
router.get('/:dashboardId', async (req: AuthRequest, res: Response) => {
  try {
    const { dashboardId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const dashboards = await queryWithTenant(
      tenantId,
      `SELECT d.*,
        u.first_name || ' ' || u.last_name as created_by_name
       FROM dashboards d
       LEFT JOIN users u ON d.created_by = u.user_id
       WHERE d.dashboard_id = $1
         AND (d.created_by = $2 OR d.is_public = true)`,
      [dashboardId, userId]
    );

    if (dashboards.length === 0) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }

    // Get components
    const components = await queryWithTenant(
      tenantId,
      `SELECT dc.*,
        r.report_name,
        r.report_type,
        r.report_format,
        r.chart_type
       FROM dashboard_components dc
       LEFT JOIN reports r ON dc.report_id = r.report_id
       WHERE dc.dashboard_id = $1
       ORDER BY dc.position_row, dc.position_col`,
      [dashboardId]
    );

    res.json({
      success: true,
      data: {
        ...dashboards[0],
        components
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create dashboard
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      dashboard_name,
      description,
      layout_config,
      refresh_interval,
      is_public = false
    } = req.body;

    if (!dashboard_name) {
      return res.status(400).json({ success: false, error: 'Dashboard name is required' });
    }

    const dashboards = await queryWithTenant(
      tenantId,
      `INSERT INTO dashboards (
        tenant_id, dashboard_name, description, layout_config,
        refresh_interval, is_public, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING *`,
      [
        tenantId, dashboard_name, description,
        layout_config ? JSON.stringify(layout_config) : null,
        refresh_interval, is_public, userId
      ]
    );

    res.status(201).json({ success: true, data: dashboards[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update dashboard
router.put('/:dashboardId', async (req: AuthRequest, res: Response) => {
  try {
    const { dashboardId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM dashboards WHERE dashboard_id = $1',
      [dashboardId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only update your own dashboards' });
    }

    const dashboards = await queryWithTenant(
      tenantId,
      `UPDATE dashboards SET
        dashboard_name = COALESCE($1, dashboard_name),
        description = COALESCE($2, description),
        layout_config = COALESCE($3, layout_config),
        refresh_interval = COALESCE($4, refresh_interval),
        is_public = COALESCE($5, is_public),
        modified_by = $6,
        modified_date = CURRENT_TIMESTAMP
       WHERE dashboard_id = $7
       RETURNING *`,
      [
        updates.dashboard_name,
        updates.description,
        updates.layout_config ? JSON.stringify(updates.layout_config) : null,
        updates.refresh_interval,
        updates.is_public,
        userId,
        dashboardId
      ]
    );

    res.json({ success: true, data: dashboards[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete dashboard
router.delete('/:dashboardId', async (req: AuthRequest, res: Response) => {
  try {
    const { dashboardId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM dashboards WHERE dashboard_id = $1',
      [dashboardId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only delete your own dashboards' });
    }

    await queryWithTenant(
      tenantId,
      'DELETE FROM dashboards WHERE dashboard_id = $1',
      [dashboardId]
    );

    res.json({ success: true, message: 'Dashboard deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add component to dashboard
router.post('/:dashboardId/components', async (req: AuthRequest, res: Response) => {
  try {
    const { dashboardId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      report_id,
      component_type,
      component_title,
      position_row,
      position_col,
      width,
      height,
      config
    } = req.body;

    // Check dashboard ownership
    const dashboards = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM dashboards WHERE dashboard_id = $1',
      [dashboardId]
    );

    if (dashboards.length === 0) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }

    if (dashboards[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only add components to your own dashboards' });
    }

    if (!component_type || !component_title) {
      return res.status(400).json({ success: false, error: 'Component type and title are required' });
    }

    const components = await queryWithTenant(
      tenantId,
      `INSERT INTO dashboard_components (
        dashboard_id, report_id, component_type, component_title,
        position_row, position_col, width, height, config
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        dashboardId, report_id, component_type, component_title,
        position_row || 0, position_col || 0, width || 1, height || 1,
        config ? JSON.stringify(config) : null
      ]
    );

    res.status(201).json({ success: true, data: components[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update component
router.put('/:dashboardId/components/:componentId', async (req: AuthRequest, res: Response) => {
  try {
    const { dashboardId, componentId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    // Check dashboard ownership
    const dashboards = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM dashboards WHERE dashboard_id = $1',
      [dashboardId]
    );

    if (dashboards.length === 0) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }

    if (dashboards[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only update components in your own dashboards' });
    }

    const components = await queryWithTenant(
      tenantId,
      `UPDATE dashboard_components SET
        report_id = COALESCE($1, report_id),
        component_type = COALESCE($2, component_type),
        component_title = COALESCE($3, component_title),
        position_row = COALESCE($4, position_row),
        position_col = COALESCE($5, position_col),
        width = COALESCE($6, width),
        height = COALESCE($7, height),
        config = COALESCE($8, config)
       WHERE component_id = $9 AND dashboard_id = $10
       RETURNING *`,
      [
        updates.report_id,
        updates.component_type,
        updates.component_title,
        updates.position_row,
        updates.position_col,
        updates.width,
        updates.height,
        updates.config ? JSON.stringify(updates.config) : null,
        componentId,
        dashboardId
      ]
    );

    if (components.length === 0) {
      return res.status(404).json({ success: false, error: 'Component not found' });
    }

    res.json({ success: true, data: components[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete component
router.delete('/:dashboardId/components/:componentId', async (req: AuthRequest, res: Response) => {
  try {
    const { dashboardId, componentId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Check dashboard ownership
    const dashboards = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM dashboards WHERE dashboard_id = $1',
      [dashboardId]
    );

    if (dashboards.length === 0) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }

    if (dashboards[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only delete components from your own dashboards' });
    }

    const result = await queryWithTenant(
      tenantId,
      'DELETE FROM dashboard_components WHERE component_id = $1 AND dashboard_id = $2 RETURNING component_id',
      [componentId, dashboardId]
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Component not found' });
    }

    res.json({ success: true, message: 'Component deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute all reports in dashboard
router.post('/:dashboardId/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const { dashboardId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Check dashboard access
    const dashboards = await queryWithTenant(
      tenantId,
      'SELECT * FROM dashboards WHERE dashboard_id = $1 AND (created_by = $2 OR is_public = true)',
      [dashboardId, userId]
    );

    if (dashboards.length === 0) {
      return res.status(404).json({ success: false, error: 'Dashboard not found' });
    }

    // Get all components with reports
    const components = await queryWithTenant(
      tenantId,
      `SELECT dc.component_id, dc.report_id, r.*
       FROM dashboard_components dc
       JOIN reports r ON dc.report_id = r.report_id
       WHERE dc.dashboard_id = $1`,
      [dashboardId]
    );

    const results: any[] = [];

    // Execute each report
    for (const comp of components) {
      try {
        const columns = comp.columns || ['*'];
        const columnList = Array.isArray(columns) ? columns.join(', ') : '*';

        let sql = `SELECT ${columnList} FROM object_data WHERE object_type = $1`;
        const params: any[] = [comp.object_name];

        // Apply filters
        if (comp.filters && Array.isArray(comp.filters)) {
          comp.filters.forEach((filter: any) => {
            const paramIndex = params.length + 1;
            sql += ` AND data->>'${filter.field}' ${filter.operator} $${paramIndex}`;
            params.push(filter.value);
          });
        }

        // Apply limit
        if (comp.limit_rows) {
          sql += ` LIMIT $${params.length + 1}`;
          params.push(comp.limit_rows);
        }

        const data = await queryWithTenant(tenantId, sql, params);

        results.push({
          component_id: comp.component_id,
          report_id: comp.report_id,
          report_name: comp.report_name,
          data,
          rowCount: data.length
        });
      } catch (error: any) {
        results.push({
          component_id: comp.component_id,
          report_id: comp.report_id,
          report_name: comp.report_name,
          error: error.message
        });
      }
    }

    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
