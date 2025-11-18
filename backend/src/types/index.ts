// Core type definitions for the application

export interface Tenant {
  tenant_id: string;
  tenant_name: string;
  subdomain: string;
  subscription_tier: string;
  enabled_modules: string[];
  created_date: Date;
  is_active: boolean;
}

export interface User {
  user_id: string;
  tenant_id: string;
  username: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  role_id: string | null;
  profile_id: string;
  is_active: boolean;
  last_login: Date | null;
  created_date: Date;
  modified_date: Date;
}

export interface Role {
  role_id: string;
  tenant_id: string;
  role_name: string;
  parent_role_id: string | null;
  description: string | null;
  created_date: Date;
  modified_date: Date;
}

export interface Profile {
  profile_id: string;
  tenant_id: string;
  profile_name: string;
  is_system: boolean;
  description: string | null;
  created_date: Date;
  modified_date: Date;
}

export interface ObjectPermission {
  permission_id: string;
  tenant_id: string;
  profile_id: string;
  object_name: string;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_view_all: boolean;
  can_modify_all: boolean;
}

export interface FieldPermission {
  permission_id: string;
  tenant_id: string;
  profile_id: string;
  object_name: string;
  field_name: string;
  can_read: boolean;
  can_edit: boolean;
}

export interface RecordType {
  record_type_id: string;
  tenant_id: string;
  object_name: string;
  record_type_name: string;
  developer_name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  is_master: boolean;
}

export interface ObjectMeta {
  object_id: string;
  tenant_id: string;
  object_name: string;
  label: string;
  plural_label: string;
  is_custom: boolean;
  is_active: boolean;
  description: string | null;
  created_by: string | null;
  created_date: Date;
  modified_date: Date;
}

export interface FieldMeta {
  field_id: string;
  tenant_id: string;
  object_id: string;
  field_name: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  is_unique: boolean;
  default_value: string | null;
  max_length: number | null;
  min_value: number | null;
  max_value: number | null;
  picklist_values: PicklistValue[] | null;
  lookup_object_id: string | null;
  description: string | null;
  created_date: Date;
  modified_date: Date;
}

export type FieldType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'url'
  | 'number'
  | 'currency'
  | 'percent'
  | 'date'
  | 'datetime'
  | 'time'
  | 'checkbox'
  | 'picklist'
  | 'multipicklist'
  | 'lookup'
  | 'master_detail'
  | 'formula'
  | 'rollup_summary'
  | 'auto_number';

export interface PicklistValue {
  label: string;
  value: string;
  is_default?: boolean;
}

export interface ObjectData {
  record_id: string;
  tenant_id: string;
  object_id: string;
  record_type_id: string | null;
  data: Record<string, any>;
  owner_id: string;
  created_by: string;
  created_date: Date;
  modified_by: string;
  modified_date: Date;
  is_deleted: boolean;
}

// Request types
export interface AuthRequest extends Express.Request {
  user?: User;
  tenant?: Tenant;
  tenantId?: string;
}

export interface JWTPayload {
  user_id: string;
  tenant_id: string;
  email: string;
  profile_id: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  subdomain?: string;
}

export interface RegisterRequest {
  tenant_name: string;
  subdomain: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

export interface CreateTenantRequest {
  tenant_name: string;
  subdomain: string;
  subscription_tier?: string;
  enabled_modules?: string[];
}

// Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  token: string;
  user: Partial<User>;
  tenant: Partial<Tenant>;
}
