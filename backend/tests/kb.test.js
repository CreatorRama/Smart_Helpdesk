const request = require('supertest');
const app = require('../server');
const { User, Article } = require('../models');
const jwt = require('jsonwebtoken');

describe('Knowledge Base', () => {
  let adminToken, userToken;

  beforeEach(async () => {
    // Create admin user
    const admin = new User({
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: 'password123',
      role: 'admin'
    });
    await admin.save();
    adminToken = jwt.sign({ userId: admin._id }, process.env.JWT_SECRET || 'change-me');

    // Create regular user
    const user = new User({
      name: 'User',
      email: 'user@example.com',
      passwordHash: 'password123',
      role: 'user'
    });
    await user.save();
    userToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'change-me');
  });

  describe('GET /api/kb', () => {
    test('should search published articles', async () => {
      // Create test articles
      await Article.create([
        {
          title: 'How to reset password',
          body: 'Instructions for password reset...',
          tags: ['account', 'password'],
          status: 'published'
        },
        {
          title: 'Billing FAQ',
          body: 'Frequently asked questions about billing...',
          tags: ['billing', 'faq'],
          status: 'published'
        }
      ]);

      const response = await request(app)
        .get('/api/kb?query=password')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.articles).toHaveLength(1);
      expect(response.body.articles[0].title).toContain('password');
    });

    test('should not show draft articles to regular users', async () => {
      await Article.create({
        title: 'Draft Article',
        body: 'This is a draft...',
        tags: ['test'],
        status: 'draft'
      });

      const response = await request(app)
        .get('/api/kb')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.articles).toHaveLength(0);
    });
  });

  describe('POST /api/kb', () => {
    test('should create article as admin', async () => {
      const articleData = {
        title: 'Test Article',
        body: 'This is a test article',
        tags: ['test'],
        status: 'published'
      };

      const response = await request(app)
        .post('/api/kb')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(articleData)
        .expect(201);

      expect(response.body.title).toBe(articleData.title);
      expect(response.body.tags).toEqual(articleData.tags);
    });

    test('should not create article as regular user', async () => {
      const articleData = {
        title: 'Test Article',
        body: 'This is a test article',
        tags: ['test']
      };

      await request(app)
        .post('/api/kb')
        .set('Authorization', `Bearer ${userToken}`)
        .send(articleData)
        .expect(403);
    });
  });
});
