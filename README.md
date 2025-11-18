# Salesforce Clone - Enterprise CRM System

A comprehensive, production-ready multi-tenant CRM platform built with modern web technologies, featuring all core Salesforce modules plus advanced enterprise features.

## Features

### Core CRM Modules
- **Sales Cloud**: Complete opportunity management, lead tracking, and pipeline forecasting
- **Service Cloud**: Case management, knowledge base, and SLA tracking
- **Marketing Cloud**: Email campaigns, analytics, and marketing automation
- **Commerce Cloud**: Product catalog, pricing, quoting, and order management

### Enterprise Features
- **Multi-Tenancy**: Complete tenant isolation with PostgreSQL Row-Level Security
- **Reports & Dashboards**: Custom reports with 6 chart types and interactive dashboards
- **Inventory Management**: Multi-warehouse tracking with batch/lot management
- **Automation Engine**: Workflows, process automation, and approval processes
- **Custom Objects**: Flexible JSONB-based data model for custom entities
- **SOQL Query Engine**: Salesforce-compatible query language
- **API Platform**: RESTful APIs with JWT authentication
- **Field-Level Security**: Granular permission control
- **Audit Trails**: Complete change tracking and history

### Technical Stack
- **Backend**: Node.js + TypeScript + Express
- **Frontend**: React + TypeScript + Tailwind CSS
- **Database**: PostgreSQL 14+ with JSONB and RLS
- **Containerization**: Docker + Docker Compose
- **Production**: Nginx reverse proxy with health checks

## Quick Start (Docker)

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum

### 1. Clone and Configure

```bash
git clone <repository-url>
cd salesforce-clone
cp .env.example .env
```

### 2. Update Environment Variables

Edit `.env` and set:
- `DB_PASSWORD`: Strong database password
- `JWT_SECRET`: Random secret key (generate with `openssl rand -hex 32`)
- `SMTP_*`: Email server credentials
- Other settings as needed

### 3. Start Services

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Run Migrations and Seeds

```bash
# Run migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Seed demo data (optional)
docker-compose -f docker-compose.prod.yml exec backend npm run seed:all
```

### 5. Access the Application

- **Frontend**: http://localhost
- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

### Default Credentials (After Seeding)

- **Email**: admin@birdseed.test
- **Password**: admin123

## Manual Setup (Development)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env

# Edit .env with your database credentials

# Run migrations
npm run migrate

# Seed demo data
npm run seed:all

# Start development server
npm run dev
```

The backend will start on http://localhost:3000

### Frontend Setup

```bash
cd frontend
npm install

# Start development server
npm run dev
```

The frontend will start on http://localhost:5173

## Project Structure

```
salesforce-clone/
├── backend/
│   ├── src/
│   │   ├── config/          # Database and app configuration
│   │   ├── middleware/      # Authentication, validation
│   │   ├── routes/          # API endpoints (30+ route files)
│   │   ├── services/        # Business logic
│   │   ├── database/        # Seed data scripts
│   │   └── index.ts         # Express app entry point
│   ├── migrations/          # Database migrations (18 files)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API clients
│   │   └── App.tsx
│   └── package.json
├── docker/                  # Production Dockerfiles and configs
├── scripts/                 # Utility scripts (backup, etc.)
├── docker-compose.prod.yml  # Production Docker Compose
└── .env.example            # Environment template
```

## Database Architecture

### Multi-Tenant Design
- Every table includes `tenant_id` foreign key
- Row-Level Security (RLS) policies enforce tenant isolation
- Session variable `app.current_tenant_id` set per request

### Custom Objects (JSONB)
- Flexible schema for custom entities
- Field metadata stored in `custom_fields` table
- Data stored in `object_data` table with JSONB column
- Supports custom validation rules and picklists

### Migrations
18 migration files covering:
1. Base schema (tenants, users, roles)
2. Custom objects and fields
3. Accounts, contacts, leads
4. Opportunities and products
5. Cases and knowledge base
6. Workflows and automation
7. Service Cloud
8. Commerce Cloud
9. SOQL saved queries
10. Reports and dashboards
11. Inventory management
12. Marketing campaigns

## API Documentation

### Authentication
All API requests require JWT token in Authorization header:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/accounts
```

### Main Endpoints

