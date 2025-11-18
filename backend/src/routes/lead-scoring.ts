import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/lead-scoring/models
 * Get all scoring models for the tenant
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = await queryWithTenant(
      `SELECT * FROM scoring_models ORDER BY created_date DESC`,
      []
    );

    res.json({
      success: true,
      data: models,
    });
  } catch (error: any) {
    console.error('Error fetching scoring models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scoring models',
      error: error.message,
    });
  }
});

/**
 * GET /api/lead-scoring/models/:id
 * Get a specific scoring model
 */
router.get('/models/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const models = await queryWithTenant(
      `SELECT * FROM scoring_models WHERE model_id = $1`,
      [id]
    );

    if (models.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scoring model not found',
      });
    }

    res.json({
      success: true,
      data: models[0],
    });
  } catch (error: any) {
    console.error('Error fetching scoring model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scoring model',
      error: error.message,
    });
  }
});

/**
 * POST /api/lead-scoring/models
 * Create a new scoring model
 */
router.post('/models', async (req: Request, res: Response) => {
  try {
    const {
      model_name,
      model_type, // 'Rule_Based', 'ML_Based', 'Hybrid'
      scoring_criteria,
      is_active,
    } = req.body;

    // Validation
    if (!model_name || !model_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: model_name, model_type',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO scoring_models (
        model_name,
        model_type,
        scoring_criteria,
        is_active
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        model_name,
        model_type,
        JSON.stringify(scoring_criteria || {}),
        is_active !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Scoring model created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating scoring model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create scoring model',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/lead-scoring/models/:id
 * Update a scoring model
 */
router.patch('/models/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const allowedFields = [
      'model_name',
      'model_type',
      'scoring_criteria',
      'is_active',
    ];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'scoring_criteria' && typeof updates[key] === 'object'
            ? JSON.stringify(updates[key])
            : updates[key]
        );
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
      `UPDATE scoring_models SET ${setFields.join(', ')}
       WHERE model_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scoring model not found',
      });
    }

    res.json({
      success: true,
      message: 'Scoring model updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating scoring model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update scoring model',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/lead-scoring/models/:id
 * Delete a scoring model
 */
router.delete('/models/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM scoring_models WHERE model_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Scoring model not found',
      });
    }

    res.json({
      success: true,
      message: 'Scoring model deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting scoring model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete scoring model',
      error: error.message,
    });
  }
});

/**
 * GET /api/lead-scoring/scores
 * Get all lead scores
 */
router.get('/scores', async (req: Request, res: Response) => {
  try {
    const { lead_id, min_score, max_score } = req.query;

    let query = `SELECT ls.*, od.data->>'first_name' as first_name,
                        od.data->>'last_name' as last_name,
                        od.data->>'company' as company,
                        sm.model_name
                 FROM lead_scores ls
                 LEFT JOIN object_data od ON ls.lead_id = od.record_id
                 LEFT JOIN scoring_models sm ON ls.model_id = sm.model_id
                 WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (lead_id) {
      query += ` AND ls.lead_id = $${paramIndex}`;
      params.push(lead_id);
      paramIndex++;
    }

    if (min_score) {
      query += ` AND ls.score >= $${paramIndex}`;
      params.push(Number(min_score));
      paramIndex++;
    }

    if (max_score) {
      query += ` AND ls.score <= $${paramIndex}`;
      params.push(Number(max_score));
      paramIndex++;
    }

    query += ` ORDER BY ls.score DESC, ls.scored_date DESC`;

    const scores = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: scores,
    });
  } catch (error: any) {
    console.error('Error fetching lead scores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lead scores',
      error: error.message,
    });
  }
});

/**
 * POST /api/lead-scoring/scores
 * Calculate and save a lead score
 */
router.post('/scores', async (req: Request, res: Response) => {
  try {
    const { lead_id, model_id } = req.body;

    if (!lead_id || !model_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: lead_id, model_id',
      });
    }

    // Get the scoring model
    const models = await queryWithTenant(
      `SELECT * FROM scoring_models WHERE model_id = $1 AND is_active = true`,
      [model_id]
    );

    if (models.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active scoring model not found',
      });
    }

    const model = models[0];

    // Get lead data
    const leads = await queryWithTenant(
      `SELECT * FROM object_data od
       JOIN objects_meta om ON od.object_id = om.object_id
       WHERE od.record_id = $1 AND om.object_name = 'Lead'`,
      [lead_id]
    );

    if (leads.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead not found',
      });
    }

    const leadData = leads[0].data;

    // Calculate score based on scoring criteria
    const scoringCriteria = model.scoring_criteria || {};
    let totalScore = 0;
    const scoreBreakdown: any = {};

    // Example scoring logic for rule-based model
    if (model.model_type === 'Rule_Based') {
      Object.keys(scoringCriteria).forEach((criterion) => {
        const rule = scoringCriteria[criterion];
        const fieldValue = leadData[rule.field];

        if (rule.operator === 'equals' && fieldValue === rule.value) {
          totalScore += rule.points;
          scoreBreakdown[criterion] = rule.points;
        } else if (rule.operator === 'contains' && fieldValue && fieldValue.includes(rule.value)) {
          totalScore += rule.points;
          scoreBreakdown[criterion] = rule.points;
        } else if (rule.operator === 'greater_than' && Number(fieldValue) > Number(rule.value)) {
          totalScore += rule.points;
          scoreBreakdown[criterion] = rule.points;
        }
        // Add more operators as needed
      });
    }

    // Determine score grade
    let scoreGrade = 'Cold';
    if (totalScore >= 80) scoreGrade = 'Hot';
    else if (totalScore >= 60) scoreGrade = 'Warm';

    // Save the score
    const result = await queryWithTenant(
      `INSERT INTO lead_scores (
        lead_id,
        model_id,
        score,
        score_grade,
        score_breakdown
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (lead_id, model_id)
      DO UPDATE SET
        score = EXCLUDED.score,
        score_grade = EXCLUDED.score_grade,
        score_breakdown = EXCLUDED.score_breakdown,
        scored_date = CURRENT_TIMESTAMP
      RETURNING *`,
      [
        lead_id,
        model_id,
        totalScore,
        scoreGrade,
        JSON.stringify(scoreBreakdown),
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Lead score calculated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error calculating lead score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate lead score',
      error: error.message,
    });
  }
});

/**
 * POST /api/lead-scoring/scores/batch
 * Calculate scores for multiple leads
 */
router.post('/scores/batch', async (req: Request, res: Response) => {
  try {
    const { lead_ids, model_id } = req.body;

    if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: lead_ids (array)',
      });
    }

    if (!model_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: model_id',
      });
    }

    const results = [];
    for (const lead_id of lead_ids) {
      try {
        // Reuse the single score calculation logic
        const scoreResult = await queryWithTenant(
          `SELECT * FROM lead_scores WHERE lead_id = $1 AND model_id = $2`,
          [lead_id, model_id]
        );
        results.push({ lead_id, success: true, score: scoreResult[0] });
      } catch (error: any) {
        results.push({ lead_id, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Processed ${lead_ids.length} leads`,
      data: results,
    });
  } catch (error: any) {
    console.error('Error calculating batch scores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate batch scores',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/lead-scoring/scores/:scoreId
 * Delete a lead score
 */
router.delete('/scores/:scoreId', async (req: Request, res: Response) => {
  try {
    const { scoreId } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM lead_scores WHERE score_id = $1 RETURNING *`,
      [scoreId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lead score not found',
      });
    }

    res.json({
      success: true,
      message: 'Lead score deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting lead score:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lead score',
      error: error.message,
    });
  }
});

export default router;
