import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/chat/sessions
 * Get all chat sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { status, agent_id } = req.query;

    let query = `
      SELECT cs.*,
             u.first_name || ' ' || u.last_name as agent_name,
             (SELECT COUNT(*) FROM chat_messages cm WHERE cm.session_id = cs.session_id) as message_count
      FROM chat_sessions cs
      LEFT JOIN users u ON cs.agent_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND cs.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (agent_id) {
      query += ` AND cs.agent_id = $${paramIndex}`;
      params.push(agent_id);
      paramIndex++;
    }

    query += ` ORDER BY cs.started_date DESC`;

    const sessions = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: sessions,
    });
  } catch (error: any) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat sessions',
      error: error.message,
    });
  }
});

/**
 * GET /api/chat/sessions/:id
 * Get a specific chat session
 */
router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const sessions = await queryWithTenant(
      `SELECT cs.*,
              u.first_name || ' ' || u.last_name as agent_name
       FROM chat_sessions cs
       LEFT JOIN users u ON cs.agent_id = u.user_id
       WHERE cs.session_id = $1`,
      [id]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found',
      });
    }

    res.json({
      success: true,
      data: sessions[0],
    });
  } catch (error: any) {
    console.error('Error fetching chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat session',
      error: error.message,
    });
  }
});

/**
 * POST /api/chat/sessions
 * Start a new chat session
 */
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { visitor_name, visitor_email, initial_message, pre_chat_data } = req.body;

    if (!visitor_name) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: visitor_name',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO chat_sessions (
        visitor_name,
        visitor_email,
        pre_chat_data,
        status
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        visitor_name,
        visitor_email,
        JSON.stringify(pre_chat_data || {}),
        'Waiting',
      ]
    );

    const sessionId = result[0].session_id;

    // Add initial message if provided
    if (initial_message) {
      await queryWithTenant(
        `INSERT INTO chat_messages (
          session_id,
          sender_type,
          message_text
        ) VALUES ($1, $2, $3)`,
        [sessionId, 'Visitor', initial_message]
      );
    }

    res.status(201).json({
      success: true,
      message: 'Chat session started',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error starting chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start chat session',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/chat/sessions/:id
 * Update a chat session
 */
router.patch('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['status', 'agent_id', 'ended_date', 'rating'];

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
      `UPDATE chat_sessions SET ${setFields.join(', ')}
       WHERE session_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found',
      });
    }

    res.json({
      success: true,
      message: 'Chat session updated',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update chat session',
      error: error.message,
    });
  }
});

/**
 * POST /api/chat/sessions/:id/assign
 * Assign a chat session to an agent
 */
router.post('/sessions/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agent_id } = req.body;

    if (!agent_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: agent_id',
      });
    }

    const result = await queryWithTenant(
      `UPDATE chat_sessions
       SET agent_id = $1, status = 'Active'
       WHERE session_id = $2
       RETURNING *`,
      [agent_id, id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found',
      });
    }

    res.json({
      success: true,
      message: 'Chat session assigned to agent',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error assigning chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign chat session',
      error: error.message,
    });
  }
});

/**
 * GET /api/chat/sessions/:id/messages
 * Get all messages in a chat session
 */
router.get('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const messages = await queryWithTenant(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY sent_date ASC`,
      [id]
    );

    res.json({
      success: true,
      data: messages,
    });
  } catch (error: any) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chat messages',
      error: error.message,
    });
  }
});

/**
 * POST /api/chat/sessions/:id/messages
 * Send a message in a chat session
 */
router.post('/sessions/:id/messages', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sender_type, message_text, attachment_url } = req.body;

    if (!sender_type || !message_text) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: sender_type, message_text',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO chat_messages (
        session_id,
        sender_type,
        message_text,
        attachment_url
      ) VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [id, sender_type, message_text, attachment_url]
    );

    res.status(201).json({
      success: true,
      message: 'Message sent',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: error.message,
    });
  }
});

/**
 * POST /api/chat/sessions/:id/end
 * End a chat session
 */
router.post('/sessions/:id/end', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rating, feedback } = req.body;

    const result = await queryWithTenant(
      `UPDATE chat_sessions
       SET status = 'Ended',
           ended_date = CURRENT_TIMESTAMP,
           rating = $1
       WHERE session_id = $2
       RETURNING *`,
      [rating, id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found',
      });
    }

    res.json({
      success: true,
      message: 'Chat session ended',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error ending chat session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end chat session',
      error: error.message,
    });
  }
});

/**
 * GET /api/chat/transcript/:sessionId
 * Get chat transcript for a session
 */
router.get('/transcript/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const session = await queryWithTenant(
      `SELECT * FROM chat_sessions WHERE session_id = $1`,
      [sessionId]
    );

    if (session.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Chat session not found',
      });
    }

    const messages = await queryWithTenant(
      `SELECT * FROM chat_messages
       WHERE session_id = $1
       ORDER BY sent_date ASC`,
      [sessionId]
    );

    res.json({
      success: true,
      data: {
        session: session[0],
        messages,
      },
    });
  } catch (error: any) {
    console.error('Error fetching transcript:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transcript',
      error: error.message,
    });
  }
});

export default router;
