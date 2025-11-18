# Production Deployment Checklist

This guide provides a comprehensive checklist for deploying the Salesforce Clone CRM to production.

## Pre-Deployment Checklist

### 1. Security Hardening

#### Environment Variables
- [ ] Generate strong `JWT_SECRET` (min 32 characters): `openssl rand -hex 32`
- [ ] Set strong `DB_PASSWORD` (min 16 characters with special chars)
- [ ] Verify `NODE_ENV=production`
- [ ] Configure `CORS_ORIGIN` with your actual domain(s)
- [ ] Set `FRONTEND_URL` and `API_URL` to production URLs
- [ ] Remove or secure all debug/development credentials

#### Database Security
- [ ] Create dedicated database user with minimal permissions
- [ ] Enable PostgreSQL SSL/TLS connections
- [ ] Configure PostgreSQL to accept connections only from application servers
- [ ] Set up regular database backups
- [ ] Enable PostgreSQL audit logging
- [ ] Review and test Row-Level Security policies

#### Application Security
- [ ] Enable HTTPS/SSL for all connections
- [ ] Configure rate limiting (set `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`)
- [ ] Review and restrict CORS origins
- [ ] Enable helmet.js security headers
- [ ] Disable stack traces in error responses
- [ ] Configure Content Security Policy (CSP)
- [ ] Enable CSRF protection for form submissions

### 2. Performance Optimization

#### Database Optimization
- [ ] Run `VACUUM ANALYZE` on PostgreSQL
- [ ] Verify all indexes are created (check migration files)
- [ ] Configure PostgreSQL connection pooling (default: 20 connections)
- [ ] Set appropriate `shared_buffers` (25% of RAM)
- [ ] Configure `work_mem` based on query complexity
- [ ] Enable query logging for slow queries (>1 second)
- [ ] Review and optimize JSONB queries

#### Application Performance
- [ ] Enable Redis caching (set `REDIS_HOST` and `REDIS_PORT`)
- [ ] Configure CDN for static assets
- [ ] Enable gzip compression in Nginx
- [ ] Set appropriate cache headers
- [ ] Configure worker processes (Nginx: `worker_processes auto`)
- [ ] Review and optimize N+1 queries

#### Frontend Optimization
- [ ] Build production bundle: `npm run build`
- [ ] Verify bundle size is optimized (use `webpack-bundle-analyzer`)
- [ ] Enable lazy loading for routes
- [ ] Optimize images (WebP format, compression)
- [ ] Configure browser caching for static assets

### 3. Monitoring & Logging

#### Application Monitoring
- [ ] Configure Sentry for error tracking (set `SENTRY_DSN`)
- [ ] Set up application performance monitoring (APM)
- [ ] Configure health check endpoint monitoring
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Configure log aggregation (ELK stack, Datadog, etc.)

#### Database Monitoring
- [ ] Enable PostgreSQL slow query logging
- [ ] Monitor database connections and pool usage
- [ ] Set up alerts for high CPU/memory usage
- [ ] Monitor disk space usage
- [ ] Configure automated performance reports

#### Infrastructure Monitoring
- [ ] Monitor Docker container health
- [ ] Set up CPU and memory alerts
- [ ] Monitor disk I/O
- [ ] Configure network monitoring
- [ ] Set up log rotation

### 4. Backup Strategy

#### Database Backups
- [ ] Configure automated daily backups (already included in docker-compose.prod.yml)
- [ ] Set backup retention policy (default: 7 days)
- [ ] Test backup restoration process
- [ ] Store backups in separate location/region
- [ ] Encrypt backup files
- [ ] Document backup restoration procedure

#### Application Backups
- [ ] Back up environment configuration files
- [ ] Back up uploaded files/attachments
- [ ] Version control all application code
- [ ] Document deployment configuration

### 5. SSL/HTTPS Configuration

