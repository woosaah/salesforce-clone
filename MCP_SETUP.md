# MCP Server for Salesforce Clone Diagnostics

This document explains how to set up and use the Model Context Protocol (MCP) server for diagnosing and managing your Salesforce Clone CRM system using AI tools.

## What is MCP?

The Model Context Protocol (MCP) allows AI assistants (like Claude) to interact with external tools and data sources. This MCP server exposes diagnostic and management functions for your CRM system, enabling AI to help troubleshoot issues, inspect data, and monitor system health.

## Available Tools

The MCP server provides 12 diagnostic tools:

### 1. **check_database_health**
Check the health and status of the PostgreSQL database
- Returns: Connection count, database size, largest tables, overall status

### 2. **get_tenant_info**
Get information about a specific tenant
- Parameters: `tenant_id` (UUID)
- Returns: Tenant details, user count, custom object count

### 3. **list_all_tenants**
List all tenants in the system with statistics
- Returns: All tenants with user counts and object counts

### 4. **check_table_stats**
Get detailed statistics for a specific table
- Parameters: `table_name` (string)
- Returns: Table size, index size, row count, vacuum stats

### 5. **query_custom_objects**
Query custom objects for a tenant
- Parameters: `tenant_id` (UUID)
- Returns: All custom objects with field and record counts

### 6. **check_rls_policies**
Check Row-Level Security policies on a table
- Parameters: `table_name` (string)
- Returns: RLS status and all policies for the table

### 7. **get_recent_errors**
Get recent error logs (placeholder - implement error logging)
- Parameters: `limit` (number, optional, default: 10)
- Returns: Recent errors from the system

### 8. **check_api_endpoints**
List all available API endpoints and their status
- Returns: List of all 500+ API endpoints

### 9. **run_soql_query**
Execute a SOQL-like query for diagnostics (read-only)
- Parameters: `tenant_id` (UUID), `query` (string)
- Returns: Query results
- Security: Only SELECT queries allowed

### 10. **check_workflow_status**
Check the status of workflows for a tenant
- Parameters: `tenant_id` (UUID)
- Returns: Workflow definitions and execution statistics

### 11. **inspect_user_permissions**
Inspect permissions and roles for a specific user
- Parameters: `user_id` (UUID)
- Returns: User details and permissions

### 12. **check_system_performance**
Get system performance metrics
- Returns: Slow queries, cache hit ratios, resource usage

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

This will install the MCP SDK: `@modelcontextprotocol/sdk`

