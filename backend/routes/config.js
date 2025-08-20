const express = require('express');
const { body, validationResult } = require('express-validator');
const { Config } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Get configuration
router.get('/', authenticate, async (req, res) => {
  try {
    let config = await Config.findOne();
    
    if (!config) {
      // Create default config if none exists
      config = new Config({
        autoCloseEnabled: process.env.AUTO_CLOSE_ENABLED === 'true',
        confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.78,
        slaHours: 24
      });
      await config.save();
    }

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      traceId: req.traceId,
      message: 'Config retrieved',
      userId: req.user._id
    }));

    res.json(config);

  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      traceId: req.traceId,
      message: 'Get config failed',
      error: error.message
    }));

    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

// Update configuration (admin only)
router.put('/',
  authenticate,
  authorize('admin'),
  [
    body('autoCloseEnabled')
      .optional()
      .isBoolean()
      .withMessage('autoCloseEnabled must be boolean'),
    body('confidenceThreshold')
      .optional()
      .isFloat({ min: 0, max: 1 })
      .withMessage('confidenceThreshold must be between 0 and 1'),
    body('slaHours')
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage('slaHours must be between 1 and 168')
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

      const { autoCloseEnabled, confidenceThreshold, slaHours } = req.body;

      let config = await Config.findOne();
      if (!config) {
        config = new Config();
      }

      const oldConfig = {
        autoCloseEnabled: config.autoCloseEnabled,
        confidenceThreshold: config.confidenceThreshold,
        slaHours: config.slaHours
      };

      // Update fields
      if (autoCloseEnabled !== undefined) config.autoCloseEnabled = autoCloseEnabled;
      if (confidenceThreshold !== undefined) config.confidenceThreshold = confidenceThreshold;
      if (slaHours !== undefined) config.slaHours = slaHours;

      await config.save();

      // Log config change
      const { AuditLog } = require('../models');
      await new AuditLog({
        traceId: req.traceId,
        actor: 'agent',
        action: 'CONFIG_UPDATED',
        meta: {
          updatedBy: req.user._id,
          oldConfig,
          newConfig: {
            autoCloseEnabled: config.autoCloseEnabled,
            confidenceThreshold: config.confidenceThreshold,
            slaHours: config.slaHours
          }
        }
      }).save();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Config updated',
        updatedBy: req.user._id
      }));

      res.json(config);

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Config update failed',
        error: error.message
      }));

      res.status(500).json({ error: 'Failed to update configuration' });
    }
  }
);

module.exports = router;