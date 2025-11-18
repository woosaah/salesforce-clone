import { Router, Response, NextFunction } from 'express';
import { body, query as expressQuery, validationResult } from 'express-validator';
import { query, queryWithTenant } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { parseSOQL } from '../utils/soql-parser';
import { translateSOQL } from '../utils/soql-translator';
import { ApiResponse } from '../types';

const router = Router();

// All routes require authentication
router.use(authenticate);

interface QueryHistory {
  query_id: string;
  tenant_id: string;
  user_id: string;
  soql_query: string;
  translated_sql: string;
  object_name: string;
  execution_time_ms: number;
  row_count: number;
  status: string;
  error_message: string | null;
  created_date: string;
}

// POST /api/query/execute - Execute SOQL query
router.post(
  '/execute',
  [body('query').isString().notEmpty().withMessage('Query is required')],
  asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const soqlQuery = req.body.query as string;
    const startTime = Date.now();

    try {
      // Parse SOQL
      const parsed = parseSOQL(soqlQuery);

      // Translate to SQL
      const translated = await translateSOQL(parsed, req.tenantId!);

      // Execute query
      const results = await queryWithTenant(
        req.tenantId!,
        translated.sql,
        translated.params
      );

      const executionTime = Date.now() - startTime;

      // Log to query history
      await queryWithTenant(
        req.tenantId!,
        `INSERT INTO query_history (tenant_id, user_id, soql_query, translated_sql, object_name, execution_time_ms, row_count, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          req.tenantId,
          req.userId,
          soqlQuery,
          translated.sql,
          parsed.from,
          executionTime,
          results.length,
          'success',
        ]
      );

      res.json({
        success: true,
        data: {
          records: results,
          rowCount: results.length,
          executionTime,
          objectName: parsed.from,
        },
      });
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Try to extract object name from query
      let objectName: string | null = null;
      try {
        const match = soqlQuery.match(/FROM\s+(\w+)/i);
        if (match) {
          objectName = match[1];
        }
      } catch (e) {
        // Ignore
      }

      // Log error to query history
      try {
        await queryWithTenant(
          req.tenantId!,
          `INSERT INTO query_history (tenant_id, user_id, soql_query, translated_sql, object_name, execution_time_ms, row_count, status, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            req.tenantId,
            req.userId,
            soqlQuery,
            '',
            objectName,
            executionTime,
            0,
            'error',
            error.message,
          ]
        );
      } catch (logError) {
        console.error('Failed to log query error:', logError);
      }

      res.status(400).json({
        success: false,
        error: error.message || 'Query execution failed',
      });
    }
  })
);

// GET /api/query/history - Get query history
router.get(
  '/history',
  [
    expressQuery('limit').optional().isInt({ min: 1, max: 100 }),
    expressQuery('offset').optional().isInt({ min: 0 }),
  ],
    asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get query history
    const history = await queryWithTenant<QueryHistory>(
      req.tenantId!,
      `SELECT query_id, soql_query, object_name, execution_time_ms, row_count, status, error_message, created_date
       FROM query_history
       ORDER BY created_date DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Get total count
    const countResult = await queryWithTenant<{ total: string }>(
      req.tenantId!,
      'SELECT COUNT(*) as total FROM query_history'
    );

    const total = parseInt(countResult[0]?.total || '0');

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + history.length < total,
        },
      },
    });
  })
);

// GET /api/query/history/:queryId - Get single query from history
router.get(
  '/history/:queryId',
    asyncHandler(async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { queryId } = req.params;

    const history = await queryWithTenant<QueryHistory>(
      req.tenantId!,
      'SELECT * FROM query_history WHERE query_id = $1',
      [queryId]
    );

    if (history.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Query not found',
      });
      return;
    }

    res.json({
      success: true,
      data: history[0],
    });
  })
);

// DELETE /api/query/history/:queryId - Delete query from history
router.delete(
  '/history/:queryId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { queryId } = req.params;

    const result = await queryWithTenant(
      req.tenantId!,
      'DELETE FROM query_history WHERE query_id = $1 RETURNING query_id',
      [queryId]
    );

    if (result.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Query not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Query deleted from history',
    });
  })
);

export default router;
