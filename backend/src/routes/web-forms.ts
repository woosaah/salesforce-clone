import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/web-forms
 * Get all web forms for the tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const forms = await queryWithTenant(
      `SELECT * FROM web_forms ORDER BY created_date DESC`,
      []
    );

    res.json({
      success: true,
      data: forms,
    });
  } catch (error: any) {
    console.error('Error fetching web forms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch web forms',
      error: error.message,
    });
  }
});

/**
 * GET /api/web-forms/:id
 * Get a specific web form
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const forms = await queryWithTenant(
      `SELECT * FROM web_forms WHERE form_id = $1`,
      [id]
    );

    if (forms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Web form not found',
      });
    }

    res.json({
      success: true,
      data: forms[0],
    });
  } catch (error: any) {
    console.error('Error fetching web form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch web form',
      error: error.message,
    });
  }
});

/**
 * POST /api/web-forms
 * Create a new web form
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      form_name,
      form_type, // 'Web_to_Lead', 'Web_to_Case', 'Web_to_Custom'
      target_object,
      field_mappings,
      return_url,
      is_active,
      enable_recaptcha,
      recaptcha_site_key,
    } = req.body;

    // Validation
    if (!form_name || !form_type || !target_object) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: form_name, form_type, target_object',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO web_forms (
        form_name,
        form_type,
        target_object,
        field_mappings,
        return_url,
        is_active,
        enable_recaptcha,
        recaptcha_site_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        form_name,
        form_type,
        target_object,
        JSON.stringify(field_mappings || {}),
        return_url,
        is_active !== false,
        enable_recaptcha || false,
        recaptcha_site_key,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Web form created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating web form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create web form',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/web-forms/:id
 * Update a web form
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const allowedFields = [
      'form_name',
      'form_type',
      'target_object',
      'field_mappings',
      'return_url',
      'is_active',
      'enable_recaptcha',
      'recaptcha_site_key',
    ];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'field_mappings' && typeof updates[key] === 'object'
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
      `UPDATE web_forms SET ${setFields.join(', ')}
       WHERE form_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Web form not found',
      });
    }

    res.json({
      success: true,
      message: 'Web form updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating web form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update web form',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/web-forms/:id
 * Delete a web form
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM web_forms WHERE form_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Web form not found',
      });
    }

    res.json({
      success: true,
      message: 'Web form deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting web form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete web form',
      error: error.message,
    });
  }
});

/**
 * GET /api/web-forms/:id/submissions
 * Get all submissions for a web form
 */
router.get('/:id/submissions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const submissions = await queryWithTenant(
      `SELECT * FROM web_form_submissions
       WHERE form_id = $1
       ORDER BY submitted_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: submissions,
    });
  } catch (error: any) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch submissions',
      error: error.message,
    });
  }
});

/**
 * POST /api/web-forms/:id/submit
 * Submit a web form (public endpoint - no auth required)
 */
router.post('/:id/submit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const formData = req.body;

    // Get form configuration
    const forms = await queryWithTenant(
      `SELECT * FROM web_forms WHERE form_id = $1 AND is_active = true`,
      [id]
    );

    if (forms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Web form not found or inactive',
      });
    }

    const form = forms[0];

    // Validate reCAPTCHA if enabled
    if (form.enable_recaptcha && !formData.recaptcha_token) {
      return res.status(400).json({
        success: false,
        message: 'reCAPTCHA verification required',
      });
    }

    // Store submission
    const submission = await queryWithTenant(
      `INSERT INTO web_form_submissions (
        form_id,
        submission_data,
        source_ip,
        user_agent
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        id,
        JSON.stringify(formData),
        req.ip,
        req.get('user-agent'),
      ]
    );

    // Map form data to target object
    const fieldMappings = form.field_mappings || {};
    const recordData: any = {};

    Object.keys(fieldMappings).forEach((formField) => {
      const targetField = fieldMappings[formField];
      if (formData[formField]) {
        recordData[targetField] = formData[formField];
      }
    });

    // Create record in target object
    // Get object_id for target object
    const objects = await queryWithTenant(
      `SELECT object_id FROM objects_meta WHERE object_name = $1`,
      [form.target_object]
    );

    if (objects.length > 0) {
      await queryWithTenant(
        `INSERT INTO object_data (object_id, data)
         VALUES ($1, $2)`,
        [objects[0].object_id, JSON.stringify(recordData)]
      );
    }

    res.json({
      success: true,
      message: 'Form submitted successfully',
      redirect_url: form.return_url,
      data: submission[0],
    });
  } catch (error: any) {
    console.error('Error submitting web form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit form',
      error: error.message,
    });
  }
});

export default router;
