import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/bots
 * Get all bots
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { is_active } = req.query;

    let query = `SELECT * FROM bots WHERE 1=1`;
    const params: any[] = [];
    let paramIndex = 1;

    if (is_active !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(is_active === 'true');
      paramIndex++;
    }

    query += ` ORDER BY bot_name`;

    const bots = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: bots,
    });
  } catch (error: any) {
    console.error('Error fetching bots:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bots',
      error: error.message,
    });
  }
});

/**
 * GET /api/bots/:id
 * Get a specific bot
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bots = await queryWithTenant(
      `SELECT * FROM bots WHERE bot_id = $1`,
      [id]
    );

    if (bots.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found',
      });
    }

    res.json({
      success: true,
      data: bots[0],
    });
  } catch (error: any) {
    console.error('Error fetching bot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bot',
      error: error.message,
    });
  }
});

/**
 * POST /api/bots
 * Create a bot
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { bot_name, description, greeting_message, language, is_active } = req.body;

    if (!bot_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: bot_name',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO bots (
        bot_name,
        description,
        greeting_message,
        language,
        is_active
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [bot_name, description, greeting_message, language || 'en_US', is_active !== false]
    );

    res.status(201).json({
      success: true,
      message: 'Bot created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating bot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create bot',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/bots/:id
 * Update a bot
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['bot_name', 'description', 'greeting_message', 'language', 'is_active'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (setFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(id);

    const result = await queryWithTenant(
      `UPDATE bots SET ${setFields.join(', ')}
       WHERE bot_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bot not found',
      });
    }

    res.json({
      success: true,
      message: 'Bot updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating bot:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bot',
      error: error.message,
    });
  }
});

/**
 * GET /api/bots/:botId/dialogs
 * Get bot dialogs
 */
router.get('/:botId/dialogs', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;

    const dialogs = await queryWithTenant(
      `SELECT * FROM bot_dialogs WHERE bot_id = $1 ORDER BY dialog_name`,
      [botId]
    );

    res.json({
      success: true,
      data: dialogs,
    });
  } catch (error: any) {
    console.error('Error fetching bot dialogs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bot dialogs',
      error: error.message,
    });
  }
});

/**
 * POST /api/bots/:botId/dialogs
 * Create a dialog for a bot
 */
router.post('/:botId/dialogs', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const { dialog_name, dialog_type, intent_patterns, responses } = req.body;

    if (!dialog_name || !dialog_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: dialog_name, dialog_type',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO bot_dialogs (
        bot_id,
        dialog_name,
        dialog_type,
        intent_patterns,
        responses
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        botId,
        dialog_name,
        dialog_type,
        JSON.stringify(intent_patterns || []),
        JSON.stringify(responses || []),
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Dialog created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating dialog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create dialog',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/bots/:botId/dialogs/:dialogId
 * Update a bot dialog
 */
router.patch('/:botId/dialogs/:dialogId', async (req: Request, res: Response) => {
  try {
    const { dialogId } = req.params;
    const updates = req.body;

    const allowedFields = ['dialog_name', 'intent_patterns', 'responses'];

    const setFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        setFields.push(`${key} = $${paramIndex}`);
        values.push(
          (key === 'intent_patterns' || key === 'responses') && typeof updates[key] === 'object'
            ? JSON.stringify(updates[key])
            : updates[key]
        );
        paramIndex++;
      }
    });

    if (setFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    values.push(dialogId);

    const result = await queryWithTenant(
      `UPDATE bot_dialogs SET ${setFields.join(', ')}
       WHERE dialog_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Dialog not found',
      });
    }

    res.json({
      success: true,
      message: 'Dialog updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating dialog:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update dialog',
      error: error.message,
    });
  }
});

/**
 * POST /api/bots/:botId/conversations
 * Start a conversation with a bot
 */
router.post('/:botId/conversations', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const { visitor_name, visitor_email, channel } = req.body;

    const result = await queryWithTenant(
      `INSERT INTO bot_conversations (
        bot_id,
        visitor_name,
        visitor_email,
        channel,
        status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [botId, visitor_name, visitor_email, channel || 'Web', 'Active']
    );

    // Get bot greeting
    const bots = await queryWithTenant(
      `SELECT greeting_message FROM bots WHERE bot_id = $1`,
      [botId]
    );

    res.status(201).json({
      success: true,
      message: 'Conversation started successfully',
      data: {
        conversation: result[0],
        greeting: bots[0]?.greeting_message || 'Hello! How can I help you today?',
      },
    });
  } catch (error: any) {
    console.error('Error starting conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start conversation',
      error: error.message,
    });
  }
});

