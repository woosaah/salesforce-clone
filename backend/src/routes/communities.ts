import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/communities
 * Get all communities for the tenant
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const communities = await queryWithTenant(
      `SELECT c.*,
              COUNT(DISTINCT cm.member_id) as member_count
       FROM communities c
       LEFT JOIN community_members cm ON c.community_id = cm.community_id
       GROUP BY c.community_id
       ORDER BY c.created_date DESC`,
      []
    );

    res.json({
      success: true,
      data: communities,
    });
  } catch (error: any) {
    console.error('Error fetching communities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch communities',
      error: error.message,
    });
  }
});

/**
 * GET /api/communities/:id
 * Get a specific community
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const communities = await queryWithTenant(
      `SELECT * FROM communities WHERE community_id = $1`,
      [id]
    );

    if (communities.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    res.json({
      success: true,
      data: communities[0],
    });
  } catch (error: any) {
    console.error('Error fetching community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community',
      error: error.message,
    });
  }
});

/**
 * POST /api/communities
 * Create a new community
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      community_name,
      url_prefix,
      description,
      community_type, // 'Customer', 'Partner', 'Employee'
      branding,
      is_active,
    } = req.body;

    if (!community_name || !url_prefix) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: community_name, url_prefix',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO communities (
        community_name,
        url_prefix,
        description,
        community_type,
        branding,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        community_name,
        url_prefix,
        description,
        community_type || 'Customer',
        JSON.stringify(branding || {}),
        is_active !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Community created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create community',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/communities/:id
 * Update a community
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'community_name',
      'url_prefix',
      'description',
      'community_type',
      'branding',
      'is_active',
    ];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'branding' && typeof updates[key] === 'object'
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
      `UPDATE communities SET ${setFields.join(', ')}
       WHERE community_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    res.json({
      success: true,
      message: 'Community updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update community',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/communities/:id
 * Delete a community
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM communities WHERE community_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community not found',
      });
    }

    res.json({
      success: true,
      message: 'Community deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting community:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete community',
      error: error.message,
    });
  }
});

/**
 * GET /api/communities/:id/members
 * Get all members of a community
 */
router.get('/:id/members', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const members = await queryWithTenant(
      `SELECT cm.*, u.first_name, u.last_name, u.email
       FROM community_members cm
       JOIN users u ON cm.user_id = u.user_id
       WHERE cm.community_id = $1
       ORDER BY cm.joined_date DESC`,
      [id]
    );

    res.json({
      success: true,
      data: members,
    });
  } catch (error: any) {
    console.error('Error fetching community members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community members',
      error: error.message,
    });
  }
});

/**
 * POST /api/communities/:id/members
 * Add a member to a community
 */
router.post('/:id/members', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id, role, profile_data } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: user_id',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO community_members (
        community_id,
        user_id,
        role,
        profile_data
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [id, user_id, role || 'Member', JSON.stringify(profile_data || {})]
    );

    res.status(201).json({
      success: true,
      message: 'Member added to community successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error adding community member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add community member',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/communities/:id/members/:memberId
 * Remove a member from a community
 */
router.delete('/:id/members/:memberId', async (req: Request, res: Response) => {
  try {
    const { id, memberId } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM community_members
       WHERE community_id = $1 AND member_id = $2
       RETURNING *`,
      [id, memberId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Community member not found',
      });
    }

    res.json({
      success: true,
      message: 'Member removed from community successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error removing community member:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove community member',
      error: error.message,
    });
  }
});

/**
 * GET /api/communities/:id/pages
 * Get all pages for a community
 */
router.get('/:id/pages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pages = await queryWithTenant(
      `SELECT * FROM community_pages
       WHERE community_id = $1
       ORDER BY page_order, page_title`,
      [id]
    );

    res.json({
      success: true,
      data: pages,
    });
  } catch (error: any) {
    console.error('Error fetching community pages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch community pages',
      error: error.message,
    });
  }
});

/**
 * POST /api/communities/:id/pages
 * Create a new page in a community
 */
router.post('/:id/pages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page_title, page_url, page_layout, page_content, is_public } = req.body;

    if (!page_title || !page_url) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: page_title, page_url',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO community_pages (
        community_id,
        page_title,
        page_url,
        page_layout,
        page_content,
        is_public
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        id,
        page_title,
        page_url,
        page_layout || 'Standard',
        JSON.stringify(page_content || {}),
        is_public !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Community page created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating community page:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create community page',
      error: error.message,
    });
  }
});

export default router;
