// routes/kb.js
const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Article } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Search articles
router.get('/', 
  query('query').optional().isString().trim(),
  query('tags').optional(),
  query('status').optional().isIn(['draft', 'published']),
  authenticate,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { query: searchQuery, tags, status } = req.query;
      let filter = {};

      // Role-based filtering
      if (req.user.role === 'user') {
        filter.status = 'published';
      } else if (status) {
        filter.status = status;
      }

      // Tag filtering
      if (tags) {
        const tagArray = Array.isArray(tags) ? tags : tags.split(',');
        filter.tags = { $in: tagArray.map(tag => tag.trim()) };
      }

      let articles;
      
      if (searchQuery) {
        // Text search with scoring
        articles = await Article.find({
          ...filter,
          $text: { $search: searchQuery }
        }, {
          score: { $meta: 'textScore' }
        })
        .sort({ score: { $meta: 'textScore' } })
        .limit(20);
      } else {
        // Regular query
        articles = await Article.find(filter)
          .sort({ updatedAt: -1 })
          .limit(20);
      }

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'KB search performed',
        userId: req.user._id,
        query: searchQuery,
        resultsCount: articles.length
      }));

      res.json({
        articles,
        total: articles.length,
        query: searchQuery
      });

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'KB search failed',
        error: error.message
      }));

      res.status(500).json({ error: 'Search failed' });
    }
  }
);

// Get single article
router.get('/:id', authenticate, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Check permissions
    if (article.status === 'draft' && req.user.role === 'user') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(article);

  } catch (error) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      traceId: req.traceId,
      message: 'Get article failed',
      error: error.message,
      articleId: req.params.id
    }));

    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

// Create article (admin only)
router.post('/',
  authenticate,
  authorize('admin'),
  [
    body('title')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Title is required'),
    body('body')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Body is required'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('status')
      .optional()
      .isIn(['draft', 'published'])
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

      const { title, body, tags, status } = req.body;

      const article = new Article({
        title,
        body,
        tags: tags || [],
        status: status || 'draft'
      });

      await article.save();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Article created',
        userId: req.user._id,
        articleId: article._id,
        title: article.title
      }));

      res.status(201).json(article);

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Article creation failed',
        error: error.message
      }));

      res.status(500).json({ error: 'Failed to create article' });
    }
  }
);

// Update article (admin only)
router.put('/:id',
  authenticate,
  authorize('admin'),
  [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Title cannot be empty'),
    body('body')
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage('Body cannot be empty'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('status')
      .optional()
      .isIn(['draft', 'published'])
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

      const article = await Article.findById(req.params.id);
      
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      // Update fields
      const { title, body, tags, status } = req.body;
      if (title !== undefined) article.title = title;
      if (body !== undefined) article.body = body;
      if (tags !== undefined) article.tags = tags;
      if (status !== undefined) article.status = status;

      await article.save();

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Article updated',
        userId: req.user._id,
        articleId: article._id
      }));

      res.json(article);

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Article update failed',
        error: error.message,
        articleId: req.params.id
      }));

      res.status(500).json({ error: 'Failed to update article' });
    }
  }
);

// Delete article (admin only)
router.delete('/:id',
  authenticate,
  authorize('admin'),
  async (req, res) => {
    try {
      const article = await Article.findById(req.params.id);
      
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      await Article.findByIdAndDelete(req.params.id);

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: req.traceId,
        message: 'Article deleted',
        userId: req.user._id,
        articleId: req.params.id
      }));

      res.json({ message: 'Article deleted successfully' });

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: req.traceId,
        message: 'Article deletion failed',
        error: error.message,
        articleId: req.params.id
      }));

      res.status(500).json({ error: 'Failed to delete article' });
    }
  }
);

module.exports = router;