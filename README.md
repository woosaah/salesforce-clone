# Salesforce Clone - Multi-Tenant CRM

A modern, modular CRM system built with multi-tenancy, custom objects, and enterprise-grade features.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Row-Level Security (RLS)
- **Frontend**: React + TypeScript + Tailwind CSS
- **Auth**: JWT tokens with bcrypt password hashing
- **Containerization**: Docker & Docker Compose

## Architecture

### Multi-Tenancy
- Complete data isolation using PostgreSQL Row-Level Security
- Tenant context set per query
- Subdomain-based tenant identification

### Custom Objects & Fields
- Metadata-driven architecture (objects_meta, fields_meta)
- Generic JSONB storage (object_data)
- Support for multiple field types
- Dynamic schema creation

### Security
- JWT-based authentication
- Row-Level Security policies on all tables
- Password hashing with bcrypt
- Tenant isolation at database level

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)

### Setup with Docker

1. **Clone the repository**
```bash
git clone <repository-url>
cd salesforce-clone
```

2. **Start services**
```bash
docker-compose up -d
```

3. **Run database migrations**
```bash
docker-compose exec backend npm run migrate
```

4. **Seed demo data**
```bash
docker-compose exec backend npm run seed
```

5. **Access the application**
- Backend API: http://localhost:3000
- Health check: http://localhost:3000/health

### Local Development Setup

1. **Install backend dependencies**
```bash
cd backend
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. **Start PostgreSQL** (via Docker or local installation)
```bash
docker-compose up -d postgres
```

4. **Run migrations**
```bash
npm run migrate
```

5. **Seed demo data**
```bash
npm run seed
```

6. **Start development server**
```bash
npm run dev
```

## API Endpoints

### Authentication

#### POST /api/auth/register
Register a new tenant and admin user.

```json
{
  "tenant_name": "My Company",
  "subdomain": "mycompany",
  "email": "admin@mycompany.com",
  "password": "SecurePass123",
  "first_name": "John",
  "last_name": "Doe"
}
```

#### POST /api/auth/login
Login with email and password.

```json
{
  "email": "admin@birdseed.test",
  "password": "admin123",
  "subdomain": "birdseed" // optional
}
```

#### GET /api/auth/me
Get current user information (requires authentication).

Headers:
```
Authorization: Bearer <jwt_token>
```

### Tenants (Super Admin Only)

#### GET /api/tenants
List all tenants.

#### POST /api/tenants
Create a new tenant.

```json
{
  "tenant_name": "New Company",
  "subdomain": "newco",
  "subscription_tier": "professional",
  "enabled_modules": ["sales", "service"]
}
```

## Database Schema

### Core Tables

- **tenants**: Multi-tenant organizations
- **tenant_settings**: Tenant-specific configuration
- **users**: User accounts with authentication
- **roles**: Role hierarchy for data access
- **profiles**: Permission profiles
- **object_permissions**: Object-level CRUD permissions
- **field_permissions**: Field-level permissions
- **record_types**: Record type definitions
- **record_type_field_visibility**: Field visibility per record type
- **objects_meta**: Custom object metadata
- **fields_meta**: Custom field metadata
- **object_data**: Generic JSONB storage for all records

## Demo Tenant

The seed script creates a demo tenant:

- **Tenant**: Bird Seed Business
- **Subdomain**: birdseed
- **Admin Email**: admin@birdseed.test
- **Password**: admin123

Standard objects with master record types:
- Account
- Contact
- Asset
- Product

## Development Scripts

```bash
# Development server with auto-reload
npm run dev

# Build TypeScript
npm run build

# Run production server
npm start

# Run migrations
npm run migrate

# Seed demo data
npm run seed

# Run tests
npm test
```

## Project Structure

```
salesforce-clone/
├── backend/
│   ├── src/
│   │   ├── config/         # Database & app configuration
│   │   ├── database/       # Migration runner & seeds
│   │   ├── middleware/     # Auth, tenant context, error handling
│   │   ├── routes/         # API route handlers
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # JWT, password utilities
│   │   └── index.ts        # Express app entry point
│   ├── migrations/         # SQL migration files
│   └── package.json
├── frontend/
│   └── src/
├── docker/
│   └── Dockerfile.backend
├── docker-compose.yml
└── README.md
```

## Success Criteria ✓

- [x] All database tables created with migrations
- [x] Row-Level Security policies enforce tenant isolation
- [x] JWT authentication working
- [x] User registration creates tenant + admin user
- [x] Login returns JWT token
- [x] Protected routes require authentication
- [x] Tenant context middleware sets RLS
- [x] Docker Compose setup for easy deployment
- [x] Seed data for demo tenant

## Next Steps

Phase 2 will include:
- Frontend React application
- Standard objects (Account, Contact, Opportunity, etc.)
- Custom object builder UI
- Permission management UI
- Data import/export
- Reporting & dashboards

## License

MIT
