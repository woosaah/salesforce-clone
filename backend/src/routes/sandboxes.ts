import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query as db } from '../config/database';

const router = Router();

// Helper to execute with tenant context
async function queryWithTenant(tenantId: string, sql: string, params: any[] = []) {
  await db(`SET app.current_tenant_id = '${tenantId}'`);
  return await db(sql, params);
}

// Create sandbox
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { sandbox_name, sandbox_type, description, include_objects, sample_data_percentage } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    // Create new tenant for sandbox
    const sandboxTenant = await db(
      `INSERT INTO tenants (tenant_name, subdomain, is_sandbox)
       VALUES ($1, $2, true)
       RETURNING tenant_id`,
      [`${sandbox_name} (Sandbox)`, `${req.user!.tenantId}-${Date.now()}`]
    );

    const sandboxTenantId = sandboxTenant[0].tenant_id;

    // Create sandbox record
    const sandbox = await queryWithTenant(
      tenantId,
      `INSERT INTO sandboxes (
        source_tenant_id, sandbox_tenant_id, sandbox_name, sandbox_type,
        description, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, 'Creating', $6)
      RETURNING *`,
      [tenantId, sandboxTenantId, sandbox_name, sandbox_type, description, userId]
    );

    // Create template
    await queryWithTenant(
      tenantId,
      `INSERT INTO sandbox_templates (
        sandbox_id, include_objects, sample_data_percentage
      ) VALUES ($1, $2, $3)`,
      [sandbox[0].sandbox_id, JSON.stringify(include_objects || []), sample_data_percentage || 100]
    );

    // Start async copy process (simplified - in production would be background job)
    copySandboxData(sandbox[0].sandbox_id, tenantId, sandboxTenantId, include_objects || [])
      .catch(err => console.error('Sandbox copy failed:', err));

    res.status(201).json(sandbox[0]);
  } catch (error) {
    next(error);
  }
});

// List sandboxes
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const sandboxes = await queryWithTenant(
      tenantId,
      `SELECT s.*, t.tenant_name as sandbox_tenant_name
       FROM sandboxes s
       JOIN tenants t ON s.sandbox_tenant_id = t.tenant_id
       WHERE s.source_tenant_id = $1
       ORDER BY s.created_date DESC`,
      [tenantId]
    );

    res.json(sandboxes);
  } catch (error) {
    next(error);
  }
});

// Get sandbox details
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const sandbox = await queryWithTenant(
      tenantId,
      `SELECT s.*, t.tenant_name as sandbox_tenant_name, st.*
       FROM sandboxes s
       JOIN tenants t ON s.sandbox_tenant_id = t.tenant_id
       LEFT JOIN sandbox_templates st ON s.sandbox_id = st.sandbox_id
       WHERE s.sandbox_id = $1`,
      [id]
    );

    if (!sandbox.length) {
      return res.status(404).json({ error: 'Sandbox not found' });
    }

    res.json(sandbox[0]);
  } catch (error) {
    next(error);
  }
});

// Refresh sandbox
router.post('/:id/refresh', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    // Create refresh history record
    const refresh = await queryWithTenant(
      tenantId,
      `INSERT INTO sandbox_refresh_history (sandbox_id, refresh_type, status)
       VALUES ($1, 'Full', 'In_Progress')
       RETURNING *`,
      [id]
    );

    // Update sandbox status
    await queryWithTenant(
      tenantId,
      `UPDATE sandboxes SET status = 'Refreshing' WHERE sandbox_id = $1`,
      [id]
    );

    // Get sandbox details
    const sandbox = await queryWithTenant(
      tenantId,
      `SELECT * FROM sandboxes WHERE sandbox_id = $1`,
      [id]
    );

    // Start async refresh (simplified)
    refreshSandboxData(id, sandbox[0].source_tenant_id, sandbox[0].sandbox_tenant_id)
      .catch(err => console.error('Sandbox refresh failed:', err));

    res.json(refresh[0]);
  } catch (error) {
    next(error);
  }
});

