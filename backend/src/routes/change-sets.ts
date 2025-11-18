import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { query as db } from '../config/database';

const router = Router();

async function queryWithTenant(tenantId: string, sql: string, params: any[] = []) {
  await db(`SET app.current_tenant_id = '${tenantId}'`);
  return await db(sql, params);
}

// Create change set
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { change_set_name, description } = req.body;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const changeSet = await queryWithTenant(
      tenantId,
      `INSERT INTO change_sets (tenant_id, change_set_name, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [tenantId, change_set_name, description, userId]
    );

    res.status(201).json(changeSet[0]);
  } catch (error) {
    next(error);
  }
});

// List change sets
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const changeSets = await queryWithTenant(
      tenantId,
      `SELECT cs.*, COUNT(csc.component_id) as component_count
       FROM change_sets cs
       LEFT JOIN change_set_components csc ON cs.change_set_id = csc.change_set_id
       GROUP BY cs.change_set_id
       ORDER BY cs.created_date DESC`
    );

    res.json(changeSets);
  } catch (error) {
    next(error);
  }
});

// Get change set
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const changeSet = await queryWithTenant(
      tenantId,
      `SELECT * FROM change_sets WHERE change_set_id = $1`,
      [id]
    );

    if (!changeSet.length) {
      return res.status(404).json({ error: 'Change set not found' });
    }

    const components = await queryWithTenant(
      tenantId,
      `SELECT * FROM change_set_components WHERE change_set_id = $1`,
      [id]
    );

    res.json({ ...changeSet[0], components });
  } catch (error) {
    next(error);
  }
});

// Add component to change set
router.post('/:id/components', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { component_type, component_name } = req.body;
    const tenantId = req.user!.tenantId;

    // Get component metadata
    const metadata = await getComponentMetadata(tenantId, component_type, component_name);

    const component = await queryWithTenant(
      tenantId,
      `INSERT INTO change_set_components (change_set_id, component_type, component_name, component_metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, component_type, component_name, JSON.stringify(metadata)]
    );

    res.status(201).json(component[0]);
  } catch (error) {
    next(error);
  }
});

// Upload change set
router.post('/:id/upload', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { target_org } = req.body;
    const tenantId = req.user!.tenantId;

    await queryWithTenant(
      tenantId,
      `UPDATE change_sets SET status = 'Uploaded', uploaded_date = NOW() WHERE change_set_id = $1`,
      [id]
    );

    // In production, this would send to target org via API
    // For now, simulate by creating inbound change set in target

    res.json({ message: 'Change set uploaded successfully' });
  } catch (error) {
    next(error);
  }
});

// List inbound change sets
router.get('/inbound/list', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;

    const inbound = await queryWithTenant(
      tenantId,
      `SELECT * FROM inbound_change_sets ORDER BY received_date DESC`
    );

    res.json(inbound);
  } catch (error) {
    next(error);
  }
});

// Validate inbound change set
router.post('/inbound/:id/validate', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    await queryWithTenant(
      tenantId,
      `UPDATE inbound_change_sets SET status = 'Validating' WHERE inbound_id = $1`,
      [id]
    );

    // Perform validation (simplified)
    const validation = await validateChangeSet(id, tenantId);

    if (validation.isValid) {
      await queryWithTenant(
        tenantId,
        `UPDATE inbound_change_sets SET status = 'Validated', validated_date = NOW() WHERE inbound_id = $1`,
        [id]
      );
    } else {
      await queryWithTenant(
        tenantId,
        `UPDATE inbound_change_sets SET status = 'Failed' WHERE inbound_id = $1`,
        [id]
      );
    }

    res.json(validation);
  } catch (error) {
    next(error);
  }
});

// Deploy inbound change set
router.post('/inbound/:id/deploy', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    // Create deployment result
    const result = await queryWithTenant(
      tenantId,
      `INSERT INTO deployment_results (inbound_change_set_id, status, started_date)
       VALUES ($1, 'In_Progress', NOW())
       RETURNING *`,
      [id]
    );

    // Update inbound status
    await queryWithTenant(
      tenantId,
      `UPDATE inbound_change_sets SET status = 'Deploying' WHERE inbound_id = $1`,
      [id]
    );

    // Deploy async
    deployChangeSet(id, tenantId, result[0].result_id).catch(err =>
      console.error('Deployment failed:', err)
    );

    res.json(result[0]);
  } catch (error) {
    next(error);
  }
});

// Get deployment status
router.get('/deployments/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    const result = await queryWithTenant(
      tenantId,
      `SELECT dr.*, ics.change_set_name
       FROM deployment_results dr
       JOIN inbound_change_sets ics ON dr.inbound_change_set_id = ics.inbound_id
       WHERE dr.result_id = $1`,
      [id]
    );

    if (!result.length) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    const components = await queryWithTenant(
      tenantId,
      `SELECT * FROM component_deployment_status WHERE deployment_result_id = $1`,
      [id]
    );

    res.json({ ...result[0], components });
  } catch (error) {
    next(error);
  }
});

// Helper functions
async function getComponentMetadata(tenantId: string, componentType: string, componentName: string) {
  await db(`SET app.current_tenant_id = '${tenantId}'`);

  switch (componentType) {
    case 'Custom_Object':
      const object = await db(
        `SELECT * FROM objects_meta WHERE object_name = $1 AND tenant_id = $2`,
        [componentName, tenantId]
      );
      return object[0] || {};

    case 'Custom_Field':
      const [objectName, fieldName] = componentName.split('.');
      const field = await db(
        `SELECT f.* FROM fields_meta f
         JOIN objects_meta o ON f.object_id = o.object_id
         WHERE o.object_name = $1 AND f.field_name = $2 AND o.tenant_id = $3`,
        [objectName, fieldName, tenantId]
      );
      return field[0] || {};

    case 'Workflow':
      const workflow = await db(
        `SELECT * FROM workflows WHERE workflow_name = $1`,
        [componentName]
      );
      return workflow[0] || {};

    default:
      return {};
  }
}

async function validateChangeSet(inboundId: string, tenantId: string) {
  // Simplified validation
  return { isValid: true, errors: [], warnings: [] };
}

async function deployChangeSet(inboundId: string, tenantId: string, resultId: string) {
  try {
    await db(`SET app.current_tenant_id = '${tenantId}'`);

    // Get inbound change set details (simplified - would parse components in production)
    const inbound = await db(
      `SELECT * FROM inbound_change_sets WHERE inbound_id = $1`,
      [inboundId]
    );

    // Deploy components (simplified example)
    let deployed = 0;
    let failed = 0;

    // Update result
    await db(
      `UPDATE deployment_results
       SET status = 'Completed', deployed_components = $2, failed_components = $3, completed_date = NOW()
       WHERE result_id = $1`,
      [resultId, deployed, failed]
    );

    // Update inbound
    await db(
      `UPDATE inbound_change_sets SET status = 'Deployed', deployed_date = NOW() WHERE inbound_id = $1`,
      [inboundId]
    );
  } catch (error) {
    await db(
      `UPDATE deployment_results
       SET status = 'Failed', errors = $2, completed_date = NOW()
       WHERE result_id = $1`,
      [resultId, JSON.stringify([{ message: error.message }])]
    );
    throw error;
  }
}

export default router;
