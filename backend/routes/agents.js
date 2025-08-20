// routes/agent.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const { AgentSuggestion, Ticket } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const AgentService = require('../services/agentService');

const router = express.Router();
const agentService = new AgentService();

// Trigger triage for a ticket (internal endpoint)
router.post('/triage',
  authenticate,
  authorize('agent', 'admin'),
  [
    body('ticketId')
      .isMongoId()
      .withMessage('Valid ticket ID required')
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

      const { ticketId } = req.body;

      // Verify ticket exists and can be triaged
      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      if (!['open', 'waiting_human'].includes(ticket.status)) {
        return res.status(400).json({ 
          error: 'Ticket cannot be triaged in current status',
          currentStatus: ticket.status 
        });
      }

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Manual triage triggered',
        ticketId,
        triggeredBy: req.user._id
      }));

      // Start triage asynchronously
      const triageResult = await agentService.triageTicket(ticketId, req.traceId);

      res.json({
        message: 'Triage completed successfully',
        result: triageResult
      });

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Manual triage failed',
        error: error.message
      }));

      res.status(500).json({ 
        error: 'Triage failed',
        details: error.message 
      });
    }
  }
);

// Get agent suggestion for a ticket
router.get('/suggestion/:ticketId',
  authenticate,
  authorize('agent', 'admin'),
  async (req, res) => {
    try {
      const { ticketId } = req.params;

      const suggestion = await AgentSuggestion.findOne({ ticketId })
        .populate('ticketId')
        .populate('articleIds')
        .sort({ createdAt: -1 }); // Get latest suggestion

      if (!suggestion) {
        return res.status(404).json({ error: 'No suggestion found for this ticket' });
      }

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Agent suggestion retrieved',
        ticketId,
        suggestionId: suggestion._id,
        requestedBy: req.user._id
      }));

      res.json(suggestion);

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Get suggestion failed',
        error: error.message,
        ticketId: req.params.ticketId
      }));

      res.status(500).json({ error: 'Failed to fetch suggestion' });
    }
  }
);

// Update agent suggestion draft (agents can edit before sending)
router.put('/suggestion/:suggestionId',
  authenticate,
  authorize('agent', 'admin'),
  [
    body('draftReply')
      .trim()
      .isLength({ min: 1, max: 5000 })
      .withMessage('Draft reply is required and must be less than 5000 characters')
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

      const { suggestionId } = req.params;
      const { draftReply } = req.body;

      const suggestion = await AgentSuggestion.findById(suggestionId);
      if (!suggestion) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }

      // Don't allow editing if already auto-closed
      if (suggestion.autoClosed) {
        return res.status(400).json({ error: 'Cannot edit suggestion for auto-closed ticket' });
      }

      const originalDraft = suggestion.draftReply;
      suggestion.draftReply = draftReply;
      await suggestion.save();

      // Log the edit
      const { AuditLog } = require('../models');
      await new AuditLog({
        ticketId: suggestion.ticketId,
        traceId: req.traceId,
        actor: 'agent',
        action: 'SUGGESTION_EDITED',
        meta: {
          suggestionId: suggestion._id,
          editedBy: req.user._id,
          originalLength: originalDraft.length,
          newLength: draftReply.length
        }
      }).save();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Agent suggestion edited',
        suggestionId: suggestion._id,
        editedBy: req.user._id
      }));

      res.json(suggestion);

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Edit suggestion failed',
        error: error.message,
        suggestionId: req.params.suggestionId
      }));

      res.status(500).json({ error: 'Failed to update suggestion' });
    }
  }
);

// Retry failed triage
router.post('/retry/:ticketId',
  authenticate,
  authorize('agent', 'admin'),
  async (req, res) => {
    try {
      const { ticketId } = req.params;

      const ticket = await Ticket.findById(ticketId);
      if (!ticket) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Triage retry triggered',
        ticketId,
        triggeredBy: req.user._id
      }));

      // Use retry mechanism with exponential backoff
      const result = await agentService.retryTriage(ticketId, 3);

      res.json({
        message: 'Triage retry completed successfully',
        result
      });

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Triage retry failed',
        error: error.message,
        ticketId: req.params.ticketId
      }));

      res.status(500).json({ 
        error: 'Triage retry failed',
        details: error.message 
      });
    }
  }
);

// Get triage statistics (admin/agent dashboard)
router.get('/stats',
  authenticate,
  authorize('agent', 'admin'),
  async (req, res) => {
    try {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Aggregate statistics
      const stats = await AgentSuggestion.aggregate([
        {
          $facet: {
            total: [{ $count: 'count' }],
            autoClosedTotal: [
              { $match: { autoClosed: true } },
              { $count: 'count' }
            ],
            last24h: [
              { $match: { createdAt: { $gte: last24Hours } } },
              { $count: 'count' }
            ],
            last7d: [
              { $match: { createdAt: { $gte: last7Days } } },
              { $count: 'count' }
            ],
            avgConfidence: [
              { $group: { _id: null, avg: { $avg: '$confidence' } } }
            ],
            confidenceDistribution: [
              {
                $bucket: {
                  groupBy: '$confidence',
                  boundaries: [0, 0.2, 0.4, 0.6, 0.8, 1.0],
                  default: 'other',
                  output: { count: { $sum: 1 } }
                }
              }
            ],
            categoryBreakdown: [
              {
                $group: {
                  _id: '$predictedCategory',
                  count: { $sum: 1 },
                  avgConfidence: { $avg: '$confidence' }
                }
              }
            ]
          }
        }
      ]);

      const result = {
        total: stats[0].total[0]?.count || 0,
        autoClosedTotal: stats[0].autoClosedTotal[0]?.count || 0,
        last24Hours: stats[0].last24h[0]?.count || 0,
        last7Days: stats[0].last7d[0]?.count || 0,
        averageConfidence: stats[0].avgConfidence[0]?.avg || 0,
        confidenceDistribution: stats[0].confidenceDistribution,
        categoryBreakdown: stats[0].categoryBreakdown,
        autoCloseRate: stats[0].total[0]?.count ? 
          (stats[0].autoClosedTotal[0]?.count || 0) / stats[0].total[0].count : 0
      };

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Triage stats retrieved',
        requestedBy: req.user._id
      }));

      res.json(result);

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Get stats failed',
        error: error.message
      }));

      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  }
);

// Health check for agent service
router.get('/health',
  authenticate,
  authorize('agent', 'admin'),
  async (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          llmProvider: 'ok',
          kbSearch: 'ok',
          database: 'ok'
        }
      };

      // Test database connection
      try {
        await AgentSuggestion.findOne().limit(1);
      } catch (error) {
        health.checks.database = 'error';
        health.status = 'degraded';
      }

      // Test KB search
      try {
        const { KBSearchService } = require('../services/llmService');
        const kbSearch = new KBSearchService();
        await kbSearch.search('test', null, 1);
      } catch (error) {
        health.checks.kbSearch = 'error';
        health.status = 'degraded';
      }

      res.json(health);

    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;