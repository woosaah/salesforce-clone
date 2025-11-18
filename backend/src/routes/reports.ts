import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all reports
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { folder_id, object_name, is_public } = req.query;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    let whereClause = '';
    const params: any[] = [];

    // Users can see their own reports or public reports
    whereClause += ' AND (r.created_by = $' + (params.length + 1) + ' OR r.is_public = true)';
    params.push(userId);

    if (folder_id) {
      whereClause += ' AND r.folder_id = $' + (params.length + 1);
      params.push(folder_id);
    }
    if (object_name) {
      whereClause += ' AND r.object_name = $' + (params.length + 1);
      params.push(object_name);
    }
    if (is_public !== undefined) {
      whereClause += ' AND r.is_public = $' + (params.length + 1);
      params.push(is_public === 'true');
    }

    const reports = await queryWithTenant(
      tenantId,
      `SELECT r.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        rf.folder_name
       FROM reports r
       LEFT JOIN users u ON r.created_by = u.user_id
       LEFT JOIN report_folders rf ON r.folder_id = rf.folder_id
       WHERE 1=1 ${whereClause}
       ORDER BY r.modified_date DESC`,
      params
    );

    res.json({ success: true, data: reports });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single report
router.get('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const reports = await queryWithTenant(
      tenantId,
      `SELECT r.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        rf.folder_name
       FROM reports r
       LEFT JOIN users u ON r.created_by = u.user_id
       LEFT JOIN report_folders rf ON r.folder_id = rf.folder_id
       WHERE r.report_id = $1
         AND (r.created_by = $2 OR r.is_public = true)`,
      [reportId, userId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    res.json({ success: true, data: reports[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create report
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      report_name,
      description,
      object_name,
      report_type = 'tabular',
      report_format = 'table',
      chart_type,
      columns,
      filters,
      group_by,
      aggregate_functions,
      sort_by,
      limit_rows,
      is_public = false,
      folder_id
    } = req.body;

    if (!report_name || !object_name) {
      return res.status(400).json({ success: false, error: 'Report name and object name are required' });
    }

    const reports = await queryWithTenant(
      tenantId,
      `INSERT INTO reports (
        tenant_id, report_name, description, object_name, report_type,
        report_format, chart_type, columns, filters, group_by,
        aggregate_functions, sort_by, limit_rows, is_public, folder_id,
        created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
      RETURNING *`,
      [
        tenantId, report_name, description, object_name, report_type,
        report_format, chart_type, JSON.stringify(columns), JSON.stringify(filters),
        JSON.stringify(group_by), JSON.stringify(aggregate_functions),
        JSON.stringify(sort_by), limit_rows, is_public, folder_id, userId
      ]
    );

    res.status(201).json({ success: true, data: reports[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update report
router.put('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM reports WHERE report_id = $1',
      [reportId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only update your own reports' });
    }

    const reports = await queryWithTenant(
      tenantId,
      `UPDATE reports SET
        report_name = COALESCE($1, report_name),
        description = COALESCE($2, description),
        object_name = COALESCE($3, object_name),
        report_type = COALESCE($4, report_type),
        report_format = COALESCE($5, report_format),
        chart_type = COALESCE($6, chart_type),
        columns = COALESCE($7, columns),
        filters = COALESCE($8, filters),
        group_by = COALESCE($9, group_by),
        aggregate_functions = COALESCE($10, aggregate_functions),
        sort_by = COALESCE($11, sort_by),
        limit_rows = COALESCE($12, limit_rows),
        is_public = COALESCE($13, is_public),
        folder_id = COALESCE($14, folder_id),
        modified_by = $15,
        modified_date = CURRENT_TIMESTAMP
       WHERE report_id = $16
       RETURNING *`,
      [
        updates.report_name, updates.description, updates.object_name,
        updates.report_type, updates.report_format, updates.chart_type,
        updates.columns ? JSON.stringify(updates.columns) : null,
        updates.filters ? JSON.stringify(updates.filters) : null,
        updates.group_by ? JSON.stringify(updates.group_by) : null,
        updates.aggregate_functions ? JSON.stringify(updates.aggregate_functions) : null,
        updates.sort_by ? JSON.stringify(updates.sort_by) : null,
        updates.limit_rows, updates.is_public, updates.folder_id,
        userId, reportId
      ]
    );

    res.json({ success: true, data: reports[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute report
router.post('/:reportId/execute', async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const reports = await queryWithTenant(
      tenantId,
      `SELECT * FROM reports
       WHERE report_id = $1
         AND (created_by = $2 OR is_public = true)`,
      [reportId, userId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    const report = reports[0];
    const startTime = Date.now();

    try {
      // Build SQL query based on report configuration
      const columns = report.columns || ['*'];
      const columnList = Array.isArray(columns) ? columns.join(', ') : '*';

      let sql = `SELECT ${columnList} FROM object_data WHERE object_type = $1`;
      const params: any[] = [report.object_name];

      // Apply filters
      if (report.filters && Array.isArray(report.filters)) {
        report.filters.forEach((filter: any, index: number) => {
          const paramIndex = params.length + 1;
          sql += ` AND data->>'${filter.field}' ${filter.operator} $${paramIndex}`;
          params.push(filter.value);
        });
      }

      // Apply grouping
      if (report.group_by && Array.isArray(report.group_by) && report.group_by.length > 0) {
        sql += ` GROUP BY ${report.group_by.join(', ')}`;
      }

      // Apply sorting
      if (report.sort_by && Array.isArray(report.sort_by) && report.sort_by.length > 0) {
        const sortClauses = report.sort_by.map((sort: any) =>
          `${sort.field} ${sort.direction || 'ASC'}`
        );
        sql += ` ORDER BY ${sortClauses.join(', ')}`;
      }

      // Apply limit
      if (report.limit_rows) {
        sql += ` LIMIT $${params.length + 1}`;
        params.push(report.limit_rows);
      }

      // Execute query
      const results = await queryWithTenant(tenantId, sql, params);
      const executionTime = Date.now() - startTime;

      // Create snapshot
      await queryWithTenant(
        tenantId,
        `INSERT INTO report_snapshots (
          tenant_id, report_id, snapshot_data, row_count, execution_time_ms, generated_by
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, reportId, JSON.stringify(results), results.length, executionTime, userId]
      );

      res.json({
        success: true,
        data: {
          records: results,
          rowCount: results.length,
          executionTime,
          report: {
            report_id: report.report_id,
            report_name: report.report_name,
            object_name: report.object_name,
            report_type: report.report_type,
            report_format: report.report_format,
            chart_type: report.chart_type
          }
        }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message || 'Report execution failed'
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete report
router.delete('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM reports WHERE report_id = $1',
      [reportId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only delete your own reports' });
    }

    await queryWithTenant(
      tenantId,
      'DELETE FROM reports WHERE report_id = $1',
      [reportId]
    );

    res.json({ success: true, message: 'Report deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get report snapshots
router.get('/:reportId/snapshots', async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const { limit = 10 } = req.query;
    const tenantId = req.tenantId!;

    const snapshots = await queryWithTenant(
      tenantId,
      `SELECT rs.snapshot_id, rs.row_count, rs.execution_time_ms, rs.generated_date,
        u.first_name || ' ' || u.last_name as generated_by_name
       FROM report_snapshots rs
       LEFT JOIN users u ON rs.generated_by = u.user_id
       WHERE rs.report_id = $1
       ORDER BY rs.generated_date DESC
       LIMIT $2`,
      [reportId, limit]
    );

    res.json({ success: true, data: snapshots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get report snapshot data
router.get('/:reportId/snapshots/:snapshotId', async (req: AuthRequest, res: Response) => {
  try {
    const { reportId, snapshotId } = req.params;
    const tenantId = req.tenantId!;

    const snapshots = await queryWithTenant(
      tenantId,
      'SELECT * FROM report_snapshots WHERE snapshot_id = $1 AND report_id = $2',
      [snapshotId, reportId]
    );

    if (snapshots.length === 0) {
      return res.status(404).json({ success: false, error: 'Snapshot not found' });
    }

    res.json({ success: true, data: snapshots[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
