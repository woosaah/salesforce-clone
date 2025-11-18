import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Search knowledge articles
router.get('/search', async (req: AuthRequest, res: Response) => {
  try {
    const { q, limit = 20 } = req.query;
    const tenantId = req.tenantId!;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }

    const articles = await queryWithTenant(
      tenantId,
      `SELECT *,
        ts_rank(
          to_tsvector('english', title || ' ' || COALESCE(summary, '') || ' ' || COALESCE(content, '')),
          plainto_tsquery('english', $1)
        ) as rank
       FROM knowledge_articles
       WHERE to_tsvector('english', title || ' ' || COALESCE(summary, '') || ' ' || COALESCE(content, ''))
         @@ plainto_tsquery('english', $1)
         AND publish_status = 'Published'
       ORDER BY rank DESC
       LIMIT $2`,
      [q, limit]
    );

    res.json({ success: true, data: articles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all articles
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0, publish_status, category } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (publish_status) {
      whereClause += ' AND ka.publish_status = $' + (params.length + 1);
      params.push(publish_status);
    }
    if (category) {
      whereClause += ' AND ka.category = $' + (params.length + 1);
      params.push(category);
    }

    const articles = await queryWithTenant(
      tenantId,
      `SELECT ka.*
       FROM knowledge_articles ka
       WHERE 1=1 ${whereClause}
       ORDER BY ka.created_date DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: { articles, total: articles.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single article
router.get('/:articleId', async (req: AuthRequest, res: Response) => {
  try {
    const { articleId } = req.params;
    const tenantId = req.tenantId!;

    const articles = await queryWithTenant(
      tenantId,
      'SELECT * FROM knowledge_articles WHERE article_id = $1',
      [articleId]
    );

    if (articles.length === 0) {
      return res.status(404).json({ success: false, error: 'Article not found' });
    }

    // Increment view count
    await queryWithTenant(
      tenantId,
      'UPDATE knowledge_articles SET view_count = view_count + 1 WHERE article_id = $1',
      [articleId]
    );

    res.json({ success: true, data: articles[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create article
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      title,
      summary,
      content,
      article_type,
      category,
      keywords,
      is_visible_in_portal = false
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const count = await queryWithTenant<{count: string}>(
      tenantId,
      'SELECT COUNT(*) as count FROM knowledge_articles WHERE tenant_id = $1',
      [tenantId]
    );
    const article_number = `KA-${String(parseInt(count[0].count) + 1).padStart(5, '0')}`;

    const articles = await queryWithTenant(
      tenantId,
      `INSERT INTO knowledge_articles (
        tenant_id, article_number, title, summary, content,
        article_type, category, keywords, is_visible_in_portal,
        publish_status, owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Draft', $10, $10, $10)
      RETURNING *`,
      [tenantId, article_number, title, summary, content, article_type, category, keywords, is_visible_in_portal, userId]
    );

    res.status(201).json({ success: true, data: articles[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update article
router.put('/:articleId', async (req: AuthRequest, res: Response) => {
  try {
    const { articleId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const articles = await queryWithTenant(
      tenantId,
      `UPDATE knowledge_articles SET
        title = COALESCE($1, title),
        summary = COALESCE($2, summary),
        content = COALESCE($3, content),
        article_type = COALESCE($4, article_type),
        category = COALESCE($5, category),
        keywords = COALESCE($6, keywords),
        is_visible_in_portal = COALESCE($7, is_visible_in_portal),
        modified_by = $8,
        modified_date = CURRENT_TIMESTAMP
       WHERE article_id = $9
       RETURNING *`,
      [updates.title, updates.summary, updates.content, updates.article_type, updates.category, updates.keywords, updates.is_visible_in_portal, userId, articleId]
    );

    res.json({ success: true, data: articles[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publish article
router.post('/:articleId/publish', async (req: AuthRequest, res: Response) => {
  try {
    const { articleId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const articles = await queryWithTenant(
      tenantId,
      `UPDATE knowledge_articles SET
        publish_status = 'Published',
        published_date = CURRENT_TIMESTAMP,
        version_number = version_number + 1,
        modified_by = $1,
        modified_date = CURRENT_TIMESTAMP
       WHERE article_id = $2
       RETURNING *`,
      [userId, articleId]
    );

    res.json({ success: true, data: articles[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Vote helpful/not helpful
router.post('/:articleId/vote', async (req: AuthRequest, res: Response) => {
  try {
    const { articleId } = req.params;
    const { helpful } = req.body;
    const tenantId = req.tenantId!;

    const field = helpful ? 'helpful_count' : 'not_helpful_count';

    const articles = await queryWithTenant(
      tenantId,
      `UPDATE knowledge_articles SET ${field} = ${field} + 1 WHERE article_id = $1 RETURNING *`,
      [articleId]
    );

    res.json({ success: true, data: articles[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
