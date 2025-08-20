const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:5000';

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