### 2. Build the Project

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 3. Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=salesforce_clone
DB_USER=postgres
DB_PASSWORD=your_password_here
```

### 4. Test the MCP Server

Run the MCP server directly:

```bash
npm run mcp
```

You should see: "Salesforce Clone MCP Diagnostics Server running on stdio"

## Using with Claude Desktop

### 1. Locate Claude Desktop Config

The Claude Desktop configuration file is located at:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. Add MCP Server Configuration

Edit the config file and add:

```json
{
  "mcpServers": {
    "salesforce-clone-diagnostics": {
      "command": "node",
      "args": [
        "/absolute/path/to/salesforce-clone/backend/dist/mcp/server.js"
      ],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_NAME": "salesforce_clone",
        "DB_USER": "postgres",
        "DB_PASSWORD": "your_password_here"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/salesforce-clone` with the actual path to your project.

### 3. Restart Claude Desktop

Close and reopen Claude Desktop for the changes to take effect.

### 4. Verify Connection

In Claude Desktop, you should now see the MCP server connected. You can ask:

> "Check the database health for my Salesforce Clone CRM"

Claude will use the MCP tools to query your system and provide diagnostics.

## Using with Other MCP Clients

The MCP server works with any MCP-compatible client. Configure it using:

- **Command**: `node`
- **Args**: `["/path/to/backend/dist/mcp/server.js"]`
- **Protocol**: stdio (standard input/output)

## Example Queries for AI

Once connected, you can ask Claude (or any AI with MCP support):

### System Health
> "Check the overall health of my CRM database"

### Tenant Management
> "List all tenants and show their user counts"
> "Get detailed information about tenant ID abc-123"

### Performance Diagnostics
> "Show me the slowest queries in the system"
> "What's the cache hit ratio?"
> "Which tables are taking up the most space?"

### Data Inspection
> "What custom objects exist for tenant abc-123?"
> "Check the RLS policies on the accounts table"

### Workflow Debugging
> "Check the workflow status for tenant abc-123"
> "Inspect permissions for user xyz-456"

## Security Considerations

### Read-Only Access
The MCP server is designed for diagnostics and provides **read-only** access to:
- Database statistics
- Table information
- Tenant data
- System metrics

### Query Safety
- Only SELECT queries are allowed
- All queries respect Row-Level Security (RLS)
- Tenant context is properly set for all operations

### Database Credentials
Store database credentials securely:
- Use environment variables
- Never commit credentials to git
- Restrict MCP server to local access only

### Production Use
For production environments:
1. Create a read-only database user for MCP
2. Grant only SELECT permissions
3. Restrict access to specific tables
4. Use strong authentication
5. Monitor MCP usage

## Troubleshooting

### MCP Server Won't Start

1. **Check build**: Run `npm run build` to compile TypeScript
2. **Check dependencies**: Run `npm install` to ensure MCP SDK is installed
3. **Check database**: Verify database connection with correct credentials

### Claude Desktop Not Connecting

1. **Check path**: Ensure absolute path to server.js is correct
2. **Check Node.js**: Verify Node.js is in your PATH
3. **Check logs**: Look at Claude Desktop logs for error messages
4. **Restart**: Fully quit and restart Claude Desktop

### Tools Not Working

1. **Database connection**: Verify database is running and accessible
2. **Credentials**: Check environment variables are set correctly
3. **Permissions**: Ensure database user has SELECT permissions
4. **Extensions**: Some tools require PostgreSQL extensions (pg_stat_statements)

### Enable pg_stat_statements Extension

For performance monitoring, enable this PostgreSQL extension:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Add to postgresql.conf:
```
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

Restart PostgreSQL after making changes.

## Development

### Adding New Tools

1. Define the tool in the `tools` array with proper schema
2. Add a case handler in the `CallToolRequestSchema` handler
3. Implement the diagnostic logic
4. Test with `npm run mcp`
5. Rebuild with `npm run build`

### Testing

Test individual tools by invoking them through Claude or another MCP client. The server logs errors to stderr.

## Advanced Usage

### Custom Database Queries

Create custom diagnostic queries by adding new tools. Example:

```typescript
{
  name: 'check_lead_conversion_rate',
  description: 'Calculate lead conversion rates for a tenant',
  inputSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string' },
      start_date: { type: 'string' },
      end_date: { type: 'string' },
    },
    required: ['tenant_id'],
  },
}
```

### Integration with Monitoring

The MCP server can be integrated with monitoring systems:
- Export metrics to Prometheus
- Send alerts to Slack/Email
- Log diagnostics to external services

### API Endpoint Health Checks

The MCP server can verify API endpoints are responding:
- Make HTTP requests to each endpoint
- Check response times
- Verify authentication
- Test CRUD operations

## Examples

### Check Database Size

```
User: "How big is my CRM database?"

Claude: *uses check_database_health tool*

The database is currently 2.3 GB in size. The largest tables are:
1. object_data - 850 MB
2. audit_logs - 420 MB
3. attachments - 380 MB
...
```

### Diagnose Slow Queries

```
User: "Why is my CRM slow today?"

Claude: *uses check_system_performance tool*

I found 3 slow queries:
1. Complex JOIN on opportunities table - avg 2.5 seconds
2. Report generation query - avg 3.1 seconds
3. Full-text search on cases - avg 1.8 seconds

The cache hit ratio is 87%, which is below optimal (target: 95%+).
Consider adding indexes to improve performance.
```

### Inspect Tenant Data

```
User: "How many users does tenant XYZ have?"

Claude: *uses get_tenant_info tool*

Tenant "Acme Corp" (ID: xyz-123) has:
- 45 active users
- 12 custom objects
- Created on: 2024-01-15
- Status: Active
```

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Claude Desktop logs
- Verify database connectivity
- Ensure all dependencies are installed

## Next Steps

1. Install and configure the MCP server
2. Test with basic queries through Claude Desktop
3. Explore all 12 diagnostic tools
4. Add custom tools for your specific needs
5. Integrate with monitoring and alerting

---

**Your AI-powered CRM diagnostics are ready!** 🚀
