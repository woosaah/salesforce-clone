import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/search
 * Global search across all objects
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, objects, limit = 20 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: q (search query)',
      });
    }

    // Use PostgreSQL full-text search with TSVECTOR
    let query = `
      SELECT
        si.record_id,
        si.object_name,
        si.searchable_text,
        od.data,
        ts_rank(si.searchable_text, plainto_tsquery('english', $1)) as rank
      FROM search_index si
      LEFT JOIN object_data od ON si.record_id = od.record_id
      WHERE si.searchable_text @@ plainto_tsquery('english', $1)
    `;

    const params: any[] = [q];
    let paramIndex = 2;

    // Filter by specific objects if provided
    if (objects && typeof objects === 'string') {
      const objectList = objects.split(',').map((o) => o.trim());
      query += ` AND si.object_name = ANY($${paramIndex}::text[])`;
      params.push(objectList);
      paramIndex++;
    }

    query += ` ORDER BY rank DESC, si.last_indexed DESC LIMIT $${paramIndex}`;
    params.push(Number(limit));

    const results = await queryWithTenant(query, params);

    res.json({
      success: true,
      query: q,
      count: results.length,
      data: results,
    });
  } catch (error: any) {
    console.error('Error performing search:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform search',
      error: error.message,
    });
  }
});

/**
 * POST /api/search/index
 * Index or reindex a record for search
 */
router.post('/index', async (req: Request, res: Response) => {
  try {
    const { record_id, object_name, searchable_text } = req.body;

    if (!record_id || !object_name || !searchable_text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: record_id, object_name, searchable_text',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO search_index (
        record_id,
        object_name,
        searchable_text
      ) VALUES ($1, $2, to_tsvector('english', $3))
      ON CONFLICT (record_id)
      DO UPDATE SET
        object_name = EXCLUDED.object_name,
        searchable_text = EXCLUDED.searchable_text,
        last_indexed = CURRENT_TIMESTAMP
      RETURNING *`,
      [record_id, object_name, searchable_text]
    );

    res.status(201).json({
      success: true,
      message: 'Record indexed successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error indexing record:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to index record',
      error: error.message,
    });
  }
});

/**
 * POST /api/search/index/bulk
 * Bulk index multiple records
 */
router.post('/index/bulk', async (req: Request, res: Response) => {
  try {
    const { records } = req.body;

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: records (array)',
      });
    }

    const results = [];
    for (const record of records) {
      try {
        const result = await queryWithTenant(
          `INSERT INTO search_index (record_id, object_name, searchable_text)
           VALUES ($1, $2, to_tsvector('english', $3))
           ON CONFLICT (record_id)
           DO UPDATE SET
             object_name = EXCLUDED.object_name,
             searchable_text = EXCLUDED.searchable_text,
             last_indexed = CURRENT_TIMESTAMP
           RETURNING *`,
          [record.record_id, record.object_name, record.searchable_text]
        );
        results.push({ record_id: record.record_id, success: true });
      } catch (error: any) {
        results.push({ record_id: record.record_id, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Indexed ${results.filter((r) => r.success).length} of ${records.length} records`,
      data: results,
    });
  } catch (error: any) {
    console.error('Error bulk indexing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bulk index records',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/search/index/:recordId
 * Remove a record from search index
 */
router.delete('/index/:recordId', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM search_index WHERE record_id = $1 RETURNING *`,
      [recordId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Record not found in search index',
      });
    }

    res.json({
      success: true,
      message: 'Record removed from search index',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error removing from index:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove from index',
      error: error.message,
    });
  }
});

/**
 * POST /api/search/reindex
 * Reindex all records for a tenant
 */
router.post('/reindex', async (req: Request, res: Response) => {
  try {
    const { object_name } = req.body;

    // Delete existing index for the object (or all objects)
    if (object_name) {
      await queryWithTenant(`DELETE FROM search_index WHERE object_name = $1`, [object_name]);
    } else {
      await queryWithTenant(`DELETE FROM search_index`, []);
    }

    // Get all records to reindex
    let query = `
      SELECT od.record_id, om.object_name, od.data
      FROM object_data od
      JOIN objects_meta om ON od.object_id = om.object_id
    `;

    if (object_name) {
      query += ` WHERE om.object_name = $1`;
    }

    const records = await queryWithTenant(
      query,
      object_name ? [object_name] : []
    );

    // Reindex each record
    let indexed = 0;
    for (const record of records) {
      try {
        // Combine all searchable fields into searchable text
        const searchableText = Object.values(record.data || {})
          .filter((val) => typeof val === 'string')
          .join(' ');

        await queryWithTenant(
          `INSERT INTO search_index (record_id, object_name, searchable_text)
           VALUES ($1, $2, to_tsvector('english', $3))`,
          [record.record_id, record.object_name, searchableText]
        );
        indexed++;
      } catch (error) {
        console.error(`Failed to index record ${record.record_id}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Reindexed ${indexed} of ${records.length} records`,
      object_name: object_name || 'all',
    });
  } catch (error: any) {
    console.error('Error reindexing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reindex records',
      error: error.message,
    });
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions based on partial query
 */
router.get('/suggestions', async (req: Request, res: Response) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: q',
      });
    }

    // Use prefix matching for suggestions
    const results = await queryWithTenant(
      `SELECT DISTINCT
        od.data->>'name' as suggestion,
        om.object_name
       FROM object_data od
       JOIN objects_meta om ON od.object_id = om.object_id
       WHERE od.data->>'name' ILIKE $1
       LIMIT $2`,
      [`${q}%`, Number(limit)]
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    console.error('Error fetching suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch suggestions',
      error: error.message,
    });
  }
});

export default router;
