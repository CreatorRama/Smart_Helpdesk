// scripts/mongo-init.js
// MongoDB initialization script for Docker
db = db.getSiblingDB('helpdesk');

// Create indexes for better performance
db.users.createIndex({ email: 1 }, { unique: true });
db.articles.createIndex({ title: "text", body: "text", tags: "text" });
db.articles.createIndex({ status: 1, tags: 1 });
db.tickets.createIndex({ createdBy: 1, status: 1 });
db.tickets.createIndex({ assignee: 1, status: 1 });
db.tickets.createIndex({ category: 1, status: 1 });
db.tickets.createIndex({ createdAt: -1 });
db.agentsuggestions.createIndex({ ticketId: 1 });
db.auditlogs.createIndex({ ticketId: 1, timestamp: -1 });
db.auditlogs.createIndex({ traceId: 1 });
db.auditlogs.createIndex({ timestamp: -1 });

print('Database indexes created successfully');

// .env.example
/*
# Server Configuration
NODE_ENV=development
PORT=8080

# Database
MONGO_URI=mongodb://localhost:27017/helpdesk

# Authentication
JWT_SECRET=change-me-in-production-use-long-random-string

# Agent Configuration
AUTO_CLOSE_ENABLED=true
CONFIDENCE_THRESHOLD=0.78
STUB_MODE=true

# LLM Configuration (optional)
DEEPSEEK_API_KEY=your-deepseek-api-key-here

# CORS
FRONTEND_URL=http://localhost:3000

# Logging
LOG_LEVEL=info
*/

// scripts/test-api.js
const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:8080';

class APITester {
  constructor() {
    this.tokens = {};
    this.testResults = [];
  }

  async runTests() {
    console.log('🚀 Starting API tests...\n');

    try {
      await this.testHealthChecks();
      await this.testAuthentication();
      await this.testKnowledgeBase();
      await this.testTickets();
      await this.testAgentWorkflow();
      
      this.printResults();
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
    }
  }

  async testHealthChecks() {
    console.log('Testing health checks...');
    
    const health = await axios.get(`${BASE_URL}/healthz`);
    this.assertStatus(health, 200, 'Health check');

    const ready = await axios.get(`${BASE_URL}/readyz`);
    this.assertStatus(ready, 200, 'Readiness check');
  }

  async testAuthentication() {
    console.log('Testing authentication...');

    // Register new user
    const registerData = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      password: 'password123'
    };

    const registerRes = await axios.post(`${BASE_URL}/api/auth/register`, registerData);
    this.assertStatus(registerRes, 201, 'User registration');
    this.tokens.user = registerRes.data.token;

    // Login
    const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: registerData.email,
      password: registerData.password
    });
    this.assertStatus(loginRes, 200, 'User login');
  }

  async testKnowledgeBase() {
    console.log('Testing knowledge base...');

    const searchRes = await axios.get(`${BASE_URL}/api/kb`, {
      headers: { Authorization: `Bearer ${this.tokens.user}` }
    });
    this.assertStatus(searchRes, 200, 'KB search');
  }

  async testTickets() {
    console.log('Testing ticket creation...');

    const ticketData = {
      title: 'Test API Issue',
      description: 'This is a test ticket created via API',
      category: 'tech'
    };

    const createRes = await axios.post(`${BASE_URL}/api/tickets`, ticketData, {
      headers: { Authorization: `Bearer ${this.tokens.user}` }
    });
    this.assertStatus(createRes, 201, 'Ticket creation');

    const ticketId = createRes.data.ticket._id;

    // Get ticket
    const getRes = await axios.get(`${BASE_URL}/api/tickets/${ticketId}`, {
      headers: { Authorization: `Bearer ${this.tokens.user}` }
    });
    this.assertStatus(getRes, 200, 'Get ticket');

    // List tickets
    const listRes = await axios.get(`${BASE_URL}/api/tickets`, {
      headers: { Authorization: `Bearer ${this.tokens.user}` }
    });
    this.assertStatus(listRes, 200, 'List tickets');
  }

  async testAgentWorkflow() {
    console.log('Testing agent workflow (waiting for triage)...');
    
    // Wait a moment for auto-triage to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    const listRes = await axios.get(`${BASE_URL}/api/tickets`, {
      headers: { Authorization: `Bearer ${this.tokens.user}` }
    });

    if (listRes.data.tickets.length > 0) {
      const ticket = listRes.data.tickets[0];
      console.log(`✅ Ticket ${ticket._id} status: ${ticket.status}`);
      
      if (ticket.agentSuggestionId) {
        console.log('✅ Agent suggestion created');
      }
    }
  }

  assertStatus(response, expectedStatus, testName) {
    const success = response.status === expectedStatus;
    this.testResults.push({ testName, success, status: response.status, expectedStatus });
    
    if (success) {
      console.log(`  ✅ ${testName}`);
    } else {
      console.log(`  ❌ ${testName} (got ${response.status}, expected ${expectedStatus})`);
    }
  }

  printResults() {
    const passed = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;
    
    console.log(`\n📊 Test Results: ${passed}/${total} passed`);
    
    if (passed === total) {
      console.log('🎉 All tests passed!');
    } else {
      console.log('❌ Some tests failed. Check the output above.');
      process.exit(1);
    }
  }
}

if (require.main === module) {
  const tester = new APITester();
  tester.runTests();
}

module.exports = APITester;