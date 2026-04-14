/**
 * SWAIG — SignalWire AI Gateway Integration
 *
 * Enables SignalWire's AI Agent to handle calls with natural conversation.
 * The AI Agent can understand caller intent and execute transfer functions.
 *
 * SWAIG functions are registered with SignalWire's Call Flow Builder,
 * and SignalWire calls our webhook when the AI decides to transfer.
 */

const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

/**
 * Return the list of SWAIG functions available for a tenant.
 * SignalWire fetches this via GET /api/webhooks/signalwire/swaig-functions
 */
async function getSwaigFunctions(tenantId) {
  const WEBHOOK_BASE = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000/api/webhooks/signalwire';

  // Load tenant's departments (ring groups + key extensions)
  const [ringGroups, extensions] = await Promise.all([
    prisma.ringGroup.findMany({
      where: { tenantId, active: true },
      select: { name: true },
    }),
    prisma.extension.findMany({
      where: { tenantId, status: 'active' },
      select: { name: true, number: true },
    }),
  ]);

  const departments = ringGroups.map((g) => g.name);
  const people = extensions.map((e) => `${e.name} (ext ${e.number})`);

  return [
    {
      function: 'transfer',
      web_hook_url: `${WEBHOOK_BASE}/swaig-transfer?tenantId=${tenantId}`,
      purpose: 'Transfer the call to a specific department or person',
      argument: {
        type: 'object',
        properties: {
          destination: {
            type: 'string',
            description: `Department or person name to transfer to. Available departments: ${departments.join(', ') || 'sales, support'}. Available people: ${people.join(', ') || 'none configured'}.`,
          },
        },
        required: ['destination'],
      },
    },
    {
      function: 'check_hours',
      web_hook_url: `${WEBHOOK_BASE}/swaig-check-hours?tenantId=${tenantId}`,
      purpose: 'Check if the business is currently open',
      argument: {
        type: 'object',
        properties: {},
      },
    },
    {
      function: 'take_message',
      web_hook_url: `${WEBHOOK_BASE}/swaig-take-message?tenantId=${tenantId}`,
      purpose: 'Take a message from the caller when no one is available',
      argument: {
        type: 'object',
        properties: {
          caller_name: { type: 'string', description: 'Name of the caller' },
          callback_number: { type: 'string', description: 'Number to call back' },
          message: { type: 'string', description: 'The message from the caller' },
          department: { type: 'string', description: 'Who the message is for' },
        },
        required: ['message'],
      },
    },
  ];
}

/**
 * Handle SWAIG transfer request from SignalWire AI Agent.
 * The AI decides the caller wants to reach a specific department/person,
 * and we return the routing instruction.
 */
async function handleSwaigTransfer(tenantId, destination) {
  logger.info(`SWAIG transfer: tenant=${tenantId}, destination="${destination}"`);

  const dest = destination.toLowerCase().trim();

  // Try ring groups
  const ringGroups = await prisma.ringGroup.findMany({
    where: { tenantId, active: true },
  });

  for (const rg of ringGroups) {
    if (dest.includes(rg.name.toLowerCase()) || rg.name.toLowerCase().includes(dest)) {
      return {
        action: 'transfer',
        type: 'ring_group',
        targetId: rg.id,
        name: rg.name,
      };
    }
  }

  // Try extensions by name
  const extensions = await prisma.extension.findMany({
    where: { tenantId, status: 'active' },
  });

  for (const ext of extensions) {
    if (dest.includes(ext.name.toLowerCase()) || ext.name.toLowerCase().includes(dest)) {
      return {
        action: 'transfer',
        type: 'extension',
        targetId: ext.id,
        name: ext.name,
      };
    }
    // Match by extension number
    if (dest.includes(ext.number)) {
      return {
        action: 'transfer',
        type: 'extension',
        targetId: ext.id,
        name: ext.name,
      };
    }
  }

  // Common department keyword fallback
  const deptKeywords = {
    sales: ['sales', 'buy', 'purchase', 'pricing'],
    support: ['support', 'help', 'technical', 'tech'],
    billing: ['billing', 'payment', 'invoice', 'account'],
  };

  for (const rg of ringGroups) {
    const rgName = rg.name.toLowerCase();
    for (const [dept, keywords] of Object.entries(deptKeywords)) {
      if (rgName.includes(dept) && keywords.some((k) => dest.includes(k))) {
        return { action: 'transfer', type: 'ring_group', targetId: rg.id, name: rg.name };
      }
    }
  }

  return { action: 'not_found', message: `Could not find department or person: ${destination}` };
}

/**
 * Handle SWAIG check_hours request.
 */
async function handleSwaigCheckHours(tenantId) {
  const timeConditions = await prisma.timeCondition.findMany({
    where: { tenantId, active: true },
    include: { schedules: true },
  });

  if (timeConditions.length === 0) {
    return { open: true, message: 'No business hours configured — assumed always open.' };
  }

  const tc = timeConditions[0];
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tc.timezone,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayStr = parts.find((p) => p.type === 'weekday')?.value;
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  const currentDay = dayMap[dayStr];
  const currentTime = `${hour}:${minute}`;

  const isOpen = tc.schedules.some(
    (s) => s.dayOfWeek === currentDay && currentTime >= s.startTime && currentTime <= s.endTime
  );

  return {
    open: isOpen,
    message: isOpen
      ? 'The business is currently open.'
      : 'The business is currently closed.',
    timezone: tc.timezone,
  };
}

/**
 * Handle SWAIG take_message — store a message notification.
 */
async function handleSwaigTakeMessage(tenantId, { caller_name, callback_number, message, department }) {
  await prisma.notification.create({
    data: {
      tenantId,
      type: 'message',
      title: `Message from ${caller_name || 'Unknown caller'}`,
      message: `${message}${department ? ` (For: ${department})` : ''}${callback_number ? ` | Callback: ${callback_number}` : ''}`,
      data: JSON.stringify({ caller_name, callback_number, message, department }),
    },
  });

  return { success: true, message: 'Message has been recorded. Someone will get back to you.' };
}

module.exports = {
  getSwaigFunctions,
  handleSwaigTransfer,
  handleSwaigCheckHours,
  handleSwaigTakeMessage,
};
