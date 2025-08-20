// routes/tickets.js
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Ticket, AgentSuggestion, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const AgentService = require('../services/agentService');
const crypto = require('crypto');

const router = express.Router();
const agentService = new AgentService();

// Get tickets with filtering
router.get('/',
  authenticate,
  [
    query('status').optional().isIn(['open', 'triaged', 'waiting_human', 'resolved', 'closed']),
    query('category').optional().isIn(['billing', 'tech', 'shipping', 'other']),
    query('my').optional().isBoolean(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { status, category, my, page = 1, limit = 20 } = req.query;
      let filter = {};

      // Role-based filtering
      if (req.user.role === 'user') {
        filter.createdBy = req.user._id;
      } else if (my === 'true') {
        if (req.user.role === 'agent') {
          filter.assignee = req.user._id;
        } else {
          filter.createdBy = req.user._id;
        }
      }

      // Status and category filters
      if (status) filter.status = status;
      if (category) filter.category = category;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const tickets = await Ticket.find(filter)
        .populate('createdBy', 'name email')
        .populate('assignee', 'name email')
        .populate('agentSuggestionId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Ticket.countDocuments(filter);

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Tickets fetched',
        userId: req.user._id,
        count: tickets.length,
        total
      }));

      res.json({
        tickets,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Get tickets failed',
        error: error.message
      }));

      res.status(500).json({ error: 'Failed to fetch tickets' });
    }
  }
);

// Get single ticket
router.get('/:id', authenticate, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('assignee', 'name email')
      .populate('agentSuggestionId')
      .populate('replies.author', 'name email');

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Permission check
    if (req.user.role === 'user' && ticket.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(ticket);

  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      traceId: req.traceId,
      message: 'Get ticket failed',
      error: error.message,
      ticketId: req.params.id
    }));

    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// Create ticket
router.post('/',
  authenticate,
  [
    body('title')
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title is required and must be less than 200 characters'),
    body('description')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Description is required and must be less than 5000 characters'),
    body('category')
      .optional()
      .isIn(['billing', 'tech', 'shipping', 'other'])
      .withMessage('Invalid category')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { title, description, category } = req.body;
      const traceId = crypto.randomUUID();

      const ticket = new Ticket({
        title,
        description,
        category: category || 'other',
        createdBy: req.user._id,
        status: 'open'
      });

      await ticket.save();

      // Log ticket creation
      const { AuditLog } = require('../models');
      await new AuditLog({
        ticketId: ticket._id,
        traceId,
        actor: 'user',
        action: 'TICKET_CREATED',
        meta: {
          title: ticket.title,
          category: ticket.category,
          createdBy: req.user._id
        }
      }).save();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId,
        message: 'Ticket created',
        ticketId: ticket._id,
        userId: req.user._id,
        title: ticket.title
      }));

      // Trigger async triage (don't wait for completion)
      setImmediate(async () => {
        try {
          await agentService.triageTicket(ticket._id, traceId);
        } catch (error) {
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            traceId,
            message: 'Auto-triage failed',
            ticketId: ticket._id,
            error: error.message
          }));
        }
      });

      // Return created ticket
      const populatedTicket = await Ticket.findById(ticket._id)
        .populate('createdBy', 'name email');

      res.status(201).json({
        ticket: populatedTicket,
        traceId
      });

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Ticket creation failed',
        error: error.message
      }));

      res.status(500).json({ error: 'Failed to create ticket' });
    }
  }
);

// Reply to ticket (agents only)
router.post('/:id/reply',
  authenticate,
  authorize('agent', 'admin'),
  [
    body('content')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Reply content is required and must be less than 5000 characters'),
    body('status')
      .optional()
      .isIn(['open', 'waiting_human', 'resolved', 'closed'])
      .withMessage('Invalid status')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { content, status } = req.body;
      const ticket = await Ticket.findById(req.params.id);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      // Add reply
      ticket.replies.push({
        author: req.user._id,
        content,
        isAgentGenerated: false,
        timestamp: new Date()
      });

      // Update status if provided
      if (status) {
        ticket.status = status;
      }

      // If resolving, ensure assignee is set
      if (status === 'resolved' && !ticket.assignee) {
        ticket.assignee = req.user._id;
      }

      await ticket.save();

      // Log the reply
      const { AuditLog } = require('../models');
      await new AuditLog({
        ticketId: ticket._id,
        traceId: req.traceId,
        actor: 'agent',
        action: 'REPLY_SENT',
        meta: {
          agentId: req.user._id,
          contentLength: content.length,
          newStatus: ticket.status
        }
      }).save();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Reply sent',
        ticketId: ticket._id,
        agentId: req.user._id,
        newStatus: ticket.status
      }));

      // Return updated ticket
      const updatedTicket = await Ticket.findById(ticket._id)
        .populate('createdBy', 'name email')
        .populate('assignee', 'name email')
        .populate('replies.author', 'name email');

      res.json(updatedTicket);

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Reply failed',
        error: error.message,
        ticketId: req.params.id
      }));

      res.status(500).json({ error: 'Failed to send reply' });
    }
  }
);

