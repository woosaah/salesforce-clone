import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  ObjectMeta,
  ObjectMetadataResponse,
  RecordType,
  RecordsListResponse,
  ObjectData,
} from '../types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to inject auth token
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse>) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.api.post<ApiResponse<LoginResponse>>('/auth/login', data);
    if (response.data.success && response.data.data) {
      // Store token
      localStorage.setItem('authToken', response.data.data.token);
      return response.data.data;
    }
    throw new Error(response.data.error || 'Login failed');
  }

  async getCurrentUser(): Promise<{ user: any; tenant: any }> {
    const response = await this.api.get<ApiResponse<{ user: any; tenant: any }>>('/auth/me');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get user');
  }

  logout(): void {
    localStorage.removeItem('authToken');
    window.location.href = '/login';
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('authToken');
  }

  // Object metadata endpoints
  async getObjects(): Promise<ObjectMeta[]> {
    const response = await this.api.get<ApiResponse<ObjectMeta[]>>('/objects');
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get objects');
  }

  async getObjectMetadata(objectName: string): Promise<ObjectMetadataResponse> {
    const response = await this.api.get<ApiResponse<ObjectMetadataResponse>>(
      `/objects/${objectName}/metadata`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get object metadata');
  }

  async getRecordTypes(objectName: string): Promise<RecordType[]> {
    const response = await this.api.get<ApiResponse<RecordType[]>>(
      `/objects/${objectName}/record-types`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get record types');
  }

  // CRUD operations
  async getRecords(
    objectName: string,
    params?: {
      limit?: number;
      offset?: number;
      recordTypeId?: string;
    }
  ): Promise<RecordsListResponse> {
    const response = await this.api.get<ApiResponse<RecordsListResponse>>(
      `/objects/${objectName}/records`,
      { params }
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get records');
  }

  async getRecord(objectName: string, recordId: string): Promise<ObjectData> {
    const response = await this.api.get<ApiResponse<ObjectData>>(
      `/objects/${objectName}/records/${recordId}`
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get record');
  }

  async createRecord(
    objectName: string,
    data: Record<string, any>,
    recordTypeId?: string
  ): Promise<ObjectData> {
    const response = await this.api.post<ApiResponse<ObjectData>>(
      `/objects/${objectName}/records`,
      { data, recordTypeId }
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to create record');
  }

  async updateRecord(
    objectName: string,
    recordId: string,
    data: Record<string, any>
  ): Promise<ObjectData> {
    const response = await this.api.put<ApiResponse<ObjectData>>(
      `/objects/${objectName}/records/${recordId}`,
      { data }
    );
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to update record');
  }

  async deleteRecord(objectName: string, recordId: string): Promise<void> {
    const response = await this.api.delete<ApiResponse>(
      `/objects/${objectName}/records/${recordId}`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete record');
    }
  }

  // Query endpoints
  async executeQuery(query: string): Promise<any> {
    const response = await this.api.post<ApiResponse<any>>('/query/execute', {
      query,
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Query execution failed');
  }

  async getQueryHistory(params?: {
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const response = await this.api.get<ApiResponse<any>>('/query/history', {
      params,
    });
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    throw new Error(response.data.error || 'Failed to get query history');
  }

  async deleteQueryHistory(queryId: string): Promise<void> {
    const response = await this.api.delete<ApiResponse>(`/query/history/${queryId}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete query history');
    }
  }
}

export const api = new ApiService();
export default api;
