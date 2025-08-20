// scripts/mongo-init.js
// MongoDB initialization script for Docker
db = db.getSiblingDB('smart-helpdesk');

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

