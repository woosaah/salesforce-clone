import request from 'supertest';
import app from '../../../src/index';
import { createTestTenant, deleteTestTenant, getAuthToken } from '../../utils/db-utils';

describe('Objects API', () => {
  let tenant: any;
  let authToken: string;

  beforeAll(async () => {
    tenant = await createTestTenant();
    authToken = await getAuthToken(tenant.admin_user.user_id);
  });

  afterAll(async () => {
    if (tenant) {
      await deleteTestTenant(tenant.tenant_id);
    }
  });

  describe('POST /api/objects', () => {
    it('should create a custom object', async () => {
      const response = await request(app)
        .post('/api/objects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          object_name: 'Test_Object__c',
          label: 'Test Object',
          plural_label: 'Test Objects',
        });

      expect(response.status).toBe(201);
      expect(response.body.object_name).toBe('Test_Object__c');
    });

    it('should reject duplicate object names', async () => {
      // Create first object
      await request(app)
        .post('/api/objects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          object_name: 'Duplicate__c',
          label: 'Duplicate',
        });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/objects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          object_name: 'Duplicate__c',
          label: 'Duplicate Again',
        });

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app).post('/api/objects').send({
        object_name: 'Test__c',
        label: 'Test',
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/objects', () => {
    it('should list all objects for tenant', async () => {
      const response = await request(app)
        .get('/api/objects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should not show objects from other tenants', async () => {
      const otherTenant = await createTestTenant('Other Tenant');
      const otherToken = await getAuthToken(otherTenant.admin_user.user_id);

      const response = await request(app)
        .get('/api/objects')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(200);
      // Should only see standard objects, not test objects from first tenant
      const testObjects = response.body.filter((obj: any) =>
        obj.object_name.includes('Test_Object__c')
      );
      expect(testObjects.length).toBe(0);

      await deleteTestTenant(otherTenant.tenant_id);
    });
  });
});
