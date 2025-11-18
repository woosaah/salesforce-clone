import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { queryWithTenant } from '../config/database';
import { InvoiceNumberGenerator } from '../utils/invoice-number-generator';

const router = Router();

// All routes require authentication
router.use(authenticate);

const invoiceNumberGenerator = new InvoiceNumberGenerator();

// Get all invoices
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const tenantId = req.tenantId!;

    let whereClause = '';
    const params: any[] = [];

    if (status) {
      whereClause = 'WHERE status = $1';
      params.push(status);
    }

    const invoices = await queryWithTenant(
      tenantId,
      `SELECT
        i.*,
        jsonb_build_object(
          'record_id', acc.record_id,
          'data', acc.data
        ) as account,
        jsonb_build_object(
          'record_id', con.record_id,
          'data', con.data
        ) as contact
      FROM invoices i
      LEFT JOIN object_data acc ON i.account_id = acc.record_id
      LEFT JOIN object_data con ON i.contact_id = con.record_id
      ${whereClause}
      ORDER BY i.invoice_date DESC, i.created_date DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await queryWithTenant(
      tenantId,
      `SELECT COUNT(*) as total FROM invoices ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        invoices,
        total: parseInt(countResult[0].total),
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    console.error('Get invoices error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch invoices',
    });
  }
});

// Get single invoice
router.get('/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const tenantId = req.tenantId!;

    const invoices = await queryWithTenant(
      tenantId,
      `SELECT
        i.*,
        jsonb_build_object(
          'record_id', acc.record_id,
          'data', acc.data
        ) as account,
        jsonb_build_object(
          'record_id', con.record_id,
          'data', con.data
        ) as contact,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'line_item_id', li.line_item_id,
              'line_number', li.line_number,
              'product_id', li.product_id,
              'product_code', li.product_code,
              'description', li.description,
              'quantity', li.quantity,
              'unit_price', li.unit_price,
              'discount_percent', li.discount_percent,
              'discount_amount', li.discount_amount,
              'tax_amount', li.tax_amount,
              'line_total', li.line_total
            ) ORDER BY li.line_number
          ) FILTER (WHERE li.line_item_id IS NOT NULL),
          '[]'
        ) as line_items
      FROM invoices i
      LEFT JOIN object_data acc ON i.account_id = acc.record_id
      LEFT JOIN object_data con ON i.contact_id = con.record_id
      LEFT JOIN invoice_line_items li ON i.invoice_id = li.invoice_id
      WHERE i.invoice_id = $1
      GROUP BY i.invoice_id, acc.record_id, con.record_id`,
      [invoiceId]
    );

    if (invoices.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }

    res.json({
      success: true,
      data: invoices[0],
    });
  } catch (error: any) {
    console.error('Get invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch invoice',
    });
  }
});

