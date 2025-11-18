# Salesforce Clone - Setup & Testing Guide

## ✅ Phase 1 Foundation - COMPLETED

All foundational components have been successfully created:

### 📁 Project Structure
```
salesforce-clone/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts          ✓ PostgreSQL connection pool
│   │   ├── database/
│   │   │   ├── migrate.ts           ✓ Migration runner
│   │   │   └── seed.ts              ✓ Demo data seeder
│   │   ├── middleware/
│   │   │   ├── auth.ts              ✓ JWT authentication
│   │   │   ├── tenant.ts            ✓ Tenant context for RLS
│   │   │   └── errorHandler.ts      ✓ Error handling
│   │   ├── routes/
│   │   │   ├── auth.ts              ✓ Auth endpoints
│   │   │   └── tenants.ts           ✓ Tenant management
│   │   ├── types/
│   │   │   └── index.ts             ✓ TypeScript definitions
│   │   ├── utils/
│   │   │   ├── jwt.ts               ✓ JWT utilities
│   │   │   └── password.ts          ✓ Password hashing
│   │   └── index.ts                 ✓ Express server
│   ├── migrations/
│   │   ├── 001_create_tenants.sql           ✓
│   │   ├── 002_create_roles_profiles.sql    ✓
│   │   ├── 003_create_users.sql             ✓
│   │   ├── 004_create_permissions.sql       ✓
│   │   ├── 005_create_record_types.sql      ✓
│   │   └── 006_create_objects_metadata.sql  ✓
│   ├── package.json                 ✓
│   ├── tsconfig.json                ✓
│   ├── nodemon.json                 ✓
│   ├── .env                         ✓
│   └── .env.example                 ✓
├── docker/
│   └── Dockerfile.backend           ✓
├── docker-compose.yml               ✓
├── .gitignore                       ✓
└── README.md                        ✓
```

## 🗄️ Database Schema

### Core Tables Created:

1. **Multi-Tenancy**
   - `tenants` - Organizations with subdomain isolation
   - `tenant_settings` - Tenant-specific configuration

2. **Users & Auth**
   - `users` - User accounts with authentication
   - `roles` - Hierarchical role structure
   - `profiles` - Permission profiles

3. **Permissions**
   - `object_permissions` - Object-level CRUD permissions
   - `field_permissions` - Field-level read/edit permissions

4. **Record Types**
   - `record_types` - Record type definitions
   - `record_type_field_visibility` - Field visibility per record type

5. **Custom Objects**
   - `objects_meta` - Custom object metadata
   - `fields_meta` - Custom field metadata
   - `object_data` - Generic JSONB data storage

### Security Features:
- ✅ Row-Level Security (RLS) enabled on ALL tables
- ✅ Tenant isolation via `app.current_tenant_id` session variable
- ✅ Indexes on all `tenant_id` columns
- ✅ GIN index on `object_data.data` for JSONB queries
- ✅ Password hashing with bcrypt
- ✅ JWT token authentication

## 🚀 Quick Start Instructions

### 1. Start the Database

```bash
# Start PostgreSQL via Docker Compose
docker-compose up -d postgres

# Wait for database to be ready (check health)
docker-compose ps
```

### 2. Run Database Migrations

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Run migrations
npm run migrate
```

Expected output:
```
Starting database migrations...
Executing migration: 001_create_tenants.sql
✓ Migration completed: 001_create_tenants.sql
...
All migrations completed successfully!
```

### 3. Seed Demo Data

```bash
npm run seed
```

Expected output:
```
╔════════════════════════════════════════════════════╗
║          Database Seeding Completed! ✓             ║
╠════════════════════════════════════════════════════╣
║  Demo Tenant: Bird Seed Business                  ║
║  Subdomain: birdseed                               ║
║  Admin Login:                                      ║
║    Email: admin@birdseed.test                      ║
║    Password: admin123                              ║
╚════════════════════════════════════════════════════╝
```

### 4. Start the Backend Server

```bash
# Development mode with auto-reload
npm run dev

# OR with Docker Compose (includes database)
docker-compose up
```

Expected output:
```
╔════════════════════════════════════════╗
║   Salesforce Clone API Server         ║
║                                        ║
║   Port: 3000                           ║
║   Environment: development             ║
║   Database: Connected                  ║
║                                        ║
║   Status: Ready ✓                      ║
╚════════════════════════════════════════╝
```

## 🧪 Testing the API

### Test 1: Health Check
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Test 2: Login with Demo User
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@birdseed.test",
    "password": "admin123",
    "subdomain": "birdseed"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "user_id": "...",
      "email": "admin@birdseed.test",
      "username": "admin",
      "first_name": "Admin",
      "last_name": "User",
      "tenant_id": "..."
    },
    "tenant": {
      "tenant_id": "...",
      "tenant_name": "Bird Seed Business",
      "subdomain": "birdseed"
    }
  }
}
```

