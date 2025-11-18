import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/forecasting/periods
 * Get all forecasting periods
 */
router.get('/periods', async (req: Request, res: Response) => {
  try {
    const { is_active } = req.query;

    let query = `SELECT * FROM forecast_periods WHERE 1=1`;
    const params: any[] = [];

    if (is_active !== undefined) {
      query += ` AND is_active = $1`;
      params.push(is_active === 'true');
    }

    query += ` ORDER BY start_date DESC`;

    const periods = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: periods,
    });
  } catch (error: any) {
    console.error('Error fetching forecast periods:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch forecast periods',
      error: error.message,
    });
  }
});

/**
 * GET /api/forecasting/periods/:id
 * Get a specific forecasting period
 */
router.get('/periods/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const periods = await queryWithTenant(
      `SELECT * FROM forecast_periods WHERE period_id = $1`,
      [id]
    );

    if (periods.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Forecast period not found',
      });
    }

    res.json({
      success: true,
      data: periods[0],
    });
  } catch (error: any) {
    console.error('Error fetching forecast period:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch forecast period',
      error: error.message,
    });
  }
});

/**
 * POST /api/forecasting/periods
 * Create a new forecasting period
 */
router.post('/periods', async (req: Request, res: Response) => {
  try {
    const { period_name, start_date, end_date, period_type, is_active } = req.body;

    if (!period_name || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: period_name, start_date, end_date',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO forecast_periods (
        period_name,
        start_date,
        end_date,
        period_type,
        is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        period_name,
        start_date,
        end_date,
        period_type || 'Monthly',
        is_active !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Forecast period created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating forecast period:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create forecast period',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/forecasting/periods/:id
 * Update a forecasting period
 */
router.patch('/periods/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['period_name', 'start_date', 'end_date', 'period_type', 'is_active'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (setFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(id);

    const result = await queryWithTenant(
      `UPDATE forecast_periods SET ${setFields.join(', ')}
       WHERE period_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Forecast period not found',
      });
    }

    res.json({
      success: true,
      message: 'Forecast period updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating forecast period:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update forecast period',
      error: error.message,
    });
  }
});

/**
 * GET /api/forecasting/items
 * Get forecast items
 */
router.get('/items', async (req: Request, res: Response) => {
  try {
    const { period_id, user_id } = req.query;

    let query = `
      SELECT fi.*,
             u.first_name || ' ' || u.last_name as owner_name,
             fp.period_name
      FROM forecast_items fi
      LEFT JOIN users u ON fi.owner_id = u.user_id
      LEFT JOIN forecast_periods fp ON fi.period_id = fp.period_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (period_id) {
      query += ` AND fi.period_id = $${paramIndex}`;
      params.push(period_id);
      paramIndex++;
    }

    if (user_id) {
      query += ` AND fi.owner_id = $${paramIndex}`;
      params.push(user_id);
      paramIndex++;
    }

    query += ` ORDER BY fi.created_date DESC`;

    const items = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: items,
    });
  } catch (error: any) {
    console.error('Error fetching forecast items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch forecast items',
      error: error.message,
    });
  }
});

/**
 * POST /api/forecasting/items
 * Create a forecast item
 */
router.post('/items', async (req: Request, res: Response) => {
  try {
    const {
      period_id,
      opportunity_id,
      forecast_category,
      forecast_amount,
      probability,
    } = req.body;

    if (!period_id || !opportunity_id || !forecast_category || !forecast_amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: period_id, opportunity_id, forecast_category, forecast_amount',
      });
    }

    const owner_id = (req as any).user.userId;

    const result = await queryWithTenant(
      `INSERT INTO forecast_items (
        period_id,
        owner_id,
        opportunity_id,
        forecast_category,
        forecast_amount,
        probability
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [period_id, owner_id, opportunity_id, forecast_category, forecast_amount, probability || 0]
    );

    res.status(201).json({
      success: true,
      message: 'Forecast item created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating forecast item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create forecast item',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/forecasting/items/:id
 * Update a forecast item
 */
router.patch('/items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['forecast_category', 'forecast_amount', 'probability'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (setFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(id);

    const result = await queryWithTenant(
      `UPDATE forecast_items SET ${setFields.join(', ')}
       WHERE forecast_item_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Forecast item not found',
      });
    }

    res.json({
      success: true,
      message: 'Forecast item updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating forecast item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update forecast item',
      error: error.message,
    });
  }
});

/**
 * GET /api/forecasting/summary
 * Get forecast summary for a period
 */
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { period_id } = req.query;

    if (!period_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: period_id',
      });
    }

    const summary = await queryWithTenant(
      `SELECT
        forecast_category,
        COUNT(*) as item_count,
        SUM(forecast_amount) as total_amount,
        AVG(probability) as avg_probability
       FROM forecast_items
       WHERE period_id = $1
       GROUP BY forecast_category
       ORDER BY forecast_category`,
      [period_id]
    );

    const total = await queryWithTenant(
      `SELECT
        COUNT(*) as total_items,
        SUM(forecast_amount) as total_forecast,
        SUM(forecast_amount * probability / 100) as weighted_forecast
       FROM forecast_items
       WHERE period_id = $1`,
      [period_id]
    );

    res.json({
      success: true,
      data: {
        by_category: summary,
        totals: total[0],
      },
    });
  } catch (error: any) {
    console.error('Error fetching forecast summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch forecast summary',
      error: error.message,
    });
  }
});

export default router;
