import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';
import { parseSOQL } from '../utils/soql-parser';
import { translateSOQL } from '../utils/soql-translator';

const router = Router();
router.use(authenticate);

// Get all saved queries
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { is_public, object_name, created_by } = req.query;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    let whereClause = '';
    const params: any[] = [];

    // Users can see their own queries or public queries
    whereClause += ' AND (sq.created_by = $' + (params.length + 1) + ' OR sq.is_public = true)';
    params.push(userId);

    if (is_public !== undefined) {
      whereClause += ' AND sq.is_public = $' + (params.length + 1);
      params.push(is_public === 'true');
    }
    if (object_name) {
      whereClause += ' AND sq.object_name = $' + (params.length + 1);
      params.push(object_name);
    }
    if (created_by) {
      whereClause += ' AND sq.created_by = $' + (params.length + 1);
      params.push(created_by);
    }

    const queries = await queryWithTenant(
      tenantId,
      `SELECT sq.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        EXISTS(SELECT 1 FROM query_favorites qf WHERE qf.saved_query_id = sq.saved_query_id AND qf.user_id = $${params.length + 1}) as is_favorited,
        (SELECT COUNT(*) FROM query_favorites qf WHERE qf.saved_query_id = sq.saved_query_id) as favorite_count
       FROM saved_queries sq
       LEFT JOIN users u ON sq.created_by = u.user_id
       WHERE 1=1 ${whereClause}
       ORDER BY sq.modified_date DESC`,
      [...params, userId]
    );

    res.json({ success: true, data: queries });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single saved query
