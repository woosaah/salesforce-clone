import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/cpq/product-options
 * Get all product options for configurable products
 */
router.get('/product-options', async (req: Request, res: Response) => {
  try {
    const { product_id } = req.query;

    let query = `SELECT * FROM product_options WHERE 1=1`;
    const params: any[] = [];

    if (product_id) {
      query += ` AND product_id = $1`;
      params.push(product_id);
    }

    query += ` ORDER BY option_name`;

    const options = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: options,
    });
  } catch (error: any) {
    console.error('Error fetching product options:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product options',
      error: error.message,
    });
  }
});

/**
 * POST /api/cpq/product-options
 * Create a new product option
 */
router.post('/product-options', async (req: Request, res: Response) => {
  try {
    const {
      product_id,
      option_name,
      option_type, // 'Dropdown', 'Checkbox', 'Radio', 'Text'
      option_values,
      is_required,
      default_value,
    } = req.body;

    if (!product_id || !option_name || !option_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: product_id, option_name, option_type',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO product_options (
        product_id,
        option_name,
        option_type,
        option_values,
        is_required,
        default_value
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        product_id,
        option_name,
        option_type,
        JSON.stringify(option_values || []),
        is_required !== false,
        default_value,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Product option created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating product option:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product option',
      error: error.message,
    });
  }
});

/**
 * GET /api/cpq/product-rules
 * Get all product configuration rules
 */
router.get('/product-rules', async (req: Request, res: Response) => {
  try {
    const { product_id, is_active } = req.query;

    let query = `SELECT * FROM product_rules WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (product_id) {
      query += ` AND product_id = $${paramIndex}`;
      params.push(product_id);
      paramIndex++;
    }

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY rule_name`;

    const rules = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: rules,
    });
  } catch (error: any) {
    console.error('Error fetching product rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product rules',
      error: error.message,
    });
  }
});

/**
 * POST /api/cpq/product-rules
 * Create a new product configuration rule
 */
router.post('/product-rules', async (req: Request, res: Response) => {
  try {
    const {
      product_id,
      rule_name,
      rule_type, // 'Validation', 'Selection', 'Filter', 'Alert'
      rule_conditions,
      rule_actions,
      error_message,
      is_active,
    } = req.body;

    if (!product_id || !rule_name || !rule_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: product_id, rule_name, rule_type',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO product_rules (
        product_id,
        rule_name,
        rule_type,
        rule_conditions,
        rule_actions,
        error_message,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        product_id,
        rule_name,
        rule_type,
        JSON.stringify(rule_conditions || {}),
        JSON.stringify(rule_actions || {}),
        error_message,
        is_active !== false,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Product rule created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating product rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product rule',
      error: error.message,
    });
  }
});

/**
 * POST /api/cpq/product-rules/:id/validate
 * Validate a product configuration against rules
 */
router.post('/product-rules/:id/validate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { configuration } = req.body;

    // Get the rule
    const rules = await queryWithTenant(
      `SELECT * FROM product_rules WHERE rule_id = $1 AND is_active = true`,
      [id]
    );

    if (rules.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Active rule not found',
      });
    }

    const rule = rules[0];
    const conditions = rule.rule_conditions || {};

    // Simple validation logic
    let isValid = true;
    const errors: string[] = [];

    // Example: Check if required options are selected
    if (conditions.required_options) {
      conditions.required_options.forEach((optionName: string) => {
        if (!configuration[optionName]) {
          isValid = false;
          errors.push(`Required option '${optionName}' is missing`);
        }
      });
    }

    // Example: Check if incompatible options are selected together
    if (conditions.incompatible_combinations) {
      conditions.incompatible_combinations.forEach((combo: string[]) => {
        const allSelected = combo.every((opt) => configuration[opt]);
        if (allSelected) {
          isValid = false;
          errors.push(`Incompatible options: ${combo.join(', ')}`);
        }
      });
    }

    res.json({
      success: true,
      valid: isValid,
      errors: errors.length > 0 ? errors : undefined,
      rule_name: rule.rule_name,
    });
  } catch (error: any) {
    console.error('Error validating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate configuration',
      error: error.message,
    });
  }
});

/**
 * GET /api/cpq/quote-line-items
 * Get quote line items for a quote
 */
