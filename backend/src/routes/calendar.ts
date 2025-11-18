import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { queryWithTenant } from '../utils/db-helpers';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/calendar/events
 * Get calendar events
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const { start_date, end_date, owner_id } = req.query;
    const userId = (req as any).user.userId;

    let query = `
      SELECT e.*,
             u.first_name || ' ' || u.last_name as owner_name,
             (SELECT COUNT(*) FROM event_attendees ea WHERE ea.event_id = e.event_id) as attendee_count
      FROM events e
      LEFT JOIN users u ON e.owner_id = u.user_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // Filter by date range
    if (start_date) {
      query += ` AND e.start_date >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND e.end_date <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    // Filter by owner
    if (owner_id) {
      query += ` AND e.owner_id = $${paramIndex}`;
      params.push(owner_id);
      paramIndex++;
    } else {
      // Show user's own events and events they're attending
      query += ` AND (e.owner_id = $${paramIndex} OR e.event_id IN (
        SELECT event_id FROM event_attendees WHERE attendee_id = $${paramIndex}
      ))`;
      params.push(userId);
      paramIndex++;
    }

    query += ` ORDER BY e.start_date ASC`;

    const events = await queryWithTenant(query, params);

    res.json({
      success: true,
      data: events,
    });
  } catch (error: any) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch events',
      error: error.message,
    });
  }
});

/**
 * GET /api/calendar/events/:id
 * Get a specific event
 */
router.get('/events/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const events = await queryWithTenant(
      `SELECT e.*,
              u.first_name || ' ' || u.last_name as owner_name
       FROM events e
       LEFT JOIN users u ON e.owner_id = u.user_id
       WHERE e.event_id = $1`,
      [id]
    );

    if (events.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    res.json({
      success: true,
      data: events[0],
    });
  } catch (error: any) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event',
      error: error.message,
    });
  }
});

/**
 * POST /api/calendar/events
 * Create a new event
 */
router.post('/events', async (req: Request, res: Response) => {
  try {
    const {
      subject,
      description,
      start_date,
      end_date,
      location,
      is_all_day,
      related_record_id,
    } = req.body;

    if (!subject || !start_date) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: subject, start_date',
      });
    }

    const owner_id = (req as any).user.userId;

    const result = await queryWithTenant(
      `INSERT INTO events (
        subject,
        description,
        start_date,
        end_date,
        location,
        is_all_day,
        owner_id,
        related_record_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        subject,
        description,
        start_date,
        end_date || start_date,
        location,
        is_all_day || false,
        owner_id,
        related_record_id,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Event created successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create event',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/calendar/events/:id
 * Update an event
 */
router.patch('/events/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'subject',
      'description',
      'start_date',
      'end_date',
      'location',
      'is_all_day',
      'related_record_id',
    ];

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
      `UPDATE events SET ${setFields.join(', ')}
       WHERE event_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    res.json({
      success: true,
      message: 'Event updated successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/calendar/events/:id
 * Delete an event
 */
router.delete('/events/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Delete attendees first
    await queryWithTenant(`DELETE FROM event_attendees WHERE event_id = $1`, [id]);

    const result = await queryWithTenant(
      `DELETE FROM events WHERE event_id = $1 RETURNING *`,
      [id]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Event not found',
      });
    }

    res.json({
      success: true,
      message: 'Event deleted successfully',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete event',
      error: error.message,
    });
  }
});

/**
 * GET /api/calendar/events/:id/attendees
 * Get event attendees
 */
router.get('/events/:id/attendees', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const attendees = await queryWithTenant(
      `SELECT ea.*,
              u.first_name || ' ' || u.last_name as attendee_name,
              u.email
       FROM event_attendees ea
       JOIN users u ON ea.attendee_id = u.user_id
       WHERE ea.event_id = $1`,
      [id]
    );

    res.json({
      success: true,
      data: attendees,
    });
  } catch (error: any) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendees',
      error: error.message,
    });
  }
});

/**
 * POST /api/calendar/events/:id/attendees
 * Add an attendee to an event
 */
router.post('/events/:id/attendees', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { attendee_id, response_status } = req.body;

    if (!attendee_id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: attendee_id',
      });
    }

    const result = await queryWithTenant(
      `INSERT INTO event_attendees (
        event_id,
        attendee_id,
        response_status
      ) VALUES ($1, $2, $3)
      RETURNING *`,
      [id, attendee_id, response_status || 'Invited']
    );

    res.status(201).json({
      success: true,
      message: 'Attendee added to event',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error adding attendee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add attendee',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/calendar/events/:id/attendees/:attendeeId
 * Update attendee response status
 */
router.patch('/events/:id/attendees/:attendeeId', async (req: Request, res: Response) => {
  try {
    const { id, attendeeId } = req.params;
    const { response_status } = req.body;

    if (!response_status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: response_status',
      });
    }

    const result = await queryWithTenant(
      `UPDATE event_attendees
       SET response_status = $1
       WHERE event_id = $2 AND attendee_id = $3
       RETURNING *`,
      [response_status, id, attendeeId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendee not found',
      });
    }

    res.json({
      success: true,
      message: 'Attendee response updated',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error updating attendee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update attendee',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/calendar/events/:id/attendees/:attendeeId
 * Remove an attendee from an event
 */
router.delete('/events/:id/attendees/:attendeeId', async (req: Request, res: Response) => {
  try {
    const { id, attendeeId } = req.params;

    const result = await queryWithTenant(
      `DELETE FROM event_attendees
       WHERE event_id = $1 AND attendee_id = $2
       RETURNING *`,
      [id, attendeeId]
    );

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Attendee not found',
      });
    }

    res.json({
      success: true,
      message: 'Attendee removed from event',
      data: result[0],
    });
  } catch (error: any) {
    console.error('Error removing attendee:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove attendee',
      error: error.message,
    });
  }
});

export default router;