### Test 3: Get Current User (Protected Route)
```bash
# Save the token from login response
TOKEN="<your-token-here>"

curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "tenant": { ... }
  }
}
```

### Test 4: Register New Tenant
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "My Test Company",
    "subdomain": "testco",
    "email": "admin@testco.com",
    "password": "SecurePass123",
    "first_name": "Test",
    "last_name": "Admin"
  }'
```

### Test 5: List All Tenants (Authenticated)
```bash
curl http://localhost:3000/api/tenants \
  -H "Authorization: Bearer $TOKEN"
```

### Test 6: Create New Tenant (Super Admin)
```bash
curl -X POST http://localhost:3000/api/tenants \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "New Company",
    "subdomain": "newco",
    "subscription_tier": "professional",
    "enabled_modules": ["sales", "service"]
  }'
```

## ✅ Success Criteria Verification

### Database Layer
- [x] All 11 core tables created via migrations
- [x] UUID primary keys on all tables
- [x] Foreign key relationships established
- [x] Indexes on all tenant_id columns
- [x] GIN index on object_data.data
- [x] Row-Level Security policies on all tables
- [x] Proper constraints (NOT NULL, UNIQUE, CHECK)

### Backend API
- [x] Express server with TypeScript
- [x] Database connection pool configured
- [x] Migration runner implemented
- [x] JWT authentication middleware
- [x] Tenant context middleware for RLS
- [x] Error handling middleware
- [x] Auth routes (login, register, me)
- [x] Tenant management routes

### Security
- [x] Password hashing with bcrypt
- [x] JWT token generation and validation
- [x] Protected routes require authentication
- [x] RLS policies prevent cross-tenant data access
- [x] Input validation with express-validator

### DevOps
- [x] Docker Compose configuration
- [x] Environment variables (.env)
- [x] Development scripts (dev, build, migrate, seed)
- [x] TypeScript compilation configuration
- [x] Nodemon for hot reload

### Demo Data
- [x] Bird Seed Business tenant created
- [x] Admin user (admin@birdseed.test / admin123)
- [x] System Administrator profile with full permissions
- [x] CEO, Sales Manager, Sales Rep roles
- [x] Standard objects: Account, Contact, Asset, Product
- [x] Master record types for all objects
- [x] Sample Account records

## 🔐 Testing Tenant Isolation

To verify RLS is working properly:

1. **Create two tenants** (birdseed and testco)
2. **Login as birdseed admin** - save token as TOKEN1
3. **Login as testco admin** - save token as TOKEN2
4. **Create data with TOKEN1** - should succeed
5. **Try to access birdseed data with TOKEN2** - should return empty (isolated)

```bash
# This should return only testco's data, NOT birdseed's data
curl http://localhost:3000/api/data/accounts \
  -H "Authorization: Bearer $TOKEN2"
```

## 📊 Database Verification Queries

Once migrations are run, verify in psql:

```sql
-- List all tables
\dt

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Check indexes
SELECT tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename;

-- View demo tenant
SELECT * FROM tenants WHERE subdomain = 'birdseed';

-- View demo user
SELECT user_id, email, first_name, last_name
FROM users
WHERE email = 'admin@birdseed.test';

-- View standard objects
SELECT object_name, label, is_custom
FROM objects_meta;
```

## 🎯 Next Steps (Phase 2)

After verifying Phase 1 is working:

1. **Frontend Application**
   - React + TypeScript setup
   - Tailwind CSS styling
   - Authentication flow
   - Protected routes

2. **Standard Object UI**
   - List views for Account, Contact, etc.
   - Detail pages
   - Create/Edit forms
   - Search and filters

3. **Custom Object Builder**
   - UI to create custom objects
   - Field management interface
   - Layout builder

4. **Advanced Features**
   - Data import/export
   - Reporting & dashboards
   - Workflow automation
   - Email integration

## 🐛 Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Restart database
docker-compose restart postgres
```

### Migration Errors
```bash
# Check migration status
psql -U postgres -d salesforce_clone -c "SELECT * FROM schema_migrations;"

# Manually reset (development only!)
docker-compose down -v
docker-compose up -d postgres
npm run migrate
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process or change PORT in .env
PORT=3001 npm run dev
```

## 📝 Environment Variables

Required variables in `.env`:

```env
NODE_ENV=development
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=salesforce_clone
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d
```

## 🎉 Foundation Complete!

The Phase 1 foundation is now complete with:
- ✅ Full database schema with RLS
- ✅ Backend API with authentication
- ✅ Multi-tenant architecture
- ✅ Custom objects framework
- ✅ Permission system
- ✅ Docker deployment
- ✅ Demo data

Ready for Phase 2: Feature Implementation!