router.get('/quote-line-items', async (req: Request, res: Response) => {
  try {
    const { quote_id } = req.query;

    if (!quote_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameter: quote_id',
      });
    }

    const lineItems = await queryWithTenant(
      `SELECT qli.*,
              p.product_name,
              p.product_code
       FROM quote_line_items qli
       LEFT JOIN products p ON qli.product_id = p.product_id
       WHERE qli.quote_id = $1
       ORDER BY qli.line_number`,
      [quote_id]
    );

    res.json({
      success: true,
      data: lineItems,
    });
  } catch (error: any) {
    console.error('Error fetching quote line items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quote line items',
      error: error.message,
    });
  }
});

/**
 * POST /api/cpq/quote-line-items
 * Add a line item to a quote
 */
router.post('/quote-line-items', async (req: Request, res: Response) => {
  try {
    const {
      quote_id,
      product_id,
      quantity,
      unit_price,
      discount_percent,
      product_configuration,
      description,
    } = req.body;

    if (!quote_id || !product_id || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: quote_id, product_id, quantity',
      });
    }

    // Calculate pricing
    const baseAmount = (unit_price || 0) * quantity;
    const discountAmount = baseAmount * ((discount_percent || 0) / 100);
    const totalPrice = baseAmount - discountAmount;

    // Get next line number
    const lineNumbers = await queryWithTenant(
      `SELECT COALESCE(MAX(line_number), 0) + 1 as next_line
       FROM quote_line_items
       WHERE quote_id = $1`,
      [quote_id]
    );

    const lineNumber = lineNumbers[0].next_line;

    const result = await queryWithTenant(
      `INSERT INTO quote_line_items (
        quote_id,
        product_id,
        line_number,
        quantity,
        unit_price,
        discount_percent,
        total_price,
        product_configuration,
        description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        quote_id,
        product_id,
        lineNumber,
        quantity,
        unit_price || 0,
        discount_percent || 0,
        totalPrice,
        JSON.stringify(product_configuration || {}),
        description,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Quote line item added successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error adding quote line item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add quote line item',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/cpq/quote-line-items/:id
 * Update a quote line item
 */
router.patch('/quote-line-items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If quantity, unit_price, or discount changed, recalculate total
    if (updates.quantity || updates.unit_price || updates.discount_percent) {
      // Get current line item
      const current = await queryWithTenant(
        `SELECT * FROM quote_line_items WHERE line_item_id = $1`,
        [id]
      );

      if (current.length > 0) {
        const item = current[0];
        const quantity = updates.quantity || item.quantity;
        const unitPrice = updates.unit_price || item.unit_price;
        const discount = updates.discount_percent || item.discount_percent;

        const baseAmount = unitPrice * quantity;
        const discountAmount = baseAmount * (discount / 100);
        updates.total_price = baseAmount - discountAmount;
      }
    }

    // Build dynamic update query
    const allowedFields = [
      'quantity',
      'unit_price',
      'discount_percent',
      'total_price',
      'product_configuration',
      'description',
    ];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          key === 'product_configuration' && typeof updates[key] === 'object'
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
      `UPDATE quote_line_items SET ${setFields.join(', ')}
       WHERE line_item_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quote line item not found',
      });
    }

    res.json({
      success: true,
      message: 'Quote line item updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating quote line item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update quote line item',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/cpq/quote-line-items/:id
 * Remove a line item from a quote
 */
router.delete('/quote-line-items/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM quote_line_items WHERE line_item_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Quote line item not found',
      });
    }

    res.json({
      success: true,
      message: 'Quote line item removed successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error removing quote line item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove quote line item',
      error: error.message,
    });
  }
});

/**
 * POST /api/cpq/quotes/:id/calculate
 * Recalculate quote totals based on all line items
 */
router.post('/quotes/:id/calculate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get all line items for the quote
    const lineItems = await queryWithTenant(
      `SELECT * FROM quote_line_items WHERE quote_id = $1`,
      [id]
    );

    // Calculate totals
    const subtotal = lineItems.reduce((sum: number, item: any) => {
      return sum + (item.total_price || 0);
    }, 0);

    const tax = subtotal * 0.1; // Example: 10% tax
    const grandTotal = subtotal + tax;

    res.json({
      success: true,
      data: {
        quote_id: id,
        line_item_count: lineItems.length,
        subtotal,
        tax,
        grand_total: grandTotal,
        line_items: lineItems,
      },
    });
  } catch (error: any) {
    console.error('Error calculating quote:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate quote',
      error: error.message,
    });
  }
});

export default router;