#### SSL Certificate Setup
- [ ] Obtain SSL certificate (Let's Encrypt, commercial CA)
- [ ] Configure Nginx with SSL certificate
- [ ] Enable HTTP to HTTPS redirect
- [ ] Configure HSTS (HTTP Strict Transport Security)
- [ ] Test SSL configuration (SSL Labs)
- [ ] Set up certificate auto-renewal

#### Nginx SSL Configuration
Update `docker/default.conf` with:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # ... rest of configuration
}
```

### 6. Email Configuration

#### SMTP Setup
- [ ] Configure SMTP credentials (Gmail, SendGrid, AWS SES, etc.)
- [ ] Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
- [ ] Configure `SMTP_SECURE=true` for TLS
- [ ] Test email sending functionality
- [ ] Configure SPF and DKIM records for domain
- [ ] Set up email bounce handling
- [ ] Configure email rate limiting

#### Email Templates
- [ ] Review all email templates for production URLs
- [ ] Test email rendering across clients
- [ ] Configure from address and reply-to
- [ ] Set up unsubscribe links

## Deployment Steps

### 1. Server Preparation

#### System Requirements
- [ ] Ubuntu 20.04+ or similar Linux distribution
- [ ] Docker 20.10+
- [ ] Docker Compose 2.0+
- [ ] Minimum 4GB RAM, 2 CPU cores
- [ ] 50GB+ disk space
- [ ] Open ports: 80 (HTTP), 443 (HTTPS)

#### Initial Setup
```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create application user
sudo useradd -m -s /bin/bash crm
sudo usermod -aG docker crm
```

### 2. Application Deployment

#### Clone Repository
```bash
# Switch to application user
sudo su - crm

# Clone repository
git clone <repository-url> /home/crm/salesforce-clone
cd /home/crm/salesforce-clone
```

#### Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env

# Set production values:
# - NODE_ENV=production
# - DB_PASSWORD=<strong-password>
# - JWT_SECRET=<strong-secret>
# - SMTP credentials
# - Domain URLs
```

#### Build and Start Services
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

#### Run Database Migrations
```bash
# Execute migrations
docker-compose -f docker-compose.prod.yml exec backend npm run migrate

# Verify migrations completed
docker-compose -f docker-compose.prod.yml exec backend npm run migrate -- --status
```

#### Create Admin User
```bash
# Option 1: Use seed script (creates demo data)
docker-compose -f docker-compose.prod.yml exec backend npm run seed:base

# Option 2: Register via API
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "My Company",
    "subdomain": "mycompany",
    "email": "admin@mycompany.com",
    "password": "SecurePassword123!",
    "first_name": "Admin",
    "last_name": "User"
  }'
```

### 3. SSL Certificate Setup (Let's Encrypt)

```bash
# Install Certbot
sudo apt-get install certbot

# Stop Nginx temporarily
docker-compose -f docker-compose.prod.yml stop frontend

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates to project directory
sudo mkdir -p /home/crm/salesforce-clone/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /home/crm/salesforce-clone/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /home/crm/salesforce-clone/ssl/
sudo chown -R crm:crm /home/crm/salesforce-clone/ssl

# Update docker-compose.prod.yml to mount SSL certificates
# Add to frontend service volumes:
# - ./ssl:/etc/nginx/ssl:ro

# Restart services
docker-compose -f docker-compose.prod.yml up -d

# Set up auto-renewal
sudo crontab -e
# Add: 0 0 1 * * certbot renew --quiet && docker-compose -f /home/crm/salesforce-clone/docker-compose.prod.yml restart frontend
```

### 4. DNS Configuration

- [ ] Create A record: `yourdomain.com` → Server IP
- [ ] Create A record: `www.yourdomain.com` → Server IP
- [ ] Create CNAME record: `api.yourdomain.com` → `yourdomain.com` (optional)
- [ ] Verify DNS propagation: `dig yourdomain.com`

### 5. Firewall Configuration

```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Verify rules
sudo ufw status
```

## Post-Deployment Verification

### 1. Functional Testing

- [ ] Test user registration: `/api/auth/register`
- [ ] Test user login: `/api/auth/login`
- [ ] Test authenticated endpoints (create account, contact, etc.)
- [ ] Verify email sending (welcome email, password reset)
- [ ] Test file uploads
- [ ] Create and run reports
- [ ] Test workflows and automation
- [ ] Verify SOQL queries work
- [ ] Test all major user flows

