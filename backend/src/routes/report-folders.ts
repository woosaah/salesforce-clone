import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all folders
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const folders = await queryWithTenant(
      tenantId,
      `SELECT rf.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM reports r WHERE r.folder_id = rf.folder_id) as report_count,
        pf.folder_name as parent_folder_name
       FROM report_folders rf
       LEFT JOIN users u ON rf.created_by = u.user_id
       LEFT JOIN report_folders pf ON rf.parent_folder_id = pf.folder_id
       WHERE rf.created_by = $1 OR rf.is_public = true
       ORDER BY rf.folder_name`,
      [userId]
    );

    res.json({ success: true, data: folders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single folder
router.get('/:folderId', async (req: AuthRequest, res: Response) => {
  try {
    const { folderId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const folders = await queryWithTenant(
      tenantId,
      `SELECT rf.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM reports r WHERE r.folder_id = rf.folder_id) as report_count
       FROM report_folders rf
       LEFT JOIN users u ON rf.created_by = u.user_id
       WHERE rf.folder_id = $1
         AND (rf.created_by = $2 OR rf.is_public = true)`,
      [folderId, userId]
    );

    if (folders.length === 0) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    res.json({ success: true, data: folders[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create folder
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      folder_name,
      description,
      parent_folder_id,
      is_public = false
    } = req.body;

    if (!folder_name) {
      return res.status(400).json({ success: false, error: 'Folder name is required' });
    }

    const folders = await queryWithTenant(
      tenantId,
      `INSERT INTO report_folders (
        tenant_id, folder_name, description, parent_folder_id, is_public, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $6)
      RETURNING *`,
      [tenantId, folder_name, description, parent_folder_id, is_public, userId]
    );

    res.status(201).json({ success: true, data: folders[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update folder
router.put('/:folderId', async (req: AuthRequest, res: Response) => {
  try {
    const { folderId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM report_folders WHERE folder_id = $1',
      [folderId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only update your own folders' });
    }

    const folders = await queryWithTenant(
      tenantId,
      `UPDATE report_folders SET
        folder_name = COALESCE($1, folder_name),
        description = COALESCE($2, description),
        parent_folder_id = COALESCE($3, parent_folder_id),
        is_public = COALESCE($4, is_public),
        modified_by = $5,
        modified_date = CURRENT_TIMESTAMP
       WHERE folder_id = $6
       RETURNING *`,
      [
        updates.folder_name,
        updates.description,
        updates.parent_folder_id,
        updates.is_public,
        userId,
        folderId
      ]
    );

    res.json({ success: true, data: folders[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete folder
router.delete('/:folderId', async (req: AuthRequest, res: Response) => {
  try {
    const { folderId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    // Check ownership
    const existing = await queryWithTenant(
      tenantId,
      'SELECT created_by FROM report_folders WHERE folder_id = $1',
      [folderId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, error: 'Folder not found' });
    }

    if (existing[0].created_by !== userId) {
      return res.status(403).json({ success: false, error: 'You can only delete your own folders' });
    }

    // Check if folder has reports
    const reports = await queryWithTenant(
      tenantId,
      'SELECT COUNT(*) as count FROM reports WHERE folder_id = $1',
      [folderId]
    );

    if (parseInt(reports[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete folder with reports. Move or delete reports first.'
      });
    }

    await queryWithTenant(
      tenantId,
      'DELETE FROM report_folders WHERE folder_id = $1',
      [folderId]
    );

    res.json({ success: true, message: 'Folder deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get reports in folder
router.get('/:folderId/reports', async (req: AuthRequest, res: Response) => {
  try {
    const { folderId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    const reports = await queryWithTenant(
      tenantId,
      `SELECT r.*,
        u.first_name || ' ' || u.last_name as created_by_name
       FROM reports r
       LEFT JOIN users u ON r.created_by = u.user_id
       WHERE r.folder_id = $1
         AND (r.created_by = $2 OR r.is_public = true)
       ORDER BY r.report_name`,
      [folderId, userId]
    );

    res.json({ success: true, data: reports });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