router.get('/:queryId', async (req: AuthRequest, res: Response) => {
  try {
    const { queryId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const queries = await queryWithTenant(
      tenantId,
      `SELECT sq.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        EXISTS(SELECT 1 FROM query_favorites qf WHERE qf.saved_query_id = sq.saved_query_id AND qf.user_id = $1) as is_favorited
       FROM saved_queries sq
       LEFT JOIN users u ON sq.created_by = u.user_id
       WHERE sq.saved_query_id = $2
         AND (sq.created_by = $1 OR sq.is_public = true)`,
      [userId, queryId]
    );

    if (queries.length === 0) {
      return res.status(404).json({ success: false, error: 'Saved query not found' });
    }

    res.json({ success: true, data: queries[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create saved query
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      query_name,
      description,
      soql_query,
      object_name,
      is_public = false
    } = req.body;

    if (!query_name || !soql_query) {
      return res.status(400).json({ success: false, error: 'Query name and SOQL query are required' });
    }

    // Validate SOQL by attempting to parse it
    try {
      parseSOQL(soql_query);
    } catch (error: any) {
      return res.status(400).json({ success: false, error: `Invalid SOQL: ${error.message}` });
    }

    // Extract object name if not provided
    let finalObjectName = object_name;
    if (!finalObjectName) {
      const match = soql_query.match(/FROM\s+(\w+)/i);
      if (match) {
        finalObjectName = match[1];
      }
    }

    const queries = await queryWithTenant(
      tenantId,
      `INSERT INTO saved_queries (
        tenant_id, query_name, description, soql_query,
        object_name, is_public, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
      RETURNING *`,
      [tenantId, query_name, description, soql_query, finalObjectName, is_public, userId]
    );

    res.status(201).json({ success: true, data: queries[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update saved query
router.put('/:queryId', async (req: AuthRequest, res: Response) => {
  try {
    const { queryId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    // Validate SOQL if it's being updated
    if (updates.soql_query) {
      try {
        parseSOQL(updates.soql_query);
      } catch (error: any) {
        return res.status(400).json({ success: false, error: `Invalid SOQL: ${error.message}` });
      }

      // Update object name if SOQL changed
      if (!updates.object_name) {
        const match = updates.soql_query.match(/FROM\s+(\w+)/i);
        if (match) {
          updates.object_name = match[1];
        }
      }
    }

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM saved_queries WHERE saved_query_id = $1',
      [queryId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Saved query not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only update your own queries' });
    }

    const queries = await queryWithTenant(
      tenantId,
      `UPDATE saved_queries SET
        query_name = COALESCE($1, query_name),
        description = COALESCE($2, description),
        soql_query = COALESCE($3, soql_query),
        object_name = COALESCE($4, object_name),
        is_public = COALESCE($5, is_public),
        modified_by = $6,
        modified_date = CURRENT_TIMESTAMP
       WHERE saved_query_id = $7
       RETURNING *`,
      [
        updates.query_name, updates.description, updates.soql_query,
        updates.object_name, updates.is_public, userId, queryId
      ]
    );

    res.json({ success: true, data: queries[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute saved query
router.post('/:queryId/execute', async (req: AuthRequest, res: Response) => {
  try {
    const { queryId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const queries = await queryWithTenant(
      tenantId,
      'SELECT soql_query FROM saved_queries WHERE saved_query_id = $1 AND (created_by = $2 OR is_public = true)',
      [queryId, userId]
    );

    if (queries.length === 0) {
      return res.status(404).json({ success: false, error: 'Saved query not found' });
    }

    const soqlQuery = queries[0].soql_query;
    const startTime = Date.now();

    try {
      // Parse SOQL
      const parsed = parseSOQL(soqlQuery);

      // Translate to SQL
      const translated = await translateSOQL(parsed, tenantId);

      // Execute query
      const results = await queryWithTenant(
        tenantId,
        translated.sql,
        translated.params
      );

      const executionTime = Date.now() - startTime;

      // Log to query history
      await queryWithTenant(
        tenantId,
        `INSERT INTO query_history (tenant_id, user_id, soql_query, translated_sql, object_name, execution_time_ms, row_count, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          tenantId,
          userId,
          soqlQuery,
          translated.sql,
          parsed.from,
          executionTime,
          results.length,
          'success'
        ]
      );

      res.json({
        success: true,
        data: {
          records: results,
          rowCount: results.length,
          executionTime,
          objectName: parsed.from
        }
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Log error
      try {
        await queryWithTenant(
          tenantId,
          `INSERT INTO query_history (tenant_id, user_id, soql_query, translated_sql, object_name, execution_time_ms, row_count, status, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [tenantId, userId, soqlQuery, '', null, executionTime, 0, 'error', error.message]
        );
      } catch (logError) {
        console.error('Failed to log query error:', logError);
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Query execution failed'
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete saved query
router.delete('/:queryId', async (req: AuthRequest, res: Response) => {
  try {
    const { queryId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM saved_queries WHERE saved_query_id = $1',
      [queryId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Saved query not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only delete your own queries' });
    }

    await queryWithTenant(
      tenantId,
      'DELETE FROM saved_queries WHERE saved_query_id = $1',
      [queryId]
    );

    res.json({ success: true, message: 'Saved query deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's favorite queries
router.get('/favorites/my', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const favorites = await queryWithTenant(
      tenantId,
      `SELECT sq.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        qf.added_date as favorited_date
       FROM query_favorites qf
       JOIN saved_queries sq ON qf.saved_query_id = sq.saved_query_id
       LEFT JOIN users u ON sq.created_by = u.user_id
       WHERE qf.user_id = $1
       ORDER BY qf.added_date DESC`,
      [userId]
    );

    res.json({ success: true, data: favorites });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add query to favorites
router.post('/:queryId/favorite', async (req: AuthRequest, res: Response) => {
  try {
    const { queryId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Check if query exists and is accessible
    const queries = await queryWithTenant(
      tenantId,
      'SELECT saved_query_id FROM saved_queries WHERE saved_query_id = $1 AND (created_by = $2 OR is_public = true)',
      [queryId, userId]
    );

    if (queries.length === 0) {
      return res.status(404).json({ success: false, error: 'Saved query not found' });
    }

    // Add to favorites (ON CONFLICT DO NOTHING to handle duplicates)
    await queryWithTenant(
      tenantId,
      'INSERT INTO query_favorites (user_id, saved_query_id) VALUES ($1, $2) ON CONFLICT (user_id, saved_query_id) DO NOTHING',
      [userId, queryId]
    );

    res.json({ success: true, message: 'Query added to favorites' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove query from favorites
router.delete('/:queryId/favorite', async (req: AuthRequest, res: Response) => {
  try {
    const { queryId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM query_favorites WHERE user_id = $1 AND saved_query_id = $2',
      [userId, queryId]
    );

    res.json({ success: true, message: 'Query removed from favorites' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get popular queries
router.get('/analytics/popular', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    const tenantId = req.tenantId!;

    const popular = await queryWithTenant(
      tenantId,
      `SELECT * FROM get_popular_queries($1, $2)`,
      [tenantId, limit]
    );

    res.json({ success: true, data: popular });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
