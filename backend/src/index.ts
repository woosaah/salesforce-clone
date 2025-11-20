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
import savedQueryRoutes from './routes/saved-queries';
import reportRoutes from './routes/reports';
import reportFolderRoutes from './routes/report-folders';
import dashboardRoutes from './routes/dashboards';
import reportSubscriptionRoutes from './routes/report-subscriptions';
import warehouseRoutes from './routes/warehouses';
import inventoryRoutes from './routes/inventory';
import campaignRoutes from './routes/campaigns';
import emailCampaignRoutes from './routes/email-campaigns';
import sandboxRoutes from './routes/sandboxes';
import changeSetRoutes from './routes/change-sets';
import webFormRoutes from './routes/web-forms';
import territoryRoutes from './routes/territories';
import leadScoringRoutes from './routes/lead-scoring';
import cpqRoutes from './routes/cpq';
import communityRoutes from './routes/communities';
import mobileConfigRoutes from './routes/mobile-config';
import searchRoutes from './routes/search';
import fileRoutes from './routes/files';
import listViewRoutes from './routes/list-views';
import calendarRoutes from './routes/calendar';
import chatRoutes from './routes/chat';
import omniChannelRoutes from './routes/omni-channel';
import noteRoutes from './routes/notes';
import tagRoutes from './routes/tags';
import forecastingRoutes from './routes/forecasting';
import translationRoutes from './routes/translations';
import bigObjectRoutes from './routes/big-objects';
import lightningPageRoutes from './routes/lightning-pages';
import topicRoutes from './routes/topics';
import pathRoutes from './routes/paths';
import macroRoutes from './routes/macros';
import recentlyViewedRoutes from './routes/recently-viewed';
import einsteinActivityRoutes from './routes/einstein-activity';
import emailToCaseRoutes from './routes/email-to-case';
import socialCustomerServiceRoutes from './routes/social-customer-service';
import fieldServiceRoutes from './routes/field-service';
import knowledgeVersionRoutes from './routes/knowledge-versions';
import einsteinPredictionRoutes from './routes/einstein-predictions';
import streamingRoutes from './routes/streaming';
import serviceConsoleRoutes from './routes/service-console';
import platformEventsRoutes from './routes/platform-events';
import customMetadataRoutes from './routes/custom-metadata';
import flowBuilderRoutes from './routes/flow-builder';
import externalServicesRoutes from './routes/external-services';
import voiceSmsRoutes from './routes/voice-sms';
import einsteinBotsRoutes from './routes/einstein-bots';
import changeDataCaptureRoutes from './routes/change-data-capture';
import adminRoutes from './routes/admin';
import userRoutes from './routes/users';
import roleRoutes from './routes/roles';
import permissionSetRoutes from './routes/permission-sets';

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
app.use('/api/saved-queries', savedQueryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/report-folders', reportFolderRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/report-subscriptions', reportSubscriptionRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/email-campaigns', emailCampaignRoutes);
app.use('/api/sandboxes', sandboxRoutes);
app.use('/api/change-sets', changeSetRoutes);
app.use('/api/web-forms', webFormRoutes);
app.use('/api/territories', territoryRoutes);
app.use('/api/lead-scoring', leadScoringRoutes);
app.use('/api/cpq', cpqRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/mobile-config', mobileConfigRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/list-views', listViewRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/omni-channel', omniChannelRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/forecasting', forecastingRoutes);
app.use('/api/translations', translationRoutes);
app.use('/api/big-objects', bigObjectRoutes);
app.use('/api/lightning-pages', lightningPageRoutes);
app.use('/api/topics', topicRoutes);
app.use('/api/paths', pathRoutes);
app.use('/api/macros', macroRoutes);
app.use('/api/recently-viewed', recentlyViewedRoutes);
app.use('/api/einstein-activity', einsteinActivityRoutes);
app.use('/api/email-to-case', emailToCaseRoutes);
app.use('/api/social', socialCustomerServiceRoutes);
app.use('/api/field-service', fieldServiceRoutes);
app.use('/api/knowledge-versions', knowledgeVersionRoutes);
app.use('/api/einstein-predictions', einsteinPredictionRoutes);
app.use('/api/streaming', streamingRoutes);
app.use('/api/service-console', serviceConsoleRoutes);
app.use('/api/platform-events', platformEventsRoutes);
app.use('/api/custom-metadata', customMetadataRoutes);
app.use('/api/flows', flowBuilderRoutes);
app.use('/api/external-services', externalServicesRoutes);
app.use('/api/voice-sms', voiceSmsRoutes);
app.use('/api/bots', einsteinBotsRoutes);
app.use('/api/change-data-capture', changeDataCaptureRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permission-sets', permissionSetRoutes);

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
