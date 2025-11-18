import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/einstein-predictions/models
 * Get prediction models
 */
router.get('/models', async (req: Request, res: Response) => {
  try {
    const { is_active } = req.query;

    let query = `SELECT * FROM prediction_models WHERE 1=1`;
    const params: any[] = [];

    if (is_active !== undefined) {
      query += ` AND is_active = $1`;
      params.push(is_active === 'true');
    }

    query += ` ORDER BY created_date DESC`;

    const models = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: models,
    });
  } catch (error: any) {
    console.error('Error fetching prediction models:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prediction models',
      error: error.message,
    });
  }
});

/**
 * GET /api/einstein-predictions/models/:id
 * Get a specific prediction model
 */
router.get('/models/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const models = await queryWithTenant(
      `SELECT * FROM prediction_models WHERE model_id = $1`,
      [id]
    );

    if (models.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Prediction model not found',
      });
    }

    res.json({
      success: true,
      data: models[0],
    });
  } catch (error: any) {
    console.error('Error fetching prediction model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prediction model',
      error: error.message,
    });
  }
});

/**
 * POST /api/einstein-predictions/models
 * Create a prediction model
 */
router.post('/models', async (req: Request, res: Response) => {
  try {
    const {
      model_name,
      prediction_type,
      target_object,
      target_field,
      features,
      training_data_filter,
    } = req.body;

    if (!model_name || !prediction_type || !target_object || !target_field) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: model_name, prediction_type, target_object, target_field',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO prediction_models (
        model_name,
        prediction_type,
        target_object,
        target_field,
        features,
        training_data_filter,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        model_name,
        prediction_type,
        target_object,
        target_field,
        JSON.stringify(features || []),
        JSON.stringify(training_data_filter || {}),
        'Draft',
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Prediction model created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating prediction model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create prediction model',
      error: error.message,
    });
  }
});

/**
 * POST /api/einstein-predictions/models/:id/train
 * Train a prediction model
 */
router.post('/models/:id/train', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Update model status to Training
    const result = await queryWithTenant(
      `UPDATE prediction_models
       SET status = 'Training',
           last_trained_date = CURRENT_TIMESTAMP
       WHERE model_id = $1
       RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Prediction model not found',
      });
    }

    // In a real implementation, this would trigger an async training job
    // For now, we'll just update the status

    setTimeout(async () => {
      // Simulate training completion
      await queryWithTenant(
        `UPDATE prediction_models SET status = 'Active' WHERE model_id = $1`,
        [id]
      );
    }, 1000);

    res.json({
      success: true,
      message: 'Model training started',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error training model:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to train model',
      error: error.message,
    });
  }
});

/**
 * POST /api/einstein-predictions/predict
 * Get a prediction for a record
 */
router.post('/predict', async (req: Request, res: Response) => {
  try {
    const { model_id, record_id, input_data } = req.body;

    if (!model_id || !record_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: model_id, record_id',
      });
    }

    // Get the model
    const models = await queryWithTenant(
      `SELECT * FROM prediction_models WHERE model_id = $1 AND status = 'Active'`,
      [model_id]
    );

    if (models.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active prediction model not found',
      });
    }

    const model = models[0];

    // In a real implementation, this would call a ML service
    // For now, we'll generate a mock prediction
    const prediction_score = Math.random() * 100;
    const confidence = Math.random() * 100;

    // Store the prediction
    const result = await queryWithTenant(
      `INSERT INTO prediction_results (
        model_id,
        record_id,
        prediction_score,
        confidence,
        prediction_details
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        model_id,
        record_id,
        prediction_score,
        confidence,
        JSON.stringify(input_data || {}),
      ]
    );

    res.json({
      success: true,
      message: 'Prediction generated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error generating prediction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate prediction',
      error: error.message,
    });
  }
});

/**
 * GET /api/einstein-predictions/results
 * Get prediction results
 */
router.get('/results', async (req: Request, res: Response) => {
  try {
    const { model_id, record_id } = req.query;

    let query = `
      SELECT pr.*,
             pm.model_name,
             pm.prediction_type
      FROM prediction_results pr
      JOIN prediction_models pm ON pr.model_id = pm.model_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (model_id) {
      query += ` AND pr.model_id = $${paramIndex}`;
      params.push(model_id);
      paramIndex++;
    }

    if (record_id) {
      query += ` AND pr.record_id = $${paramIndex}`;
      params.push(record_id);
      paramIndex++;
    }

    query += ` ORDER BY pr.predicted_date DESC LIMIT 100`;

    const results = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Error fetching prediction results:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch prediction results',
      error: error.message,
    });
  }
});

/**
 * GET /api/einstein-predictions/models/:id/performance
 * Get model performance metrics
 */
router.get('/models/:id/performance', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get model
    const models = await queryWithTenant(
      `SELECT * FROM prediction_models WHERE model_id = $1`,
      [id]
    );

    if (models.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Prediction model not found',
      });
    }

    // Get prediction statistics
    const stats = await queryWithTenant(
      `SELECT
        COUNT(*) as total_predictions,
        AVG(prediction_score) as avg_score,
        AVG(confidence) as avg_confidence
       FROM prediction_results
       WHERE model_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        model: models[0],
        performance: stats[0],
      },
    });
  } catch (error: any) {
    console.error('Error fetching model performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch model performance',
      error: error.message,
    });
  }
});

export default router;