// Create invoice
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      account_id,
      contact_id,
      opportunity_id,
      invoice_date,
      due_date,
      payment_terms = 'Net 30',
      tax_rate = 0,
      discount_amount = 0,
      discount_type = 'fixed',
      shipping_amount = 0,
      currency_code = 'NZD',
      billing_address,
      shipping_address,
      notes,
      terms_and_conditions,
      footer_text,
      line_items = [],
    } = req.body;

    // Validate required fields
    if (!account_id || !invoice_date || !due_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: account_id, invoice_date, due_date',
      });
    }

    // Generate invoice number
    const invoice_number = await invoiceNumberGenerator.getNextNumber(tenantId);

    // Create invoice
    const invoices = await queryWithTenant(
      tenantId,
      `INSERT INTO invoices (
        tenant_id, invoice_number, account_id, contact_id, opportunity_id,
        invoice_date, due_date, payment_terms, status,
        tax_rate, discount_amount, discount_type, shipping_amount,
        currency_code, billing_address, shipping_address,
        notes, terms_and_conditions, footer_text,
        owner_id, created_by, modified_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Draft', $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19, $19)
      RETURNING *`,
      [
        tenantId,
        invoice_number,
        account_id,
        contact_id,
        opportunity_id,
        invoice_date,
        due_date,
        payment_terms,
        tax_rate,
        discount_amount,
        discount_type,
        shipping_amount,
        currency_code,
        billing_address ? JSON.stringify(billing_address) : null,
        shipping_address ? JSON.stringify(shipping_address) : null,
        notes,
        terms_and_conditions,
        footer_text,
        userId,
      ]
    );

    const invoice = invoices[0];

    // Create line items
    if (line_items.length > 0) {
      for (let i = 0; i < line_items.length; i++) {
        const item = line_items[i];
        const lineTotal =
          item.quantity * item.unit_price -
          (item.discount_amount || 0) +
          (item.tax_amount || 0);

        await queryWithTenant(
          tenantId,
          `INSERT INTO invoice_line_items (
            invoice_id, line_number, product_id, product_code,
            description, quantity, unit_price,
            discount_percent, discount_amount, tax_amount, line_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            invoice.invoice_id,
            i + 1,
            item.product_id,
            item.product_code,
            item.description,
            item.quantity,
            item.unit_price,
            item.discount_percent || 0,
            item.discount_amount || 0,
            item.tax_amount || 0,
            lineTotal,
          ]
        );
      }

      // Recalculate invoice totals
      const subtotal = line_items.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unit_price,
        0
      );
      const taxAmount = (subtotal - discount_amount) * (tax_rate / 100);
      const totalAmount = subtotal - discount_amount + taxAmount + shipping_amount;

      await queryWithTenant(
        tenantId,
        `UPDATE invoices
        SET subtotal = $1, tax_amount = $2, total_amount = $3, amount_due = $3
        WHERE invoice_id = $4`,
        [subtotal, taxAmount, totalAmount, invoice.invoice_id]
      );
    }

    // Fetch complete invoice with line items
    const completeInvoices = await queryWithTenant(
      tenantId,
      `SELECT i.*,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'line_item_id', li.line_item_id,
              'line_number', li.line_number,
              'product_id', li.product_id,
              'product_code', li.product_code,
              'description', li.description,
              'quantity', li.quantity,
              'unit_price', li.unit_price,
              'discount_percent', li.discount_percent,
              'discount_amount', li.discount_amount,
              'tax_amount', li.tax_amount,
              'line_total', li.line_total
            ) ORDER BY li.line_number
          ) FILTER (WHERE li.line_item_id IS NOT NULL),
          '[]'
        ) as line_items
      FROM invoices i
      LEFT JOIN invoice_line_items li ON i.invoice_id = li.invoice_id
      WHERE i.invoice_id = $1
      GROUP BY i.invoice_id`,
      [invoice.invoice_id]
    );

    res.status(201).json({
      success: true,
      data: completeInvoices[0],
    });
  } catch (error: any) {
    console.error('Create invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create invoice',
    });
  }
});

// Update invoice
router.put('/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const {
      account_id,
      contact_id,
      opportunity_id,
      invoice_date,
      due_date,
      payment_terms,
      status,
      tax_rate,
      discount_amount,
      discount_type,
      shipping_amount,
      billing_address,
      shipping_address,
      notes,
      terms_and_conditions,
      footer_text,
      line_items,
    } = req.body;

    // Update invoice
    await queryWithTenant(
      tenantId,
      `UPDATE invoices SET
        account_id = COALESCE($1, account_id),
        contact_id = COALESCE($2, contact_id),
        opportunity_id = COALESCE($3, opportunity_id),
        invoice_date = COALESCE($4, invoice_date),
        due_date = COALESCE($5, due_date),
        payment_terms = COALESCE($6, payment_terms),
        status = COALESCE($7, status),
        tax_rate = COALESCE($8, tax_rate),
        discount_amount = COALESCE($9, discount_amount),
        discount_type = COALESCE($10, discount_type),
        shipping_amount = COALESCE($11, shipping_amount),
        billing_address = COALESCE($12, billing_address),
        shipping_address = COALESCE($13, shipping_address),
        notes = COALESCE($14, notes),
        terms_and_conditions = COALESCE($15, terms_and_conditions),
        footer_text = COALESCE($16, footer_text),
        modified_by = $17,
        modified_date = CURRENT_TIMESTAMP
      WHERE invoice_id = $18`,
      [
        account_id,
        contact_id,
        opportunity_id,
        invoice_date,
        due_date,
        payment_terms,
        status,
        tax_rate,
        discount_amount,
        discount_type,
        shipping_amount,
        billing_address ? JSON.stringify(billing_address) : null,
        shipping_address ? JSON.stringify(shipping_address) : null,
        notes,
        terms_and_conditions,
        footer_text,
        userId,
        invoiceId,
      ]
    );

    // Update line items if provided
    if (line_items) {
      // Delete existing line items
      await queryWithTenant(
        tenantId,
        'DELETE FROM invoice_line_items WHERE invoice_id = $1',
        [invoiceId]
      );

      // Insert new line items
      for (let i = 0; i < line_items.length; i++) {
        const item = line_items[i];
        const lineTotal =
          item.quantity * item.unit_price -
          (item.discount_amount || 0) +
          (item.tax_amount || 0);

        await queryWithTenant(
          tenantId,
          `INSERT INTO invoice_line_items (
            invoice_id, line_number, product_id, product_code,
            description, quantity, unit_price,
            discount_percent, discount_amount, tax_amount, line_total
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            invoiceId,
            i + 1,
            item.product_id,
            item.product_code,
            item.description,
            item.quantity,
            item.unit_price,
            item.discount_percent || 0,
            item.discount_amount || 0,
            item.tax_amount || 0,
            lineTotal,
          ]
        );
      }

      // Recalculate totals
      const subtotal = line_items.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unit_price,
        0
      );
      const taxAmount = (subtotal - (discount_amount || 0)) * ((tax_rate || 0) / 100);
      const totalAmount = subtotal - (discount_amount || 0) + taxAmount + (shipping_amount || 0);

      await queryWithTenant(
        tenantId,
        `UPDATE invoices
        SET subtotal = $1, tax_amount = $2, total_amount = $3,
            amount_due = $3 - COALESCE(amount_paid, 0)
        WHERE invoice_id = $4`,
        [subtotal, taxAmount, totalAmount, invoiceId]
      );
    }

    // Fetch updated invoice
    const invoices = await queryWithTenant(
      tenantId,
      `SELECT i.*,
        COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'line_item_id', li.line_item_id,
              'line_number', li.line_number,
              'product_id', li.product_id,
              'product_code', li.product_code,
              'description', li.description,
              'quantity', li.quantity,
              'unit_price', li.unit_price,
              'discount_percent', li.discount_percent,
              'discount_amount', li.discount_amount,
              'tax_amount', li.tax_amount,
              'line_total', li.line_total
            ) ORDER BY li.line_number
          ) FILTER (WHERE li.line_item_id IS NOT NULL),
          '[]'
        ) as line_items
      FROM invoices i
      LEFT JOIN invoice_line_items li ON i.invoice_id = li.invoice_id
      WHERE i.invoice_id = $1
      GROUP BY i.invoice_id`,
      [invoiceId]
    );

    res.json({
      success: true,
      data: invoices[0],
    });
  } catch (error: any) {
    console.error('Update invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update invoice',
    });
  }
});

