import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/translations
 * Get all translations
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { language, key_name } = req.query;

    let query = `SELECT * FROM translations WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (language) {
      query += ` AND language = $${paramIndex}`;
      params.push(language);
      paramIndex++;
    }

    if (key_name) {
      query += ` AND key_name = $${paramIndex}`;
      params.push(key_name);
      paramIndex++;
    }

    query += ` ORDER BY language, key_name`;

    const translations = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: translations,
    });
  } catch (error: any) {
    console.error('Error fetching translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch translations',
      error: error.message,
    });
  }
});

/**
 * GET /api/translations/languages
 * Get all supported languages
 */
router.get('/languages', async (req: Request, res: Response) => {
  try {
    const languages = await queryWithTenant(
      `SELECT DISTINCT language, COUNT(*) as translation_count
       FROM translations
       GROUP BY language
       ORDER BY language`,
      []
    );

    res.json({
      success: true,
      data: languages,
    });
  } catch (error: any) {
    console.error('Error fetching languages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch languages',
      error: error.message,
    });
  }
});

/**
 * POST /api/translations
 * Create or update a translation
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { language, key_name, translated_value, description } = req.body;

    if (!language || !key_name || !translated_value) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: language, key_name, translated_value',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO translations (
        language,
        key_name,
        translated_value,
        description
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (language, key_name)
      DO UPDATE SET
        translated_value = EXCLUDED.translated_value,
        description = EXCLUDED.description,
        updated_date = CURRENT_TIMESTAMP
      RETURNING *`,
      [language, key_name, translated_value, description]
    );

    res.status(201).json({
      success: true,
      message: 'Translation saved successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error saving translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save translation',
      error: error.message,
    });
  }
});

/**
 * POST /api/translations/bulk
 * Bulk import translations
 */
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { translations } = req.body;

    if (!translations || !Array.isArray(translations)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: translations (array)',
      });
    }

    const results = [];
    for (const translation of translations) {
      try {
        const result = await queryWithTenant(
          `INSERT INTO translations (language, key_name, translated_value, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (language, key_name)
           DO UPDATE SET
             translated_value = EXCLUDED.translated_value,
             description = EXCLUDED.description,
             updated_date = CURRENT_TIMESTAMP
           RETURNING *`,
          [
            translation.language,
            translation.key_name,
            translation.translated_value,
            translation.description,
          ]
        );
        results.push({ success: true, key: translation.key_name });
      } catch (error: any) {
        results.push({ success: false, key: translation.key_name, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Imported ${results.filter((r) => r.success).length} of ${translations.length} translations`,
      data: results,
    });
  } catch (error: any) {
    console.error('Error bulk importing translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk import translations',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/translations/:id
 * Delete a translation
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM translations WHERE translation_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Translation not found',
      });
    }

    res.json({
      success: true,
      message: 'Translation deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting translation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete translation',
      error: error.message,
    });
  }
});

/**
 * GET /api/translations/export
 * Export translations for a language
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { language } = req.query;

    if (!language) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: language',
      });
    }

    const translations = await queryWithTenant(
      `SELECT key_name, translated_value, description
       FROM translations
       WHERE language = $1
       ORDER BY key_name`,
      [language]
    );

    // Convert to key-value format
    const exported = translations.reduce((acc: any, t: any) => {
      acc[t.key_name] = {
        value: t.translated_value,
        description: t.description,
      };
      return acc;
    }, {});

    res.json({
      success: true,
      language,
      translations: exported,
    });
  } catch (error: any) {
    console.error('Error exporting translations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export translations',
      error: error.message,
    });
  }
});

export default router;
