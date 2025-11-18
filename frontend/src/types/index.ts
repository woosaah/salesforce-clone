// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth types
export interface User {
  user_id: string;
  email: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  tenant_id: string;
  profile_id: string;
  role_id: string | null;
}

export interface Tenant {
  tenant_id: string;
  tenant_name: string;
  subdomain: string;
  subscription_tier: string;
}

export interface LoginResponse {
  token: string;
  user: Partial<User>;
  tenant: Partial<Tenant>;
}

export interface LoginRequest {
  email: string;
  password: string;
  subdomain?: string;
}

// Object metadata types
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
  created_date: string;
  modified_date: string;
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
  created_date: string;
  modified_date: string;
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

export interface ObjectData {
  record_id: string;
  tenant_id: string;
  object_id: string;
  record_type_id: string | null;
  data: Record<string, any>;
  owner_id: string;
  created_by: string;
  created_date: string;
  modified_by: string;
  modified_date: string;
  is_deleted: boolean;
}

export interface ObjectMetadataResponse {
  object: ObjectMeta;
  fields: FieldMeta[];
}

export interface RecordsListResponse {
  records: ObjectData[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}
