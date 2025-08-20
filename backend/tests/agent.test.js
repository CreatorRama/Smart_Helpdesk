const request = require('supertest');
const app = require('../server');
const { User, Ticket, Article } = require('../models');
const AgentService = require('../services/agentService');
const jwt = require('jsonwebtoken');

describe('Agent Service', () => {
  let agentService;
  let testTicket;

  beforeEach(async () => {
    agentService = new AgentService();
    
    // Create test user
    const user = new User({
      name: 'Test User',
      email: 'user@example.com',
      passwordHash: 'password123',
      role: 'user'
    });
    await user.save();

    // Create test KB articles
    await Article.create([
      {
        title: 'Password Reset Guide',
        body: 'To reset your password, follow these steps...',
        tags: ['account', 'password', 'security'],
        status: 'published'
      },
      {
        title: 'Billing FAQ',
        body: 'Common billing questions and answers...',
        tags: ['billing', 'payment', 'faq'],
        status: 'published'
      }
    ]);

    // Create test ticket
    testTicket = new Ticket({
      title: 'Cannot reset my password',
      description: 'The reset password link is not working. I clicked it multiple times but nothing happens.',
      createdBy: user._id,
      category: 'other',
      status: 'open'
    });
    await testTicket.save();
  });

  test('should complete triage workflow', async () => {
    const result = await agentService.triageTicket(testTicket._id);
    
    expect(result.success).toBe(true);
    expect(result.ticketId).toBe(testTicket._id);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(['auto_close', 'assign_human']).toContain(result.decision);
  });

  test('should handle triage retry on failure', async () => {
    // Create invalid ticket ID to force failure
    await expect(agentService.retryTriage('invalid-id'))
      .rejects.toThrow();
  });
});