/**
 * POST /api/bots/conversations/:conversationId/messages
 * Send a message in a bot conversation
 */
router.post('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { message_text } = req.body;

    if (!message_text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: message_text',
      });
    }

    // Save user message
    await queryWithTenant(
      `INSERT INTO bot_messages (
        conversation_id,
        sender_type,
        message_text
      ) VALUES ($1, $2, $3)`,
      [conversationId, 'User', message_text]
    );

    // Get conversation details
    const conversations = await queryWithTenant(
      `SELECT * FROM bot_conversations WHERE conversation_id = $1`,
      [conversationId]
    );

    if (conversations.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Get matching dialogs (simple keyword matching)
    const dialogs = await queryWithTenant(
      `SELECT * FROM bot_dialogs WHERE bot_id = $1`,
      [conversations[0].bot_id]
    );

    // In real implementation, would use NLP/ML to match intent
    let botResponse = 'I\'m not sure how to help with that. Can you rephrase?';

    for (const dialog of dialogs) {
      const patterns = dialog.intent_patterns || [];
      for (const pattern of patterns) {
        if (message_text.toLowerCase().includes(pattern.toLowerCase())) {
          const responses = dialog.responses || [];
          botResponse = responses[0] || botResponse;
          break;
        }
      }
    }

    // Save bot response
    const responseMessage = await queryWithTenant(
      `INSERT INTO bot_messages (
        conversation_id,
        sender_type,
        message_text
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [conversationId, 'Bot', botResponse]
    );

    res.json({
      success: true,
      data: responseMessage[0],
    });
  } catch (error: any) {
    console.error('Error processing message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process message',
      error: error.message,
    });
  }
});

/**
 * GET /api/bots/conversations/:conversationId/messages
 * Get messages in a conversation
 */
router.get('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const messages = await queryWithTenant(
      `SELECT * FROM bot_messages WHERE conversation_id = $1 ORDER BY sent_at`,
      [conversationId]
    );

    res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message,
    });
  }
});

/**
 * POST /api/bots/conversations/:conversationId/end
 * End a bot conversation
 */
router.post('/conversations/:conversationId/end', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;

    const result = await queryWithTenant(
      `UPDATE bot_conversations
       SET status = 'Ended', ended_at = CURRENT_TIMESTAMP
       WHERE conversation_id = $1
       RETURNING *`,
      [conversationId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    res.json({
      success: true,
      message: 'Conversation ended successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error ending conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end conversation',
      error: error.message,
    });
  }
});

/**
 * POST /api/bots/conversations/:conversationId/transfer
 * Transfer conversation to human agent
 */
router.post('/conversations/:conversationId/transfer', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const { agent_id, reason } = req.body;

    const result = await queryWithTenant(
      `UPDATE bot_conversations
       SET status = 'Transferred', transferred_to_agent = $1
       WHERE conversation_id = $2
       RETURNING *`,
      [agent_id, conversationId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Create note about transfer
    await queryWithTenant(
      `INSERT INTO bot_messages (
        conversation_id,
        sender_type,
        message_text
      ) VALUES ($1, $2, $3)`,
      [conversationId, 'System', `Conversation transferred to agent. Reason: ${reason || 'User request'}`]
    );

    res.json({
      success: true,
      message: 'Conversation transferred successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error transferring conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to transfer conversation',
      error: error.message,
    });
  }
});

/**
 * GET /api/bots/:botId/analytics
 * Get bot analytics
 */
router.get('/:botId/analytics', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const { start_date, end_date } = req.query;

    const params: any[] = [botId];
    let dateFilter = '';

    if (start_date && end_date) {
      dateFilter = ` AND started_at BETWEEN $2 AND $3`;
      params.push(start_date, end_date);
    }

    const conversationStats = await queryWithTenant(
      `SELECT
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN status = 'Ended' THEN 1 END) as completed_conversations,
        COUNT(CASE WHEN status = 'Transferred' THEN 1 END) as transferred_conversations,
        AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as avg_duration_seconds
       FROM bot_conversations
       WHERE bot_id = $1${dateFilter}`,
      params
    );

    const messageStats = await queryWithTenant(
      `SELECT COUNT(*) as total_messages
       FROM bot_messages bm
       JOIN bot_conversations bc ON bm.conversation_id = bc.conversation_id
       WHERE bc.bot_id = $1${dateFilter}`,
      params
    );

    res.json({
      success: true,
      data: {
        conversations: conversationStats[0],
        messages: messageStats[0],
      },
    });
  } catch (error: any) {
    console.error('Error fetching bot analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bot analytics',
      error: error.message,
    });
  }
});

export default router;