// Assign ticket (agents/admins only)
router.post('/:id/assign',
  authenticate,
  authorize('agent', 'admin'),
  [
    body('assigneeId')
      .isMongoId()
      .withMessage('Valid assignee ID required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { assigneeId } = req.body;
      const ticket = await Ticket.findById(req.params.id);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      // Verify assignee exists and is agent/admin
      const assignee = await User.findById(assigneeId);
      if (!assignee || !['agent', 'admin'].includes(assignee.role)) {
        return res.status(400).json({ error: 'Invalid assignee' });
      }

      const oldAssigneeId = ticket.assignee;
      ticket.assignee = assigneeId;
      ticket.status = 'waiting_human';
      await ticket.save();

      // Log assignment
      const { AuditLog } = require('../models');
      await new AuditLog({
        ticketId: ticket._id,
        traceId: req.traceId,
        actor: 'agent',
        action: 'TICKET_ASSIGNED',
        meta: {
          assignedBy: req.user._id,
          oldAssigneeId,
          newAssigneeId: assigneeId
        }
      }).save();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Ticket assigned',
        ticketId: ticket._id,
        assignedBy: req.user._id,
        assigneeId
      }));

      // Return updated ticket
      const updatedTicket = await Ticket.findById(ticket._id)
        .populate('createdBy', 'name email')
        .populate('assignee', 'name email');

      res.json(updatedTicket);

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Assignment failed',
        error: error.message,
        ticketId: req.params.id
      }));

      res.status(500).json({ error: 'Failed to assign ticket' });
    }
  }
);

// Reopen ticket
router.post('/:id/reopen',
  authenticate,
  authorize('agent', 'admin', 'user'),
  async (req, res) => {
    try {
      const ticket = await Ticket.findById(req.params.id);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      // Permission check for users
      if (req.user.role === 'user' && ticket.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (!['resolved', 'closed'].includes(ticket.status)) {
        return res.status(400).json({ error: 'Can only reopen resolved or closed tickets' });
      }

      ticket.status = 'waiting_human';
      await ticket.save();

      // Log reopening
      const { AuditLog } = require('../models');
      await new AuditLog({
        ticketId: ticket._id,
        traceId: req.traceId,
        actor: req.user.role === 'user' ? 'user' : 'agent',
        action: 'TICKET_REOPENED',
        meta: {
          reopenedBy: req.user._id,
          previousStatus: 'resolved'
        }
      }).save();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Ticket reopened',
        ticketId: ticket._id,
        reopenedBy: req.user._id
      }));

      // Return updated ticket
      const updatedTicket = await Ticket.findById(ticket._id)
        .populate('createdBy', 'name email')
        .populate('assignee', 'name email');

      res.json(updatedTicket);

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Reopen failed',
        error: error.message,
        ticketId: req.params.id
      }));

      res.status(500).json({ error: 'Failed to reopen ticket' });
    }
  }
);

// Close ticket
router.post('/:id/close',
  authenticate,
  authorize('agent', 'admin'),
  async (req, res) => {
    try {
      const ticket = await Ticket.findById(req.params.id);

      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      ticket.status = 'closed';
      if (!ticket.assignee) {
        ticket.assignee = req.user._id;
      }
      await ticket.save();

      // Log closing
      const { AuditLog } = require('../models');
      await new AuditLog({
        ticketId: ticket._id,
        traceId: req.traceId,
        actor: 'agent',
        action: 'TICKET_CLOSED',
        meta: {
          closedBy: req.user._id
        }
      }).save();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Ticket closed',
        ticketId: ticket._id,
        closedBy: req.user._id
      }));

      // Return updated ticket
      const updatedTicket = await Ticket.findById(ticket._id)
        .populate('createdBy', 'name email')
        .populate('assignee', 'name email');

      res.json(updatedTicket);

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Close failed',
        error: error.message,
        ticketId: req.params.id
      }));

      res.status(500).json({ error: 'Failed to close ticket' });
    }
  }
);

module.exports = router;