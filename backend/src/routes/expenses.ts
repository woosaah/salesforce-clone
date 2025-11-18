import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all expense reports
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];
    if (status) {
      whereClause = 'AND er.status = $1';
      params.push(status);
    }

    const reports = await queryWithTenant(
      tenantId,
      `SELECT er.*, u.first_name, u.last_name
       FROM expense_reports er
       JOIN users u ON er.employee_id = u.user_id
       WHERE 1=1 ${whereClause}
       ORDER BY er.report_date DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: { expense_reports: reports, total: reports.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single expense report
router.get('/:reportId', async (req: AuthRequest, res: Response) => {
  try {
    const { reportId } = req.params;
    const tenantId = req.tenantId!;

    const reports = await queryWithTenant(
      tenantId,
      `SELECT er.*,
        COALESCE(jsonb_agg(jsonb_build_object(
          'expense_item_id', ei.expense_item_id, 'line_number', ei.line_number,
          'expense_date', ei.expense_date, 'description', ei.description,
          'amount', ei.amount, 'total_amount', ei.total_amount
        ) ORDER BY ei.line_number) FILTER (WHERE ei.expense_item_id IS NOT NULL), '[]') as expense_items
       FROM expense_reports er
       LEFT JOIN expense_line_items ei ON er.report_id = ei.report_id
       WHERE er.report_id = $1
       GROUP BY er.report_id`,
      [reportId]
    );

    if (reports.length === 0) {
      return res.status(404).json({ success: false, error: 'Report not found' });
    }

    res.json({ success: true, data: reports[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create expense report (simplified)
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { report_name, report_date, business_purpose } = req.body;

    const count = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM expense_reports WHERE tenant_id = $1',
      [tenantId]
    );
    const report_number = `EXP-${String(parseInt(count[0].count) + 1).padStart(6, '0')}`;

    const reports = await queryWithTenant(
      tenantId,
      `INSERT INTO expense_reports (
        tenant_id, report_number, report_name, report_date, business_purpose, status,
        employee_id, owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, 'Draft', $6, $6, $6, $6) RETURNING *`,
      [tenantId, report_number, report_name, report_date, business_purpose, userId]
    );

    res.status(201).json({ success: true, data: reports[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
