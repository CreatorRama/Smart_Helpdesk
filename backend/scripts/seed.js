// scripts/seed.js
const mongoose = require('mongoose');
require('dotenv').config();

const { User, Article, Ticket, Config } = require('../models');

const seedData = {
  users: [
    {
      name: 'Admin User',
      email: 'admin@helpdesk.local',
      passwordHash: 'admin123',
      role: 'admin'
    },
    {
      name: 'Support Agent',
      email: 'agent@helpdesk.local',
      passwordHash: 'agent123',
      role: 'agent'
    },
    {
      name: 'Regular User',
      email: 'user@helpdesk.local',
      passwordHash: 'user123',
      role: 'user'
    },
    {
      name: 'AI Assistant',
      email: 'system@helpdesk.local',
      passwordHash: 'system123',
      role: 'agent'
    }
  ],

  articles: [
    {
      title: 'How to update payment method',
      body: `To update your payment method:

1. Log into your account
2. Navigate to Billing Settings
3. Click "Update Payment Method"
4. Enter your new card details
5. Save changes

If you encounter any issues, please contact our support team. We accept all major credit cards and PayPal.

For security reasons, we don't store your full card number - only the last 4 digits for reference.`,
      tags: ['billing', 'payments', 'account'],
      status: 'published'
    },
    {
      title: 'Troubleshooting 500 errors',
      body: `If you're experiencing 500 Internal Server Errors:

1. Check our status page for ongoing issues
2. Clear your browser cache and cookies
3. Try using an incognito/private browser window
4. Disable browser extensions temporarily
5. Try a different browser or device

If the issue persists:
- Note the exact time the error occurred
- Take a screenshot if possible
- Contact support with your account details

Our technical team monitors these errors 24/7 and works to resolve them quickly.`,
      tags: ['tech', 'errors', 'troubleshooting'],
      status: 'published'
    },
    {
      title: 'Tracking your shipment',
      body: `To track your order shipment:

1. Check your email for shipping confirmation
2. Use the tracking number provided
3. Visit our shipping partner's website
4. Enter your tracking number

Shipping timeframes:
- Standard shipping: 5-7 business days
- Express shipping: 2-3 business days
- Overnight shipping: 1 business day

If your package is delayed:
- Weather conditions may cause delays
- Check for delivery attempts at your address
- Contact the shipping carrier directly

We'll send email updates for any significant delays.`,
      tags: ['shipping', 'delivery', 'tracking'],
      status: 'published'
    },
    {
      title: 'Password reset instructions',
      body: `To reset your password:

1. Go to the login page
2. Click "Forgot Password?"
3. Enter your email address
4. Check your email for reset instructions
5. Click the reset link (valid for 24 hours)
6. Create a new strong password

Password requirements:
- At least 8 characters long
- Include uppercase and lowercase letters
- Include at least one number
- Include at least one special character

If you don't receive the reset email, check your spam folder or contact support.`,
      tags: ['account', 'password', 'security'],
      status: 'published'
    },
    {
      title: 'API rate limits and usage',
      body: `Our API has the following rate limits:

Free tier:
- 100 requests per hour
- 1,000 requests per day

Pro tier:
- 1,000 requests per hour
- 50,000 requests per day

Enterprise tier:
- Custom limits based on your plan

When you exceed rate limits:
- HTTP 429 status code returned
- Retry-After header indicates when to retry
- Use exponential backoff for retries

Best practices:
- Cache responses when possible
- Use webhooks instead of polling
- Implement proper error handling
- Monitor your usage in the dashboard`,
      tags: ['api', 'tech', 'limits'],
      status: 'published'
    },
    {
      title: 'Refund and cancellation policy',
      body: `Our refund policy:

Digital products:
- 30-day money-back guarantee
- No questions asked cancellation
- Refunds processed within 5-7 business days

Physical products:
- 60-day return window
- Items must be unused and in original packaging
- Return shipping costs apply

Subscription cancellations:
- Cancel anytime from your account settings
- No cancellation fees
- Access continues until end of billing period

To request a refund:
1. Contact our support team
2. Provide order number and reason
3. We'll process your request within 24 hours

Refunds are issued to the original payment method.`,
      tags: ['billing', 'refund', 'policy'],
      status: 'published'
    }
  ],

  tickets: [
    {
      title: 'Refund for double charge',
      description: 'I was charged twice for order #1234. My card shows two transactions of $49.99 each on the same day. Please refund one of the charges.',
      category: 'other'
    },
    {
      title: 'App shows 500 error on login',
      description: 'Every time I try to log into the mobile app, I get a 500 internal server error. Stack trace mentions auth module failure. This started happening yesterday.',
      category: 'other'
    },
    {
      title: 'Where is my package?',
      description: 'My shipment was supposed to arrive 5 days ago according to the tracking info. The last update shows it left the distribution center but no updates since then.',
      category: 'other'
    },
    {
      title: 'Cannot update payment method',
      description: 'When I try to update my credit card in billing settings, the page just spins and never saves. Tried different browsers with same result.',
      category: 'other'
    },
    {
      title: 'API returning wrong data format',
      description: 'The /api/users endpoint is returning XML instead of JSON since the update yesterday. Our integration is broken because of this change.',
      category: 'other'
    }
  ],

  config: {
    autoCloseEnabled: process.env.AUTO_CLOSE_ENABLED === 'true',
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.78,
    slaHours: 24
  }
};

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/helpdesk', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Article.deleteMany({});
    await Ticket.deleteMany({});
    await Config.deleteMany({});

    // Seed users
    console.log('Seeding users...');
    const users = await User.create(seedData.users);
    const userLookup = {};
    users.forEach(user => {
      userLookup[user.email] = user._id;
    });

    // Seed articles
    console.log('Seeding knowledge base articles...');
    await Article.create(seedData.articles);

    // Seed tickets
    console.log('Seeding tickets...');
    const ticketsWithUsers = seedData.tickets.map(ticket => ({
      ...ticket,
      createdBy: userLookup['user@helpdesk.local']
    }));
    await Ticket.create(ticketsWithUsers);

    // Seed config
    console.log('Seeding configuration...');
    await Config.create(seedData.config);

    console.log('✅ Database seeded successfully!');
    console.log('\nTest accounts created:');
    console.log('Admin: admin@helpdesk.local / admin123');
    console.log('Agent: agent@helpdesk.local / agent123');
    console.log('User: user@helpdesk.local / user123');
    console.log('\nKnowledge base articles:', seedData.articles.length);
    console.log('Sample tickets:', seedData.tickets.length);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase, seedData };