### 2. Performance Testing

- [ ] Run load tests (Apache Bench, k6, etc.)
- [ ] Verify response times under load (<500ms for 95th percentile)
- [ ] Check database query performance
- [ ] Monitor memory and CPU usage
- [ ] Test concurrent user sessions

### 3. Security Testing

- [ ] Run security scan (OWASP ZAP, Burp Suite)
- [ ] Verify HTTPS is enforced
- [ ] Test SQL injection protection
- [ ] Test XSS protection
- [ ] Verify CSRF tokens
- [ ] Test authentication and authorization
- [ ] Verify tenant isolation (create multiple tenants)
- [ ] Test rate limiting

### 4. Backup Testing

- [ ] Verify automated backups are running
- [ ] Test backup restoration process
- [ ] Verify backup file integrity
- [ ] Test point-in-time recovery

## Monitoring Setup

### Health Checks

```bash
# Application health
curl https://yourdomain.com/health

# Expected response:
# {"status":"ok","timestamp":"2025-01-15T12:00:00.000Z"}

# Database connectivity
docker-compose -f docker-compose.prod.yml exec backend npm run db:check
```

### Log Monitoring

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f backend

# View database logs
docker-compose -f docker-compose.prod.yml logs -f postgres

# View Nginx logs
docker-compose -f docker-compose.prod.yml logs -f frontend

# View backup logs
docker-compose -f docker-compose.prod.yml logs -f backup
```

### Alerts Configuration

Set up alerts for:
- [ ] Application errors (500 errors)
- [ ] High response times (>2 seconds)
- [ ] Database connection failures
- [ ] High CPU usage (>80%)
- [ ] High memory usage (>80%)
- [ ] Disk space low (<10% free)
- [ ] Backup failures
- [ ] SSL certificate expiration (<30 days)

## Maintenance Procedures

### Regular Maintenance

#### Daily
- [ ] Review error logs
- [ ] Check backup completion
- [ ] Monitor system resources

#### Weekly
- [ ] Review slow query logs
- [ ] Check disk space usage
- [ ] Review security alerts
- [ ] Update application dependencies (if needed)

#### Monthly
- [ ] Database VACUUM and ANALYZE
- [ ] Review and archive old logs
- [ ] Security updates (OS and dependencies)
- [ ] Backup restoration test
- [ ] Review and optimize database indexes

### Updating Application

```bash
# Pull latest code
cd /home/crm/salesforce-clone
git pull origin main

# Rebuild images
docker-compose -f docker-compose.prod.yml build

# Stop services
docker-compose -f docker-compose.prod.yml down

# Run migrations (if any)
docker-compose -f docker-compose.prod.yml up -d postgres
docker-compose -f docker-compose.prod.yml run --rm backend npm run migrate

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Verify deployment
curl https://yourdomain.com/health
```

### Database Maintenance

```bash
# Run VACUUM ANALYZE
docker-compose -f docker-compose.prod.yml exec postgres psql -U crm_user -d crm_db -c "VACUUM ANALYZE;"

# Reindex database
docker-compose -f docker-compose.prod.yml exec postgres psql -U crm_user -d crm_db -c "REINDEX DATABASE crm_db;"

# Check database size
docker-compose -f docker-compose.prod.yml exec postgres psql -U crm_user -d crm_db -c "SELECT pg_size_pretty(pg_database_size('crm_db'));"
```

## Disaster Recovery

### Backup Restoration

```bash
# Stop application
docker-compose -f docker-compose.prod.yml stop backend

# List available backups
ls -lh /backups/

# Restore from backup
docker-compose -f docker-compose.prod.yml exec postgres pg_restore \
  -U crm_user \
  -d crm_db \
  --clean \
  --if-exists \
  /backups/backup_crm_db_YYYYMMDD_HHMMSS.dump