**Authentication**
- `POST /api/auth/register` - Register tenant and admin user
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/logout` - Logout

**CRM Objects**
- `GET|POST /api/accounts` - Accounts
- `GET|POST /api/contacts` - Contacts
- `GET|POST /api/leads` - Leads
- `GET|POST /api/opportunities` - Opportunities
- `GET|POST /api/cases` - Cases
- `GET|POST /api/products` - Products

**Custom Objects**
- `POST /api/custom-objects` - Create custom object type
- `GET|POST /api/object-data/:objectType` - Custom object records
- `POST /api/custom-fields` - Add custom field

**Reports & Analytics**
- `GET|POST /api/reports` - Report management
- `POST /api/reports/:id/execute` - Run report
- `GET|POST /api/dashboards` - Dashboard management

**Marketing**
- `GET|POST /api/campaigns` - Campaign management
- `GET|POST /api/email-campaigns` - Email campaigns
- `POST /api/email-campaigns/:id/send` - Send email campaign

**Inventory**
- `GET|POST /api/warehouses` - Warehouse management
- `GET|POST /api/inventory` - Inventory items
- `POST /api/inventory/:id/movements` - Stock movements

**Automation**
- `GET|POST /api/workflows` - Workflow rules
- `GET|POST /api/approval-processes` - Approval processes
- `GET /api/automation/execute/:id` - Execute workflow

**SOQL Query**
- `POST /api/query/execute` - Execute SOQL query

### Response Format

Success (200):
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

Error (4xx/5xx):
```json
{
  "error": "Error message",
  "details": {}
}
```

## Environment Variables

See `.env.example` for complete list. Key variables:

### Required
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - Database connection
- `JWT_SECRET` - JWT signing key (use strong random value)
- `NODE_ENV` - Environment (development|production)
- `PORT` - Backend server port (default: 3000)

### Optional
- `SMTP_*` - Email server configuration
- `STORAGE_TYPE` - File storage (local|s3)
- `REDIS_*` - Redis cache configuration
- `SENTRY_DSN` - Error monitoring
- `BACKUP_*` - Backup configuration

## Development

### Running Migrations

```bash
# Run all pending migrations
npm run migrate

# Create new migration
# Add file to backend/migrations/ following naming convention
```

### Seeding Data

```bash
# Seed all modules
npm run seed:all

# Seed specific modules
npm run seed:base           # Base data (tenant, users)
npm run seed:crm            # CRM data (accounts, contacts)
npm run seed:service        # Service Cloud data
npm run seed:commerce       # Commerce data
npm run seed:automation     # Workflows and processes
npm run seed:reports        # Reports and dashboards
npm run seed:inventory      # Inventory data
npm run seed:marketing      # Marketing campaigns
```

### Building for Production

```bash
# Backend
cd backend
npm run build

# Frontend
cd frontend
npm run build
```

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete production deployment checklist including:
- Security hardening
- SSL/HTTPS setup
- Database optimization
- Monitoring and logging
- Backup automation
- Performance tuning

## Backup and Restore

### Automated Backups

Backups run automatically via cron in production:

```bash
# View backup logs
docker-compose -f docker-compose.prod.yml logs backup

# Manual backup
docker-compose -f docker-compose.prod.yml exec backup /app/scripts/backup.sh
```

Backups are stored in `/backups` (or `BACKUP_DIR`) with 7-day retention.

### Restore from Backup

```bash
# List backups
ls -lh /backups/

# Restore specific backup
pg_restore -h postgres -p 5432 -U crm_user -d crm_db -c /backups/backup_crm_db_YYYYMMDD_HHMMSS.dump
```

## Module Toggle

Modules can be selectively enabled/disabled by:

1. **Database**: Skip migration files for unwanted modules
2. **Backend**: Comment out route registrations in `src/index.ts`
3. **Frontend**: Remove corresponding components and routes

Example - Disable Marketing Cloud:
- Skip migration `018_create_marketing_cloud.sql`
- Comment out in `src/index.ts`: `app.use('/api/campaigns', campaignRoutes);`
- Remove marketing components from frontend

## Performance Optimization

### Database Indexing
All foreign keys and frequently queried columns are indexed. Key indexes:
- `tenant_id` on all tables
- `object_type` on object_data
- Email addresses for lookups
- Date fields for filtering

### Caching (Optional)
Redis can be enabled for:
- Session storage
- Report result caching
- SOQL query caching

Set `REDIS_HOST` and `REDIS_PORT` in `.env` to enable.

### Query Optimization
- RLS policies use indexed `tenant_id`
- JSONB columns have GIN indexes
- Prepared statements prevent SQL injection
- Connection pooling configured

## Security Features

- JWT-based authentication with expiration
- Password hashing with bcrypt
- SQL injection prevention (parameterized queries)
- CSRF protection
- XSS prevention (input sanitization)
- CORS configuration
- Rate limiting (optional)
- Row-Level Security for tenant isolation
- Audit logging for all changes

## Monitoring

### Health Checks

```bash
# Backend health
curl http://localhost:3000/health

# Response: {"status":"ok","timestamp":"..."}
```

### Logging

Logs are output to stdout/stderr and can be viewed:

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
```

