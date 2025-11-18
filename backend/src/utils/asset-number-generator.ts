import { queryWithTenant } from '../config/database';

interface AssetSettings {
  asset_prefix: string;
  next_asset_number: number;
}

export class AssetNumberGenerator {
  async getNextNumber(tenantId: string, prefix: string = 'ASSET'): Promise<string> {
    // For simplicity, we'll use a counter approach
    // In production, you might want a dedicated settings table
    const existingAssets = await queryWithTenant<{count: string}>(
      tenantId,
      `SELECT COUNT(*) as count FROM assets WHERE tenant_id = $1`,
      [tenantId]
    );

    const nextNumber = parseInt(existingAssets[0].count) + 1;
    const formattedNumber = String(nextNumber).padStart(6, '0');

    return `${prefix}-${formattedNumber}`;
  }
}