// Delete sandbox
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    // Get sandbox
    const sandbox = await queryWithTenant(
      tenantId,
      `SELECT * FROM sandboxes WHERE sandbox_id = $1`,
      [id]
    );

    if (!sandbox.length) {
      return res.status(404).json({ error: 'Sandbox not found' });
    }

    // Delete sandbox tenant (cascades to sandbox record)
    await db(
      `DELETE FROM tenants WHERE tenant_id = $1`,
      [sandbox[0].sandbox_tenant_id]
    );

    res.json({ message: 'Sandbox deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Helper function to copy sandbox data
async function copySandboxData(
  sandboxId: string,
  sourceTenantId: string,
  sandboxTenantId: string,
  includeObjects: string[]
) {
  try {
    // Copy metadata (objects, fields)
    await db(`SET app.current_tenant_id = '${sourceTenantId}'`);

    const objects = await db(
      `SELECT * FROM objects_meta WHERE tenant_id = $1`,
      [sourceTenantId]
    );

    for (const obj of objects) {
      await db(`SET app.current_tenant_id = '${sandboxTenantId}'`);
      await db(
        `INSERT INTO objects_meta (tenant_id, object_name, label, plural_label, object_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [sandboxTenantId, obj.object_name, obj.label, obj.plural_label, obj.object_type]
      );
    }

    // Copy fields
    await db(`SET app.current_tenant_id = '${sourceTenantId}'`);
    const fields = await db(
      `SELECT f.* FROM fields_meta f
       JOIN objects_meta o ON f.object_id = o.object_id
       WHERE o.tenant_id = $1`,
      [sourceTenantId]
    );

    for (const field of fields) {
      const targetObject = await db(
        `SELECT object_id FROM objects_meta
         WHERE tenant_id = $1 AND object_name = (
           SELECT object_name FROM objects_meta WHERE object_id = $2
         )`,
        [sandboxTenantId, field.object_id]
      );

      if (targetObject.length) {
        await db(`SET app.current_tenant_id = '${sandboxTenantId}'`);
        await db(
          `INSERT INTO fields_meta (object_id, field_name, label, field_type, is_required)
           VALUES ($1, $2, $3, $4, $5)`,
          [targetObject[0].object_id, field.field_name, field.label, field.field_type, field.is_required]
        );
      }
    }

    // Copy data for specified objects
    if (includeObjects.length > 0) {
      for (const objectName of includeObjects) {
        await db(`SET app.current_tenant_id = '${sourceTenantId}'`);
        const records = await db(
          `SELECT od.* FROM object_data od
           JOIN objects_meta o ON od.object_id = o.object_id
           WHERE o.tenant_id = $1 AND o.object_name = $2`,
          [sourceTenantId, objectName]
        );

        for (const record of records) {
          const targetObject = await db(
            `SELECT object_id FROM objects_meta
             WHERE tenant_id = $1 AND object_name = $2`,
            [sandboxTenantId, objectName]
          );

          if (targetObject.length) {
            await db(`SET app.current_tenant_id = '${sandboxTenantId}'`);
            await db(
              `INSERT INTO object_data (tenant_id, object_id, data, owner_id)
               VALUES ($1, $2, $3, $4)`,
              [sandboxTenantId, targetObject[0].object_id, record.data, record.owner_id]
            );
          }
        }
      }
    }

    // Update sandbox status
    await db(`SET app.current_tenant_id = '${sourceTenantId}'`);
    await db(
      `UPDATE sandboxes SET status = 'Active', activated_date = NOW() WHERE sandbox_id = $1`,
      [sandboxId]
    );
  } catch (error) {
    await db(`SET app.current_tenant_id = '${sourceTenantId}'`);
    await db(
      `UPDATE sandboxes SET status = 'Failed' WHERE sandbox_id = $1`,
      [sandboxId]
    );
    throw error;
  }
}

// Helper function to refresh sandbox
async function refreshSandboxData(sandboxId: string, sourceTenantId: string, sandboxTenantId: string) {
  try {
    // Clear sandbox data
    await db(`DELETE FROM object_data WHERE tenant_id = $1`, [sandboxTenantId]);

    // Re-copy data (simplified - would use template settings in production)
    await copySandboxData(sandboxId, sourceTenantId, sandboxTenantId, []);

    // Update refresh history
    await db(`SET app.current_tenant_id = '${sourceTenantId}'`);
    await db(
      `UPDATE sandbox_refresh_history
       SET status = 'Completed', completed_date = NOW()
       WHERE sandbox_id = $1 AND status = 'In_Progress'`,
      [sandboxId]
    );
  } catch (error) {
    await db(`SET app.current_tenant_id = '${sourceTenantId}'`);
    await db(
      `UPDATE sandbox_refresh_history
       SET status = 'Failed', error_message = $2
       WHERE sandbox_id = $1 AND status = 'In_Progress'`,
      [sandboxId, error.message]
    );
    throw error;
  }
}

export default router;
