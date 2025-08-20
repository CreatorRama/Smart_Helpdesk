// routes/audit.js
const express = require('express');
const { query, validationResult } = require('express-validator');
const { AuditLog } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const auditRouter = express.Router();

// Get audit logs for a ticket
auditRouter.get('/tickets/:ticketId/audit',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('action').optional().isString()
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

      const { ticketId } = req.params;
      const { page = 1, limit = 50, action } = req.query;

      // Check if user can access this ticket's audit logs
      if (req.user.role === 'user') {
        const { Ticket } = require('../models');
        const ticket = await Ticket.findById(ticketId);
        
        if (!ticket || ticket.createdBy.toString() !== req.user._id.toString()) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      let filter = { ticketId };
      if (action) {
        filter.action = action;
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const logs = await AuditLog.find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await AuditLog.countDocuments(filter);

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Audit logs retrieved',
        ticketId,
        userId: req.user._id,
        count: logs.length
      }));

      res.json({
        logs,
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
        message: 'Get audit logs failed',
        error: error.message,
        ticketId: req.params.ticketId
      }));

      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

// Get audit logs by trace ID (for debugging)
auditRouter.get('/trace/:traceId',
  authenticate,
  authorize('agent', 'admin'),
  async (req, res) => {
    try {
      const { traceId } = req.params;

      const logs = await AuditLog.find({ traceId })
        .sort({ timestamp: 1 });

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Trace audit logs retrieved',
        searchTraceId: traceId,
        userId: req.user._id,
        count: logs.length
      }));

      res.json({
        traceId,
        logs,
        count: logs.length
      });

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Get trace logs failed',
        error: error.message,
        searchTraceId: req.params.traceId
      }));

      res.status(500).json({ error: 'Failed to fetch trace logs' });
    }
  }
);

// Get system-wide audit logs (admin only)
auditRouter.get('/system',
  authenticate,
  authorize('admin'),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('action').optional().isString(),
    query('actor').optional().isIn(['system', 'agent', 'user']),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601()
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

      const { 
        page = 1, 
        limit = 50, 
        action, 
        actor, 
        from, 
        to 
      } = req.query;

      let filter = {};
      
      if (action) {
        filter.action = action;
      }
      
      if (actor) {
        filter.actor = actor;
      }
      
      if (from || to) {
        filter.timestamp = {};
        if (from) {
          filter.timestamp.$gte = new Date(from);
        }
        if (to) {
          filter.timestamp.$lte = new Date(to);
        }
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const logs = await AuditLog.find(filter)
        .populate('ticketId', 'title status')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await AuditLog.countDocuments(filter);

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'System audit logs retrieved',
        userId: req.user._id,
        count: logs.length,
        filters: { action, actor, from, to }
      }));

      res.json({
        logs,
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
        message: 'Get system audit logs failed',
        error: error.message
      }));

      res.status(500).json({ error: 'Failed to fetch system audit logs' });
    }
  }
);

// Get audit statistics (admin only)
auditRouter.get('/stats',
  authenticate,
  authorize('admin'),
  [
    query('days').optional().isInt({ min: 1, max: 365 })
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

      const days = parseInt(req.query.days) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const pipeline = [
        {
          $match: {
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 },
            latestTimestamp: { $max: '$timestamp' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ];

      const actionStats = await AuditLog.aggregate(pipeline);

      const actorPipeline = [
        {
          $match: {
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$actor',
            count: { $sum: 1 }
          }
        }
      ];

      const actorStats = await AuditLog.aggregate(actorPipeline);

      const totalLogs = await AuditLog.countDocuments({
        timestamp: { $gte: startDate }
      });

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Audit statistics retrieved',
        userId: req.user._id,
        days,
        totalLogs
      }));

      res.json({
        period: {
          days,
          startDate,
          endDate: new Date()
        },
        totalLogs,
        actionStats,
        actorStats
      });

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Get audit statistics failed',
        error: error.message
      }));

      res.status(500).json({ error: 'Failed to fetch audit statistics' });
    }
  }
);

// Utility function to log audit events (used by other services)
const logAuditEvent = async (eventData) => {
  try {
    const auditLog = new AuditLog({
      ticketId: eventData.ticketId,
      traceId: eventData.traceId,
      actor: eventData.actor,
      action: eventData.action,
      meta: eventData.meta || {},
      timestamp: eventData.timestamp || new Date()
    });

    await auditLog.save();

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      traceId: eventData.traceId,
      message: 'Audit event logged',
      action: eventData.action,
      actor: eventData.actor,
      ticketId: eventData.ticketId
    }));

    return auditLog;
  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      traceId: eventData.traceId,
      message: 'Failed to log audit event',
      error: error.message,
      eventData
    }));
    throw error;
  }
};

module.exports = {
  auditRouter,
  logAuditEvent
};