# Testing Guide

## Overview

This CRM system includes a comprehensive testing framework with:
- **Unit Tests**: Test individual functions and modules
- **Integration Tests**: Test API endpoints and database interactions
- **Test Utilities**: Helper functions for creating test data

## Test Stack

- **Jest**: Testing framework
- **Supertest**: HTTP assertion library for API testing
- **ts-jest**: TypeScript support for Jest

## Running Tests

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## Test Structure

```
tests/
├── unit/                  # Unit tests
│   ├── services/
│   └── utils/
├── integration/           # Integration tests
│   ├── api/              # API endpoint tests
│   │   ├── objects.test.ts
│   │   ├── accounts.test.ts
│   │   └── workflows.test.ts
│   └── workflows/        # Workflow engine tests
│       └── workflow-engine.test.ts
└── utils/                 # Test utilities
    └── db-utils.ts       # Database test helpers
```

## Writing Tests

### Unit Test Example

```typescript
// tests/unit/services/email.test.ts
import { EmailService } from '../../../src/services/email';

describe('EmailService', () => {
  it('should format email template correctly', () => {
    const service = new EmailService();
    const result = service.formatTemplate('Hello {name}', { name: 'John' });

    expect(result).toBe('Hello John');
  });
});
```

### Integration Test Example

```typescript
// tests/integration/api/accounts.test.ts
import request from 'supertest';
import app from '../../../src/index';
import { createTestTenant, deleteTestTenant, getAuthToken } from '../../utils/db-utils';

describe('Accounts API', () => {
  let tenant: any;
  let authToken: string;

  beforeAll(async () => {
    tenant = await createTestTenant();
    authToken = await getAuthToken(tenant.admin_user.user_id);
  });

  afterAll(async () => {
    await deleteTestTenant(tenant.tenant_id);
  });

  it('should create an account', async () => {
    const response = await request(app)
      .post('/api/accounts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Account',
        industry: 'Technology'
      });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Test Account');
  });
});
```

## Test Utilities

### Database Helpers

The `db-utils.ts` file provides helper functions for testing:

```typescript
import {
  createTestTenant,
  deleteTestTenant,
  createTestUser,
  createTestRecord,
  getAuthToken,
  resetDatabase
} from '../utils/db-utils';

// Create a test tenant with admin user
const tenant = await createTestTenant('My Test Tenant');

// Create additional test users
const user = await createTestUser(tenant.tenant_id, 'user@test.com');

// Get auth token for API requests
const token = await getAuthToken(user.user_id);

// Create test records
const account = await createTestRecord(
  tenant.tenant_id,
  'Account',
  { name: 'Test Account' }
);

// Clean up
await deleteTestTenant(tenant.tenant_id);
```

## Test Isolation

Each test should:
1. Create its own test tenant
2. Clean up after itself
3. Not depend on other tests
4. Use unique data to avoid conflicts

Example:
```typescript
describe('My Feature', () => {
  let tenant: any;

  beforeAll(async () => {
    tenant = await createTestTenant();
  });

  afterAll(async () => {
    if (tenant) {
      await deleteTestTenant(tenant.tenant_id);
    }
  });

  it('should work correctly', async () => {
    // Test code here
  });
});
```

## Testing Workflows

Workflow tests should verify:
1. Triggers fire correctly (on_create, on_update, etc.)
2. Criteria evaluate properly
3. Actions execute (field updates, email alerts, etc.)
4. Time-based actions schedule correctly

Example:
```typescript
it('should trigger workflow on record create', async () => {
  // Create workflow
  const workflow = await createWorkflow({
    trigger_type: 'on_create',
    object_name: 'Lead',
    actions: [{ type: 'field_update', field: 'Status', value: 'Working' }]
  });

  // Create lead
  const lead = await createTestRecord(tenant.tenant_id, 'Lead', {
    FirstName: 'Test',
    LastName: 'Lead'
  });

  // Verify workflow executed
  const updated = await getRecord(lead.record_id);
  expect(updated.data.Status).toBe('Working');
});
```

## Testing Multi-Tenancy

Multi-tenancy tests should verify:
1. Users only see their tenant's data
2. RLS policies enforce isolation
3. Cross-tenant access is prevented

Example:
```typescript
it('should not show data from other tenants', async () => {
  const tenant1 = await createTestTenant('Tenant 1');
  const tenant2 = await createTestTenant('Tenant 2');

  // Create account in tenant 1
  await createTestRecord(tenant1.tenant_id, 'Account', { name: 'Tenant 1 Account' });

  // Try to access as tenant 2 user
  const token = await getAuthToken(tenant2.admin_user.user_id);
  const response = await request(app)
    .get('/api/accounts')
    .set('Authorization', `Bearer ${token}`);

  // Should not see tenant 1's account
  const accountNames = response.body.map((a: any) => a.name);
  expect(accountNames).not.toContain('Tenant 1 Account');

  await deleteTestTenant(tenant1.tenant_id);
  await deleteTestTenant(tenant2.tenant_id);
});
```

## Code Coverage

The project aims for 80% code coverage across:
- Branches
- Functions
- Lines
- Statements

View coverage report:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

## Best Practices

1. **Descriptive Test Names**: Use clear, descriptive test names
   ```typescript
   it('should reject invalid email format', () => {});
   ```

2. **Arrange-Act-Assert**: Structure tests clearly
   ```typescript
   it('should create user', async () => {
     // Arrange
     const userData = { email: 'test@test.com' };

     // Act
     const user = await createUser(userData);

     // Assert
     expect(user.email).toBe('test@test.com');
   });
   ```

3. **Test Edge Cases**: Don't just test happy paths
   - Invalid inputs
   - Missing required fields
   - Duplicate data
   - Authorization failures

4. **Clean Up Resources**: Always clean up test data
   - Use `afterAll` and `afterEach` hooks
   - Delete test tenants
   - Close database connections

5. **Avoid Test Dependencies**: Tests should run independently
   - Don't rely on test execution order
   - Each test creates its own data

## Continuous Integration

Tests run automatically on:
- Every commit (via Git hooks)
- Pull requests (via GitHub Actions)
- Before deployment

See `.github/workflows/test.yml` for CI configuration.

## Troubleshooting

### Tests Timing Out
Increase timeout in jest.config.js:
```javascript
testTimeout: 30000  // 30 seconds
```

### Database Connection Issues
1. Verify PostgreSQL is running
2. Check environment variables
3. Ensure test database exists

### Failed Cleanup
If tests fail to clean up:
```bash
# Manually reset test database
npm run db:reset-test
```

## Next Steps

- Add E2E tests with Cypress
- Add performance tests with k6
- Add visual regression tests
- Increase coverage to 90%+
- Add mutation testing
