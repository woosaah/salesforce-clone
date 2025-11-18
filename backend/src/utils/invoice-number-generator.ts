import { queryWithTenant } from '../config/database';

interface InvoiceSettings {
  invoice_prefix: string;
  next_invoice_number: number;
}

export class InvoiceNumberGenerator {
  async getNextNumber(tenantId: string): Promise<string> {
    // Get invoice settings for tenant
    const settings = await queryWithTenant<InvoiceSettings>(
      tenantId,
      'SELECT invoice_prefix, next_invoice_number FROM invoice_settings WHERE tenant_id = $1',
      [tenantId]
    );

    if (settings.length === 0) {
      // Create default settings if they don't exist
      await queryWithTenant(
        tenantId,
        `INSERT INTO invoice_settings (tenant_id, invoice_prefix, next_invoice_number)
         VALUES ($1, 'INV', 1)`,
        [tenantId]
      );

      return 'INV-00001';
    }

    const { invoice_prefix, next_invoice_number } = settings[0];

    // Format number with leading zeros (5 digits)
    const formattedNumber = String(next_invoice_number).padStart(5, '0');
    const invoiceNumber = `${invoice_prefix}-${formattedNumber}`;

    // Increment for next invoice
    await queryWithTenant(
      tenantId,
      'UPDATE invoice_settings SET next_invoice_number = next_invoice_number + 1 WHERE tenant_id = $1',
      [tenantId]
    );

    return invoiceNumber;
  }
}
