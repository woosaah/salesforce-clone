import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all products
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 100, offset = 0, is_active, product_family } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (is_active !== undefined) {
      whereClause += ' AND p.is_active = $' + (params.length + 1);
      params.push(is_active === 'true');
    }
    if (product_family) {
      whereClause += ' AND p.product_family = $' + (params.length + 1);
      params.push(product_family);
    }

    const products = await queryWithTenant(
      tenantId,
      `SELECT p.*
       FROM products p
       WHERE 1=1 ${whereClause}
       ORDER BY p.product_name
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ success: true, data: { products, total: products.length } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single product
router.get('/:productId', async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const tenantId = req.tenantId!;

    const products = await queryWithTenant(
      tenantId,
      'SELECT * FROM products WHERE product_id = $1',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: products[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create product
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { product_code, product_name, description, product_family, standard_price, is_active = true } = req.body;

    if (!product_name) {
      return res.status(400).json({ success: false, error: 'Product name is required' });
    }

    const products = await queryWithTenant(
      tenantId,
      `INSERT INTO products (
        tenant_id, product_code, product_name, description, product_family,
        standard_price, is_active, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *`,
      [tenantId, product_code, product_name, description, product_family, standard_price, is_active, userId]
    );

    res.status(201).json({ success: true, data: products[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update product
router.put('/:productId', async (req: AuthRequest, res: Response) => {
  try {
    const { productId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const updates = req.body;

    const products = await queryWithTenant(
      tenantId,
      `UPDATE products SET
        product_name = COALESCE($1, product_name),
        description = COALESCE($2, description),
        product_family = COALESCE($3, product_family),
        standard_price = COALESCE($4, standard_price),
        is_active = COALESCE($5, is_active),
        modified_by = $6,
        modified_date = CURRENT_TIMESTAMP
       WHERE product_id = $7
       RETURNING *`,
      [updates.product_name, updates.description, updates.product_family, updates.standard_price, updates.is_active, userId, productId]
    );

    res.json({ success: true, data: products[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