### Optional: Sentry Integration

Set `SENTRY_DSN` in `.env` to enable error tracking and performance monitoring.

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.prod.yml ps postgres

# View PostgreSQL logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U crm_user -d crm_db -c "SELECT 1;"
```

### Migration Failures

```bash
# Check current migration status
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Roll back last migration (if supported)
# Manually fix data and re-run
```

### Authentication Issues

- Verify `JWT_SECRET` is set and consistent across restarts
- Check token expiration (`JWT_EXPIRES_IN`)
- Ensure system clocks are synchronized

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
npm run seed:all

# Run tests
npm test
```

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Support

For issues, questions, or contributions, please open an issue on GitHub.

## Acknowledgments

Built with inspiration from Salesforce.com's enterprise CRM platform, reimagined as an open-source, self-hosted solution for businesses of all sizes.

## Completed Phases

### Phase 1-10: Core CRM Foundation
- Multi-tenant architecture with PostgreSQL RLS
- Custom objects and fields (JSONB-based)
- Accounts, Contacts, Leads, Opportunities
- Cases and Service Cloud
- Products, Quotes, Orders (Commerce Cloud)
- Workflows and automation engine
- SOQL query engine with saved queries
- Approval processes

### Phase 11: Reports & Dashboards
- Custom report builder (tabular, summary, matrix)
- 6 chart types (bar, line, pie, donut, funnel, gauge)
- Interactive dashboards with components
- Report scheduling and subscriptions
- Report snapshots

### Phase 12: Inventory Management
- Multi-warehouse tracking
- Stock movements (Purchase, Sale, Transfer, Adjustment)
- Batch and lot tracking with expiry dates
- Low stock alerts
- Inventory valuation

### Phase 13: Marketing Cloud Lite
- Campaign management with ROI tracking
- Campaign members (Leads and Contacts)
- Email campaigns with templates
- Email analytics (opens, clicks, bounces)
- Unsubscribe management
- Email tracking links

### Phase 14: Production Deployment Package
- Docker Compose with production services
- Multi-stage production Dockerfiles
- Nginx reverse proxy with SSL/TLS ready
- Automated PostgreSQL backups
- Comprehensive deployment checklist
- Security hardening guide
- Performance optimization
- Monitoring and disaster recovery

### Phase 15: Sandboxes
- Developer, Developer Pro, Partial, and Full sandbox types
- Metadata and data copying
- Sandbox refresh functionality
- Separate tenant isolation per sandbox
- Template-based data sampling

### Phase 16: Change Sets
- Outbound change set creation
- Component management (objects, fields, workflows)
- Inbound change set validation
- Deployment pipeline with status tracking
- Component dependency resolution
- Deployment history and rollback support

### Phases 17-55: Enterprise Features (Database Ready)
All database migrations complete for:
- **Web Forms**: Web-to-Lead/Case with embed codes
- **Territory Management**: Hierarchical territories with assignments
- **Einstein Lead Scoring**: AI-powered lead prioritization
- **CPQ**: Configure-Price-Quote with product rules
- **Communities**: Customer portals and partner communities
- **Mobile Configuration**: Offline sync and push notifications
- **Global Search**: Full-text search across all objects
- **Recently Viewed**: Track and display recent records
- **Knowledge Base Enhanced**: Articles with voting and attachments
- **Files & Versioning**: File storage with version control
- **List Views**: Custom filtered views per object
- **Calendar & Events**: Meeting scheduler with invites
- **Notes & Tags**: Record annotations and categorization
- **Forecasting**: Sales quota and pipeline forecasting
- **Translation Workbench**: Multi-language support
- **Big Objects**: Archive for historical data
- **Lightning Pages**: Visual page builder
- **Topics & Recommendations**: AI content suggestions
- **Path**: Visual guidance for record stages
- **Live Agent**: Real-time chat support
- **Omni-Channel**: Intelligent work routing
- **Macros**: Automated action sequences

## System Capabilities

This CRM now includes **database support for 55+ enterprise modules** covering:
- Complete multi-tenant CRM foundation
- Sales, Service, Marketing, and Commerce clouds
- Advanced automation and workflow engine
- Comprehensive reporting and analytics
- Inventory and warehouse management
- Development lifecycle (sandboxes, change sets)
- AI-powered features (lead scoring, recommendations)
- Customer self-service portals
- Mobile and offline capabilities
- Enterprise security and compliance

## Next Steps

Ready for implementation:
- API route development for Phases 17-55
- Frontend UI components for all modules
- Advanced AI/ML integrations
- Third-party integrations (Slack, Zoom, etc.)
- Enhanced testing and quality assurance