// Delete invoice
router.delete('/:invoiceId', async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const tenantId = req.tenantId!;

    await queryWithTenant(
      tenantId,
      'DELETE FROM invoices WHERE invoice_id = $1',
      [invoiceId]
    );

    res.json({
      success: true,
      message: 'Invoice deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete invoice',
    });
  }
});

// Record payment
router.post('/:invoiceId/payments', async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;
    const { payment_date, amount_paid, payment_method, reference_number, notes } = req.body;

    if (!payment_date || !amount_paid || !payment_method) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: payment_date, amount_paid, payment_method',
      });
    }

    // Create payment record
    await queryWithTenant(
      tenantId,
      `INSERT INTO invoice_payments (
        invoice_id, tenant_id, payment_date, amount_paid,
        payment_method, reference_number, notes, processed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [invoiceId, tenantId, payment_date, amount_paid, payment_method, reference_number, notes, userId]
    );

    // Update invoice amount_paid
    await queryWithTenant(
      tenantId,
      `UPDATE invoices
      SET amount_paid = amount_paid + $1,
          amount_due = total_amount - (amount_paid + $1),
          modified_by = $2,
          modified_date = CURRENT_TIMESTAMP
      WHERE invoice_id = $3`,
      [amount_paid, userId, invoiceId]
    );

    // Get updated invoice
    const invoices = await queryWithTenant(
      tenantId,
      'SELECT * FROM invoices WHERE invoice_id = $1',
      [invoiceId]
    );

    res.json({
      success: true,
      data: invoices[0],
    });
  } catch (error: any) {
    console.error('Record payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to record payment',
    });
  }
});

// Get invoice payments
router.get('/:invoiceId/payments', async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const tenantId = req.tenantId!;

    const payments = await queryWithTenant(
      tenantId,
      `SELECT p.*, u.first_name, u.last_name
      FROM invoice_payments p
      JOIN users u ON p.processed_by = u.user_id
      WHERE p.invoice_id = $1
      ORDER BY p.payment_date DESC, p.created_date DESC`,
      [invoiceId]
    );

    res.json({
      success: true,
      data: payments,
    });
  } catch (error: any) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch payments',
    });
  }
});

// Void invoice
router.post('/:invoiceId/void', async (req: AuthRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const tenantId = req.tenantId!;
    const userId = req.userId!;

    await queryWithTenant(
      tenantId,
      `UPDATE invoices
      SET status = 'Void', modified_by = $1, modified_date = CURRENT_TIMESTAMP
      WHERE invoice_id = $2`,
      [userId, invoiceId]
    );

    const invoices = await queryWithTenant(
      tenantId,
      'SELECT * FROM invoices WHERE invoice_id = $1',
      [invoiceId]
    );

    res.json({
      success: true,
      data: invoices[0],
    });
  } catch (error: any) {
    console.error('Void invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to void invoice',
    });
  }
});

export default router;
