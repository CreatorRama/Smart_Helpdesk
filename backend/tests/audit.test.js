const { AuditLog } = require('../models');

describe('Audit Logging', () => {
  test('should create audit log entry', async () => {
    const logData = {
      traceId: 'test-trace-123',
      actor: 'system',
      action: 'TICKET_CREATED',
      meta: { test: 'data' }
    };

    const log = new AuditLog(logData);
    await log.save();

    expect(log.traceId).toBe(logData.traceId);
    expect(log.actor).toBe(logData.actor);
    expect(log.action).toBe(logData.action);
    expect(log.timestamp).toBeDefined();
  });

  test('should query logs by trace ID', async () => {
    const traceId = 'test-trace-456';
    
    await AuditLog.create([
      {
        traceId,
        actor: 'system', 
        action: 'TICKET_CREATED',
        meta: {}
      },
      {
        traceId,
        actor: 'system',
        action: 'AGENT_CLASSIFIED', 
        meta: {}
      }
    ]);

    const logs = await AuditLog.find({ traceId }).sort({ timestamp: 1 });
    
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe('TICKET_CREATED');
    expect(logs[1].action).toBe('AGENT_CLASSIFIED');
  });
});