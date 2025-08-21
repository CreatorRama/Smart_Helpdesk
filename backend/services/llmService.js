// services/llmService.js
const axios = require('axios');

class LLMProvider {
  constructor() {
    this.stubMode = process.env.STUB_MODE === 'true';
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.baseURL = 'https://api.deepseek.com/v1';
    this.promptVersion = '1.0';
  }

  async classify(text) {
    const startTime = Date.now();
    console.log(this.stubMode);
    
    if (this.stubMode) {
      return this._stubClassify(text, startTime);
    }
    
    try {
      const prompt = this._getClassificationPrompt(text);
      
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a support ticket classifier. Respond only with valid JSON matching the required schema.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.1
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const content = response.data.choices[0].message.content.trim();
      const result = JSON.parse(content);
      
      const latencyMs = Date.now() - startTime;
      
      return {
        ...result,
        modelInfo: {
          provider: 'deepseek',
          model: 'deepseek-chat',
          promptVersion: this.promptVersion,
          latencyMs
        }
      };
      
    } catch (error) {
      console.error('LLM Classification Error:', error.message);
      // Fallback to stub mode on error
      return this._stubClassify(text, startTime);
    }
  }

  async draft(ticketText, articles) {
    const startTime = Date.now();
    
    if (this.stubMode) {
      return this._stubDraft(ticketText, articles, startTime);
    }
    
    try {
      const prompt = this._getDraftPrompt(ticketText, articles);
      
      const response = await axios.post(`${this.baseURL}/chat/completions`, {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful support agent. Draft professional, helpful responses to support tickets using the provided knowledge base articles. Always include numbered citations. Respond only with valid JSON matching the required schema.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const content = response.data.choices[0].message.content.trim();
      const result = JSON.parse(content);
      
      const latencyMs = Date.now() - startTime;
      
      return {
        ...result,
        modelInfo: {
          provider: 'deepseek',
          model: 'deepseek-chat',
          promptVersion: this.promptVersion,
          latencyMs
        }
      };
      
    } catch (error) {
      console.error('LLM Draft Error:', error.message);
      // Fallback to stub mode on error
      return this._stubDraft(ticketText, articles, startTime);
    }
  }

  _getClassificationPrompt(text) {
    return `Classify this support ticket into one of these categories: billing, tech, shipping, other.

Ticket: "${text}"

Classification rules:
- billing: refunds, payments, invoices, charges, pricing
- tech: errors, bugs, login issues, technical problems, API issues
- shipping: delivery, tracking, packages, orders, shipment
- other: general inquiries that don't fit above categories

Respond with JSON only:
{
  "predictedCategory": "billing|tech|shipping|other",
  "confidence": 0.0-1.0
}`;
  }

  _getDraftPrompt(ticketText, articles) {
    const articlesText = articles.map((article, index) => 
      `[${index + 1}] ${article.title}\n${article.body.substring(0, 500)}...`
    ).join('\n\n');

    return `Draft a helpful response to this support ticket using the provided knowledge base articles.

Ticket: "${ticketText}"

Available Knowledge Base Articles:
${articlesText}

Requirements:
- Be professional and helpful
- Reference relevant articles with numbered citations like [1], [2]
- Keep response concise but complete
- If no articles are directly relevant, provide a general helpful response

Respond with JSON only:
{
  "draftReply": "your response here with [1] citations",
  "citations": ["Article Title 1", "Article Title 2"]
}`;
  }

  _stubClassify(text, startTime) {
    const lowerText = text.toLowerCase();
    let predictedCategory = 'other';
    let confidence = 0.5;

    // Rule-based classification
    const billingWords = ['refund', 'invoice', 'payment', 'charge', 'billing', 'money', 'cost', 'price'];
    const techWords = ['error', 'bug', 'login', 'password', 'api', 'code', '500', '404', 'crash', 'broken'];
    const shippingWords = ['delivery', 'shipment', 'tracking', 'package', 'order', 'shipping', 'delivered'];

    const billingMatches = billingWords.filter(word => lowerText.includes(word)).length;
    const techMatches = techWords.filter(word => lowerText.includes(word)).length;
    const shippingMatches = shippingWords.filter(word => lowerText.includes(word)).length;

    const maxMatches = Math.max(billingMatches, techMatches, shippingMatches);

    if (maxMatches > 0) {
      if (billingMatches === maxMatches) {
        predictedCategory = 'billing';
        confidence = Math.min(0.9, 0.6 + (billingMatches * 0.1));
      } else if (techMatches === maxMatches) {
        predictedCategory = 'tech';
        confidence = Math.min(0.9, 0.6 + (techMatches * 0.1));
      } else if (shippingMatches === maxMatches) {
        predictedCategory = 'shipping';
        confidence = Math.min(0.9, 0.6 + (shippingMatches * 0.1));
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      predictedCategory,
      confidence,
      modelInfo: {
        provider: 'stub',
        model: 'rule-based',
        promptVersion: this.promptVersion,
        latencyMs
      }
    };
  }

  _stubDraft(ticketText, articles, startTime) {
    let draftReply = "Thank you for contacting our support team. ";
    const citations = [];

    if (articles.length > 0) {
      draftReply += "Based on our knowledge base, here's how we can help:\n\n";
      
      articles.forEach((article, index) => {
        if (index < 2) { // Use max 2 articles
          draftReply += `${article.title} [${index + 1}]\n`;
          citations.push(article.title);
        }
      });

      draftReply += "\nPlease review the information above. If you need additional assistance, our support team will be happy to help further.";
    } else {
      draftReply += "We've received your request and our support team will review it shortly. We typically respond within 24 hours.";
    }

    const latencyMs = Date.now() - startTime;

    return {
      draftReply,
      citations,
      modelInfo: {
        provider: 'stub',
        model: 'template-based',
        promptVersion: this.promptVersion,
        latencyMs
      }
    };
  }
}

// KB Search Service
class KBSearchService {
  constructor() {
    // Require models here to avoid circular dependency
    this.getArticleModel = () => require('../models').Article;
  }

  async search(query, category = null, limit = 3) {
    try {
      const Article = this.getArticleModel();
      let searchFilter = { status: 'published' };
      
      // Add category filter if provided
      if (category && category !== 'other') {
        searchFilter.tags = { $in: [category] };
      }

      let articles;
      
      if (query) {
        // Text search with scoring
        articles = await Article.find({
          ...searchFilter,
          $text: { $search: query }
        }, {
          score: { $meta: 'textScore' }
        })
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit);
        
        // If no text search results, try tag-based search
        if (articles.length === 0) {
          const queryWords = query.toLowerCase().split(' ');
          articles = await Article.find({
            ...searchFilter,
            $or: [
              { tags: { $in: queryWords } },
              { title: { $regex: queryWords.join('|'), $options: 'i' } }
            ]
          }).limit(limit);
        }
      } else {
        // Category-based search
        articles = await Article.find(searchFilter)
          .sort({ updatedAt: -1 })
          .limit(limit);
      }

      return articles.map(article => ({
        id: article._id,
        title: article.title,
        body: article.body,
        tags: article.tags,
        score: article.score || 0
      }));

    } catch (error) {
      console.error('KB Search Error:', error.message);
      return [];
    }
  }
}

module.exports = {
  LLMProvider,
  KBSearchService
};