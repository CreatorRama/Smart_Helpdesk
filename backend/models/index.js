// models/index.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// User Schema
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'agent', 'user'],
    default: 'user'
  }
}, {
  timestamps: true
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

// Article (KB) Schema
const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  body: {
    type: String,
    required: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  }
}, {
  timestamps: true
});

articleSchema.index({ title: 'text', body: 'text', tags: 'text' });

// Ticket Schema
const ticketSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['billing', 'tech', 'shipping', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['open', 'triaged', 'waiting_human', 'resolved', 'closed'],
    default: 'open'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  agentSuggestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AgentSuggestion'
  },
  replies: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    isAgentGenerated: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Agent Suggestion Schema
const agentSuggestionSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  predictedCategory: {
    type: String,
    enum: ['billing', 'tech', 'shipping', 'other'],
    required: true
  },
  articleIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article'
  }],
  draftReply: {
    type: String,
    required: true
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    required: true
  },
  autoClosed: {
    type: Boolean,
    default: false
  },
  modelInfo: {
    provider: String,
    model: String,
    promptVersion: String,
    latencyMs: Number
  }
}, {
  timestamps: true
});

// Audit Log Schema
const auditLogSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ticket'
  },
  traceId: {
    type: String,
    required: true
  },
  actor: {
    type: String,
    enum: ['system', 'agent', 'user'],
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'TICKET_CREATED',
      'AGENT_CLASSIFIED', 
      'KB_RETRIEVED',
      'DRAFT_GENERATED',
      'AUTO_CLOSED',
      'ASSIGNED_TO_HUMAN',
      'REPLY_SENT',
      'TICKET_REOPENED',
      'TICKET_CLOSED',
      'SUGGESTION_EDITED'
    ]
  },
  meta: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

auditLogSchema.index({ ticketId: 1, timestamp: -1 });
auditLogSchema.index({ traceId: 1 });

// Config Schema
const configSchema = new mongoose.Schema({
  autoCloseEnabled: {
    type: Boolean,
    default: true
  },
  confidenceThreshold: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.78
  },
  slaHours: {
    type: Number,
    default: 24
  }
}, {
  timestamps: true
});

// Models
const User = mongoose.model('User', userSchema);
const Article = mongoose.model('Article', articleSchema);
const Ticket = mongoose.model('Ticket', ticketSchema);
const AgentSuggestion = mongoose.model('AgentSuggestion', agentSuggestionSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);
const Config = mongoose.model('Config', configSchema);

module.exports = {
  User,
  Article,
  Ticket,
  AgentSuggestion,
  AuditLog,
  Config
};