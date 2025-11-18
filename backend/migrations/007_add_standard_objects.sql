-- Migration: Add standard objects with record types
-- Description: Creates Account, Contact, Product, Asset, Case with fields and record types

-- This migration enhances the seed data by adding proper record types
-- Note: objects_meta entries for Account, Contact, Product, Asset are created in seed
-- This migration adds Case object and specific record types for all objects

-- Function to get tenant_id and admin_user_id for a specific subdomain
-- This is a helper migration that will work with the demo tenant

DO $$
DECLARE
    demo_tenant_id UUID;
    admin_user_id UUID;
    account_object_id UUID;
    contact_object_id UUID;
    product_object_id UUID;
    asset_object_id UUID;
    case_object_id UUID;
BEGIN
    -- Get demo tenant (this migration assumes seed has run)
    -- If running in production, this would be run per tenant
    SELECT tenant_id INTO demo_tenant_id
    FROM tenants
    WHERE subdomain = 'birdseed'
    LIMIT 1;

    -- Exit if no demo tenant found
    IF demo_tenant_id IS NULL THEN
        RAISE NOTICE 'No demo tenant found. Run seed script first.';
        RETURN;
    END IF;

    -- Get admin user
    SELECT user_id INTO admin_user_id
    FROM users
    WHERE tenant_id = demo_tenant_id
    ORDER BY created_date
    LIMIT 1;

    -- Get existing object IDs
    SELECT object_id INTO account_object_id FROM objects_meta WHERE tenant_id = demo_tenant_id AND object_name = 'Account';
    SELECT object_id INTO contact_object_id FROM objects_meta WHERE tenant_id = demo_tenant_id AND object_name = 'Contact';
    SELECT object_id INTO product_object_id FROM objects_meta WHERE tenant_id = demo_tenant_id AND object_name = 'Product';
    SELECT object_id INTO asset_object_id FROM objects_meta WHERE tenant_id = demo_tenant_id AND object_name = 'Asset';

    -- Create Case object if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM objects_meta WHERE tenant_id = demo_tenant_id AND object_name = 'Case') THEN
        INSERT INTO objects_meta (tenant_id, object_name, label, plural_label, is_custom, description, created_by)
        VALUES (demo_tenant_id, 'Case', 'Case', 'Cases', false, 'Customer support cases and issues', admin_user_id)
        RETURNING object_id INTO case_object_id;

        -- Add Case fields
        INSERT INTO fields_meta (tenant_id, object_id, field_name, label, field_type, is_required, picklist_values) VALUES
        (demo_tenant_id, case_object_id, 'CaseNumber', 'Case Number', 'auto_number', false, NULL),
        (demo_tenant_id, case_object_id, 'Subject', 'Subject', 'text', true, NULL),
        (demo_tenant_id, case_object_id, 'Description', 'Description', 'textarea', false, NULL),
        (demo_tenant_id, case_object_id, 'Status', 'Status', 'picklist', true,
            '[{"label":"New","value":"new","is_default":true},{"label":"In Progress","value":"in_progress"},{"label":"Waiting","value":"waiting"},{"label":"Resolved","value":"resolved"},{"label":"Closed","value":"closed"}]'::jsonb),
        (demo_tenant_id, case_object_id, 'Priority', 'Priority', 'picklist', true,
            '[{"label":"Low","value":"low"},{"label":"Medium","value":"medium","is_default":true},{"label":"High","value":"high"},{"label":"Critical","value":"critical"}]'::jsonb),
        (demo_tenant_id, case_object_id, 'Origin', 'Case Origin', 'picklist', false,
            '[{"label":"Phone","value":"phone"},{"label":"Email","value":"email","is_default":true},{"label":"Web","value":"web"},{"label":"Chat","value":"chat"}]'::jsonb),
        (demo_tenant_id, case_object_id, 'Type', 'Case Type', 'picklist', false,
            '[{"label":"Question","value":"question"},{"label":"Problem","value":"problem"},{"label":"Feature Request","value":"feature_request"}]'::jsonb);

        RAISE NOTICE 'Created Case object with fields';
    END IF;

    -- Add specific record types for Account (Bird Seed Business theme)
    IF account_object_id IS NOT NULL THEN
        -- Bird Breeder record type
        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Account' AND developer_name = 'Bird_Breeder') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Account', 'Bird Breeder', 'Bird_Breeder', 'Individual bird breeders and hobbyists', true, false);
        END IF;

        -- Business Customer record type
        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Account' AND developer_name = 'Business_Customer') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Account', 'Business Customer', 'Business_Customer', 'Pet stores and commercial customers', true, true);
        END IF;

        -- Supplier record type
        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Account' AND developer_name = 'Supplier') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Account', 'Supplier', 'Supplier', 'Seed and equipment suppliers', true, false);
        END IF;

        -- Add Parent Account lookup field
        IF NOT EXISTS (SELECT 1 FROM fields_meta WHERE tenant_id = demo_tenant_id AND object_id = account_object_id AND field_name = 'ParentAccountId') THEN
            INSERT INTO fields_meta (tenant_id, object_id, field_name, label, field_type, is_required, lookup_object_id)
            VALUES (demo_tenant_id, account_object_id, 'ParentAccountId', 'Parent Account', 'lookup', false, account_object_id);
        END IF;

        RAISE NOTICE 'Created Account record types';
    END IF;

    -- Add specific record types for Contact
    IF contact_object_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Contact' AND developer_name = 'Business_Contact') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Contact', 'Business Contact', 'Business_Contact', 'Business and commercial contacts', true, true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Contact' AND developer_name = 'Personal_Contact') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Contact', 'Personal Contact', 'Personal_Contact', 'Individual hobbyist contacts', true, false);
        END IF;

        -- Add Account lookup field to Contact
        IF NOT EXISTS (SELECT 1 FROM fields_meta WHERE tenant_id = demo_tenant_id AND object_id = contact_object_id AND field_name = 'AccountId') THEN
            INSERT INTO fields_meta (tenant_id, object_id, field_name, label, field_type, is_required, lookup_object_id)
            VALUES (demo_tenant_id, contact_object_id, 'AccountId', 'Account', 'lookup', false, account_object_id);
        END IF;

        RAISE NOTICE 'Created Contact record types';
    END IF;

    -- Add specific record types for Product
    IF product_object_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Product' AND developer_name = 'Bird_Seed') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Product', 'Bird Seed', 'Bird_Seed', 'Various bird seed products', true, true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Product' AND developer_name = 'Equipment') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Product', 'Equipment', 'Equipment', 'Feeders and bird care equipment', true, false);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Product' AND developer_name = 'Accessory') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Product', 'Accessory', 'Accessory', 'Bird care accessories and supplies', true, false);
        END IF;

        RAISE NOTICE 'Created Product record types';
    END IF;

    -- Add specific record types for Asset
    IF asset_object_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Asset' AND developer_name = 'Feeder') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Asset', 'Feeder', 'Feeder', 'Bird feeders at customer locations', true, true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Asset' AND developer_name = 'Equipment') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Asset', 'Equipment', 'Equipment', 'Other equipment at customer sites', true, false);
        END IF;

        -- Add Account and Product lookup fields to Asset
        IF NOT EXISTS (SELECT 1 FROM fields_meta WHERE tenant_id = demo_tenant_id AND object_id = asset_object_id AND field_name = 'AccountId') THEN
            INSERT INTO fields_meta (tenant_id, object_id, field_name, label, field_type, is_required, lookup_object_id)
            VALUES (demo_tenant_id, asset_object_id, 'AccountId', 'Account', 'lookup', false, account_object_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM fields_meta WHERE tenant_id = demo_tenant_id AND object_id = asset_object_id AND field_name = 'ProductId') THEN
            INSERT INTO fields_meta (tenant_id, object_id, field_name, label, field_type, is_required, lookup_object_id)
            VALUES (demo_tenant_id, asset_object_id, 'ProductId', 'Product', 'lookup', false, product_object_id);
        END IF;

        RAISE NOTICE 'Created Asset record types';
    END IF;

    -- Add specific record types for Case
    IF case_object_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Case' AND developer_name = 'Support_Case') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Case', 'Support Case', 'Support_Case', 'General customer support cases', true, true);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM record_types WHERE tenant_id = demo_tenant_id AND object_name = 'Case' AND developer_name = 'Product_Issue') THEN
            INSERT INTO record_types (tenant_id, object_name, record_type_name, developer_name, description, is_active, is_default)
            VALUES (demo_tenant_id, 'Case', 'Product Issue', 'Product_Issue', 'Product quality or defect issues', true, false);
        END IF;

        -- Add Account and Contact lookup fields to Case
        IF NOT EXISTS (SELECT 1 FROM fields_meta WHERE tenant_id = demo_tenant_id AND object_id = case_object_id AND field_name = 'AccountId') THEN
            INSERT INTO fields_meta (tenant_id, object_id, field_name, label, field_type, is_required, lookup_object_id)
            VALUES (demo_tenant_id, case_object_id, 'AccountId', 'Account', 'lookup', false, account_object_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM fields_meta WHERE tenant_id = demo_tenant_id AND object_name = 'Case' AND field_name = 'ContactId') THEN
            INSERT INTO fields_meta (tenant_id, object_id, field_name, label, field_type, is_required, lookup_object_id)
            VALUES (demo_tenant_id, case_object_id, 'ContactId', 'Contact', 'lookup', false, contact_object_id);
        END IF;

        RAISE NOTICE 'Created Case record types';
    END IF;

    RAISE NOTICE 'Standard objects migration completed successfully';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error in migration: %', SQLERRM;
    RAISE;
END $$;

-- Create indexes for new lookup fields
CREATE INDEX IF NOT EXISTS idx_account_parent ON object_data USING GIN ((data->'ParentAccountId'));
CREATE INDEX IF NOT EXISTS idx_contact_account ON object_data USING GIN ((data->'AccountId'));
CREATE INDEX IF NOT EXISTS idx_asset_account ON object_data USING GIN ((data->'AccountId'));
CREATE INDEX IF NOT EXISTS idx_asset_product ON object_data USING GIN ((data->'ProductId'));
CREATE INDEX IF NOT EXISTS idx_case_account ON object_data USING GIN ((data->'AccountId'));
CREATE INDEX IF NOT EXISTS idx_case_contact ON object_data USING GIN ((data->'ContactId'));

COMMENT ON INDEX idx_account_parent IS 'Index for Account parent/child hierarchy lookups';
COMMENT ON INDEX idx_contact_account IS 'Index for Contact to Account lookups';
COMMENT ON INDEX idx_asset_account IS 'Index for Asset to Account lookups';
COMMENT ON INDEX idx_case_account IS 'Index for Case to Account lookups';
