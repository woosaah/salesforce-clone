import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';

const router = Router();
router.use(authenticate);

// Get all price books
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { is_active, is_standard } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (is_active !== undefined) {
      whereClause += ' AND is_active = $' + (params.length + 1);
      params.push(is_active === 'true');
    }
    if (is_standard !== undefined) {
      whereClause += ' AND is_standard = $' + (params.length + 1);
      params.push(is_standard === 'true');
    }

    const priceBooks = await queryWithTenant(
      tenantId,
      `SELECT pb.*,
        COUNT(pbe.price_book_entry_id) as entry_count
       FROM price_books pb
       LEFT JOIN price_book_entries pbe ON pb.price_book_id = pbe.price_book_id
       WHERE 1=1 ${whereClause}
       GROUP BY pb.price_book_id
       ORDER BY pb.is_standard DESC, pb.name`,
      params
    );

    res.json({ success: true, data: priceBooks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single price book with entries
router.get('/:priceBookId', async (req: AuthRequest, res: Response) => {
  try {
    const { priceBookId } = req.params;
    const tenantId = req.tenantId!;

    const priceBooks = await queryWithTenant(
      tenantId,
      `SELECT pb.*,
        COALESCE(jsonb_agg(jsonb_build_object(
          'price_book_entry_id', pbe.price_book_entry_id,
          'product_id', pbe.product_id,
          'product_name', p.product_name,
          'product_code', p.product_code,
          'list_price', pbe.list_price,
          'use_standard_price', pbe.use_standard_price,
          'is_active', pbe.is_active
        ) ORDER BY p.product_name) FILTER (WHERE pbe.price_book_entry_id IS NOT NULL), '[]') as entries
       FROM price_books pb
       LEFT JOIN price_book_entries pbe ON pb.price_book_id = pbe.price_book_id
       LEFT JOIN products p ON pbe.product_id = p.product_id
       WHERE pb.price_book_id = $1
       GROUP BY pb.price_book_id`,
      [priceBookId]
    );

    if (priceBooks.length === 0) {
      return res.status(404).json({ success: false, error: 'Price book not found' });
    }

    res.json({ success: true, data: priceBooks[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create price book
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { name, description, is_active = true, is_standard = false } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    // Ensure only one standard price book
    if (is_standard) {
      await queryWithTenant(
        tenantId,
        'UPDATE price_books SET is_standard = false WHERE tenant_id = $1',
        [tenantId]
      );
    }

    const priceBooks = await queryWithTenant(
      tenantId,
      `INSERT INTO price_books (
        tenant_id, name, description, is_active, is_standard
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [tenantId, name, description, is_active, is_standard]
    );

    res.status(201).json({ success: true, data: priceBooks[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update price book
router.put('/:priceBookId', async (req: AuthRequest, res: Response) => {
  try {
    const { priceBookId } = req.params;
    const tenantId = req.tenantId!;
    const updates = req.body;

    // Ensure only one standard price book
    if (updates.is_standard === true) {
      await queryWithTenant(
        tenantId,
        'UPDATE price_books SET is_standard = false WHERE tenant_id = $1 AND price_book_id != $2',
        [tenantId, priceBookId]
      );
    }

    const priceBooks = await queryWithTenant(
      tenantId,
      `UPDATE price_books SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        is_active = COALESCE($3, is_active),
        is_standard = COALESCE($4, is_standard),
        modified_date = CURRENT_TIMESTAMP
       WHERE price_book_id = $5
       RETURNING *`,
      [updates.name, updates.description, updates.is_active, updates.is_standard, priceBookId]
    );

    if (priceBooks.length === 0) {
      return res.status(404).json({ success: false, error: 'Price book not found' });
    }

    res.json({ success: true, data: priceBooks[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add entry to price book
router.post('/:priceBookId/entries', async (req: AuthRequest, res: Response) => {
  try {
    const { priceBookId } = req.params;
    const tenantId = req.tenantId!;
    const { product_id, list_price, use_standard_price = false, is_active = true } = req.body;

    if (!product_id) {
      return res.status(400).json({ success: false, error: 'Product ID is required' });
    }

    const entries = await queryWithTenant(
      tenantId,
      `INSERT INTO price_book_entries (
        price_book_id, product_id, list_price, use_standard_price, is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [priceBookId, product_id, list_price, use_standard_price, is_active]
    );

    res.status(201).json({ success: true, data: entries[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update price book entry
router.put('/:priceBookId/entries/:entryId', async (req: AuthRequest, res: Response) => {
  try {
    const { priceBookId, entryId } = req.params;
    const tenantId = req.tenantId!;
    const updates = req.body;

    const entries = await queryWithTenant(
      tenantId,
      `UPDATE price_book_entries SET
        list_price = COALESCE($1, list_price),
        use_standard_price = COALESCE($2, use_standard_price),
        is_active = COALESCE($3, is_active),
        modified_date = CURRENT_TIMESTAMP
       WHERE price_book_entry_id = $4 AND price_book_id = $5
       RETURNING *`,
      [updates.list_price, updates.use_standard_price, updates.is_active, entryId, priceBookId]
    );

    if (entries.length === 0) {
      return res.status(404).json({ success: false, error: 'Price book entry not found' });
    }

    res.json({ success: true, data: entries[0] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete price book entry
router.delete('/:priceBookId/entries/:entryId', async (req: AuthRequest, res: Response) => {
  try {
    const { entryId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM price_book_entries WHERE price_book_entry_id = $1',
      [entryId]
    );

    res.json({ success: true, message: 'Price book entry deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete price book
router.delete('/:priceBookId', async (req: AuthRequest, res: Response) => {
  try {
    const { priceBookId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM price_books WHERE price_book_id = $1',
      [priceBookId]
    );

    res.json({ success: true, message: 'Price book deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