# Restart application
docker-compose -f docker-compose.prod.yml start backend
```

### Emergency Procedures

#### Application Crash
1. Check logs: `docker-compose -f docker-compose.prod.yml logs backend`
2. Restart service: `docker-compose -f docker-compose.prod.yml restart backend`
3. If persistent, roll back to previous version

#### Database Failure
1. Check database logs: `docker-compose -f docker-compose.prod.yml logs postgres`
2. Attempt restart: `docker-compose -f docker-compose.prod.yml restart postgres`
3. If corrupted, restore from latest backup

#### Disk Space Full
1. Clear old logs: `docker-compose -f docker-compose.prod.yml exec postgres rm -rf /var/log/postgresql/*.log`
2. Remove old backups: `find /backups -name "backup_*.dump" -mtime +7 -delete`
3. Clean Docker: `docker system prune -a`

## Scaling Considerations

### Horizontal Scaling

For high-traffic deployments:

1. **Load Balancer**: Add Nginx/HAProxy in front of multiple backend instances
2. **Database Replication**: Set up PostgreSQL primary-replica replication
3. **Session Store**: Use Redis for session management across instances
4. **File Storage**: Migrate to S3 or similar object storage
5. **Caching Layer**: Implement Redis for query result caching

### Vertical Scaling

- Increase server resources (CPU, RAM, Disk)
- Optimize PostgreSQL configuration for larger hardware
- Adjust Docker resource limits

## Security Best Practices

### Regular Security Tasks

- [ ] Keep system packages updated
- [ ] Update Node.js dependencies monthly
- [ ] Review and rotate secrets/passwords quarterly
- [ ] Audit user access and permissions
- [ ] Review security logs for anomalies
- [ ] Perform security scans monthly
- [ ] Update SSL certificates before expiration

### Access Control

- [ ] Limit SSH access to specific IPs
- [ ] Use SSH keys instead of passwords
- [ ] Implement fail2ban for brute force protection
- [ ] Regular audit of user accounts
- [ ] Principle of least privilege for all accounts

## Compliance Considerations

### GDPR Compliance

- [ ] Implement data export functionality
- [ ] Implement data deletion (right to be forgotten)
- [ ] Add privacy policy and terms of service
- [ ] Implement consent management
- [ ] Enable audit logging
- [ ] Set up data retention policies

### SOC 2 Compliance

- [ ] Document security policies
- [ ] Implement access controls
- [ ] Enable comprehensive audit logging
- [ ] Set up incident response procedures
- [ ] Regular security assessments
- [ ] Vendor risk management

## Troubleshooting Common Issues

### Application Won't Start

1. Check environment variables: `cat .env`
2. Check Docker logs: `docker-compose -f docker-compose.prod.yml logs`
3. Verify database is running: `docker-compose -f docker-compose.prod.yml ps postgres`
4. Check port conflicts: `sudo netstat -tulpn | grep :3000`

### Database Connection Errors

1. Verify database credentials in `.env`
2. Check PostgreSQL is running: `docker-compose -f docker-compose.prod.yml ps postgres`
3. Test database connection: `docker-compose -f docker-compose.prod.yml exec postgres psql -U crm_user -d crm_db -c "SELECT 1;"`
4. Check network connectivity between containers

### High Memory Usage

1. Check running containers: `docker stats`
2. Review PostgreSQL settings (shared_buffers, work_mem)
3. Restart services to clear memory leaks
4. Consider increasing server resources

### Slow Query Performance

1. Enable slow query logging in PostgreSQL
2. Review and optimize queries
3. Check database indexes
4. Run VACUUM ANALYZE
5. Consider adding database caching layer

## Support and Documentation

### Resources

- Application Documentation: README.md
- API Documentation: /api/docs (if configured)
- Database Schema: migrations/
- Issue Tracker: GitHub Issues

### Getting Help

For production issues:
1. Check logs first
2. Review this deployment guide
3. Check troubleshooting section
4. Open GitHub issue with logs and error messages
5. Contact support team (if available)

## Deployment Complete! 🎉

Once all checklist items are complete:

- [ ] Document deployment date and version
- [ ] Update runbook with any custom configurations
- [ ] Train operations team on monitoring and maintenance
- [ ] Schedule first backup restoration test
- [ ] Plan first security audit
- [ ] Celebrate! You've deployed a production CRM system! 🚀
