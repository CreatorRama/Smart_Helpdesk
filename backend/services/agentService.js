// services/agentService.js
const { LLMProvider, KBSearchService } = require('./llmService');
const { Ticket, AgentSuggestion, AuditLog, Config, User } = require('../models');
const crypto = require('crypto');

class AgentService {
  constructor() {
    this.llmProvider = new LLMProvider();
    this.kbSearch = new KBSearchService();
  }

  async triageTicket(ticketId, traceId = null) {
    const trace = traceId || crypto.randomUUID();
    let ticket = null;

    try {
      // Get ticket
      ticket = await Ticket.findById(ticketId).populate('createdBy');
      if (!ticket) {
        throw new Error('Ticket not found');
      }

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId: trace,
        message: 'Starting ticket triage',
        ticketId: ticket._id,
        title: ticket.title
      }));

      // Step 1: Plan
      const plan = this._createTriagePlan(ticket);
      await this._logAudit(ticket._id, trace, 'system', 'TRIAGE_STARTED', { plan });

      // Step 2: Classify
      const classification = await this._classifyTicket(ticket, trace);
      
      // Step 3: Retrieve KB articles
      const articles = await this._retrieveKBArticles(ticket, classification, trace);
      
      // Step 4: Draft reply
      const draft = await this._draftReply(ticket, articles, trace);
      
      // Step 5: Make decision
      const decision = await this._makeTriageDecision(ticket, classification, draft, trace);
      
      // Step 6: Execute decision
      await this._executeDecision(ticket, decision, trace);

      return {
        success: true,
        traceId: trace,
        ticketId: ticket._id,
        decision: decision.action,
        confidence: classification.confidence
      };

    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        traceId: trace,
        message: 'Triage failed',
        ticketId: ticket?._id,
        error: error.message
      }));

      if (ticket) {
        await this._logAudit(ticket._id, trace, 'system', 'TRIAGE_FAILED', { error: error.message });
      }

      throw error;
    }
  }

  _createTriagePlan(ticket) {
    return {
      steps: [
        'classify_category',
        'retrieve_kb_articles',
        'draft_reply',
        'compute_confidence',
        'make_decision'
      ],
      ticketInfo: {
        id: ticket._id,
        title: ticket.title,
        category: ticket.category,
        status: ticket.status
      }
    };
  }

  async _classifyTicket(ticket, traceId) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      traceId,
      message: 'Starting classification',
      ticketId: ticket._id
    }));

    const ticketText = `${ticket.title}\n${ticket.description}`;
    const classification = await this.llmProvider.classify(ticketText);

    // Update ticket category if confidence is high enough
    if (classification.confidence > 0.7) {
      ticket.category = classification.predictedCategory;
      await ticket.save();
    }

    await this._logAudit(ticket._id, traceId, 'system', 'AGENT_CLASSIFIED', {
      originalCategory: ticket.category,
      predictedCategory: classification.predictedCategory,
      confidence: classification.confidence,
      modelInfo: classification.modelInfo
    });

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      traceId,
      message: 'Classification completed',
      ticketId: ticket._id,
      predictedCategory: classification.predictedCategory,
      confidence: classification.confidence
    }));

    return classification;
  }

  async _retrieveKBArticles(ticket, classification, traceId) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      traceId,
      message: 'Retrieving KB articles',
      ticketId: ticket._id
    }));

    const searchQuery = `${ticket.title} ${ticket.description}`.substring(0, 200);
    const articles = await this.kbSearch.search(
      searchQuery, 
      classification.predictedCategory,
      3
    );

    await this._logAudit(ticket._id, traceId, 'system', 'KB_RETRIEVED', {
      searchQuery: searchQuery.substring(0, 100),
      articlesFound: articles.length,
      articleIds: articles.map(a => a.id),
      articleTitles: articles.map(a => a.title)
    });

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      traceId,
      message: 'KB retrieval completed',
      ticketId: ticket._id,
      articlesFound: articles.length
    }));

    return articles;
  }

  async _draftReply(ticket, articles, traceId) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      traceId,
      message: 'Drafting reply',
      ticketId: ticket._id
    }));

    const ticketText = `${ticket.title}\n${ticket.description}`;
    const draft = await this.llmProvider.draft(ticketText, articles);

    await this._logAudit(ticket._id, traceId, 'system', 'DRAFT_GENERATED', {
      draftLength: draft.draftReply.length,
      citationsCount: draft.citations.length,
      modelInfo: draft.modelInfo
    });

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      traceId,
      message: 'Draft generated',
      ticketId: ticket._id,
      replyLength: draft.draftReply.length
    }));

    return draft;
  }

  async _makeTriageDecision(ticket, classification, draft, traceId) {
    const config = await Config.findOne() || {
      autoCloseEnabled: process.env.AUTO_CLOSE_ENABLED === 'true',
      confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD) || 0.78
    };

    const shouldAutoClose = config.autoCloseEnabled && 
                           classification.confidence >= config.confidenceThreshold;

    const decision = {
      action: shouldAutoClose ? 'auto_close' : 'assign_human',
      confidence: classification.confidence,
      threshold: config.confidenceThreshold,
      autoCloseEnabled: config.autoCloseEnabled,
      reasoning: shouldAutoClose 
        ? 'High confidence classification, auto-closing with AI response'
        : 'Low confidence or auto-close disabled, assigning to human'
    };

    await this._logAudit(ticket._id, traceId, 'system', 'DECISION_MADE', decision);

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      traceId,
      message: 'Triage decision made',
      ticketId: ticket._id,
      action: decision.action,
      confidence: classification.confidence
    }));

    return decision;
  }

  async _executeDecision(ticket, decision, traceId) {
    const classification = await this._getClassificationFromLogs(ticket._id, traceId);
    const articles = await this._getArticlesFromLogs(ticket._id, traceId);
    const draft = await this._getDraftFromLogs(ticket._id, traceId);

    // Create agent suggestion
    const suggestion = new AgentSuggestion({
      ticketId: ticket._id,
      predictedCategory: classification.predictedCategory,
      articleIds: articles.map(a => a.id),
      draftReply: draft.draftReply,
      confidence: classification.confidence,
      autoClosed: decision.action === 'auto_close',
      modelInfo: classification.modelInfo
    });

    await suggestion.save();
    ticket.agentSuggestionId = suggestion._id;

    if (decision.action === 'auto_close') {
      // Auto-close with AI reply
      ticket.status = 'resolved';
      ticket.replies.push({
        author: await this._getSystemUserId(),
        content: draft.draftReply,
        isAgentGenerated: true,
        timestamp: new Date()
      });

      await this._logAudit(ticket._id, traceId, 'system', 'AUTO_CLOSED', {
        suggestionId: suggestion._id,
        confidence: classification.confidence
      });

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId,
        message: 'Ticket auto-closed',
        ticketId: ticket._id
      }));

    } else {
      // Assign to human
      ticket.status = 'waiting_human';
      
      // Find an available agent
      const agent = await User.findOne({ role: 'agent' });
      if (agent) {
        ticket.assignee = agent._id;
      }

      await this._logAudit(ticket._id, traceId, 'system', 'ASSIGNED_TO_HUMAN', {
        suggestionId: suggestion._id,
        assigneeId: agent?._id,
        confidence: classification.confidence
      });

      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        traceId,
        message: 'Ticket assigned to human',
        ticketId: ticket._id,
        assigneeId: agent?._id
      }));
    }

    await ticket.save();
  }

  async _getClassificationFromLogs(ticketId, traceId) {
    const log = await AuditLog.findOne({
      ticketId,
      traceId,
      action: 'AGENT_CLASSIFIED'
    });
    return log ? log.meta : null;
  }

  async _getArticlesFromLogs(ticketId, traceId) {
    const log = await AuditLog.findOne({
      ticketId,
      traceId,
      action: 'KB_RETRIEVED'
    });
    if (!log || !log.meta.articleIds) return [];
    
    const { Article } = require('../models');
    const articles = await Article.find({ _id: { $in: log.meta.articleIds } });
    return articles.map(a => ({ id: a._id, title: a.title, body: a.body }));
  }

  async _getDraftFromLogs(ticketId, traceId) {
    // Since we don't store the full draft in logs for security, 
    // we'll need to regenerate it or store it temporarily
    // For now, we'll create a simple response
    const log = await AuditLog.findOne({
      ticketId,
      traceId,
      action: 'DRAFT_GENERATED'
    });
    
    if (log) {
      // Try to get the latest suggestion for this ticket
      const suggestion = await AgentSuggestion.findOne({ ticketId }).sort({ createdAt: -1 });
      if (suggestion) {
        return { draftReply: suggestion.draftReply };
      }
    }
    
    return { draftReply: "Thank you for your inquiry. Our team is reviewing your request." };
  }

  async _getSystemUserId() {
    // Get or create system user for agent replies
    let systemUser = await User.findOne({ email: 'system@helpdesk.local' });
    
    if (!systemUser) {
      systemUser = new User({
        name: 'AI Assistant',
        email: 'system@helpdesk.local',
        passwordHash: crypto.randomBytes(32).toString('hex'),
        role: 'agent'
      });
      await systemUser.save();
    }
    
    return systemUser._id;
  }

  async _logAudit(ticketId, traceId, actor, action, meta = {}) {
    const auditLog = new AuditLog({
      ticketId,
      traceId,
      actor,
      action,
      meta,
      timestamp: new Date()
    });

    await auditLog.save();
  }

  // Retry mechanism for failed triages
  async retryTriage(ticketId, maxRetries = 3) {
    let attempt = 0;
    let lastError;

    while (attempt < maxRetries) {
      try {
        attempt++;
        const traceId = crypto.randomUUID();
        
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          traceId,
          message: 'Retrying triage',
          ticketId,
          attempt,
          maxRetries
        }));

        return await this.triageTicket(ticketId, traceId);
        
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Triage failed after ${maxRetries} attempts: ${lastError.message}`);
  }
}

module.exports = AgentService;