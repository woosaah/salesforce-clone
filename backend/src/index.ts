import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import tenantRoutes from './routes/tenants';
import objectRoutes from './routes/objects';
import queryRoutes from './routes/query';
import invoiceRoutes from './routes/invoices';
import assetRoutes from './routes/assets';
import purchaseOrderRoutes from './routes/purchase-orders';
import expenseRoutes from './routes/expenses';
import leadRoutes from './routes/leads';
import opportunityRoutes from './routes/opportunities';
import productRoutes from './routes/products';
import caseRoutes from './routes/cases';
import knowledgeRoutes from './routes/knowledge';
import slaRoutes from './routes/slas';
import queueRoutes from './routes/queues';
import serviceContractRoutes from './routes/service-contracts';
import escalationRuleRoutes from './routes/escalation-rules';
import solutionRoutes from './routes/solutions';
import priceBookRoutes from './routes/price-books';
import opportunityStageRoutes from './routes/opportunity-stages';
import workflowRoutes from './routes/workflows';
import triggerRoutes from './routes/triggers';
import approvalProcessRoutes from './routes/approval-processes';
import emailTemplateRoutes from './routes/email-templates';

// Load environment variables
dotenv.config();

// Create Express app
const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(morgan('dev')); // Request logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/objects', objectRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/slas', slaRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/service-contracts', serviceContractRoutes);
app.use('/api/escalation-rules', escalationRuleRoutes);
app.use('/api/solutions', solutionRoutes);
app.use('/api/price-books', priceBookRoutes);
app.use('/api/opportunity-stages', opportunityStageRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/triggers', triggerRoutes);
app.use('/api/approval-processes', approvalProcessRoutes);
app.use('/api/email-templates', emailTemplateRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Test database connection
    console.log('Testing database connection...');
    const dbConnected = await testConnection();

    if (!dbConnected) {
      console.error('Failed to connect to database');
      process.exit(1);
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║   Salesforce Clone API Server         ║
║                                        ║
║   Port: ${PORT}                        ║
║   Environment: ${process.env.NODE_ENV || 'development'}            ║
║   Database: Connected                  ║
║                                        ║
║   Status: Ready ✓                      ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer();

export default app;
