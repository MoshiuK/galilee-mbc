/**
 * AI-Powered IVR Service
 *
 * Uses SignalWire's AI capabilities for natural language call routing.
 * Instead of "press 1 for sales", callers say "I need to talk to sales"
 * and the AI routes them to the correct department/extension.
 */

const { LaML } = require('./laml');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const WEBHOOK_BASE = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000/api/webhooks/signalwire';

/**
 * Generate LaML for AI-powered IVR using SignalWire's <Gather> with speech input.
 * The caller speaks their intent, and we process it via the ai-gather webhook.
 */
function buildAiIvrResponse(tenant, callParams) {
  const laml = new LaML();

  const prompt = tenant.aiIvrPrompt ||
    `Thank you for calling ${tenant.brandName || tenant.name}. ` +
    `How can I direct your call? You can say the name of the person or department you'd like to reach.`;

  laml.gather({
    action: `${WEBHOOK_BASE}/ai-gather?tenantId=${tenant.id}`,
    input: 'speech dtmf',
    timeout: 5,
    numDigits: 1,
  });
  laml.gatherSay(prompt, { voice: 'Polly.Joanna' });
  laml.endGather();

  // Fallback if no input
  laml.say('We didn\'t catch that. Let me connect you to our main line.');
  laml.redirect(`${WEBHOOK_BASE}/ai-fallback?tenantId=${tenant.id}`);

  return laml.toXml();
}

/**
 * Process speech input from the AI IVR.
 * Maps spoken intent to extensions, departments, or ring groups.
 */
async function processAiGatherInput(tenantId, speechResult, digits) {
  const laml = new LaML();

  // If they pressed a digit, fall back to traditional IVR
  if (digits && !speechResult) {
    logger.info(`AI IVR: DTMF digit ${digits}, falling back to traditional IVR`);
    laml.redirect(`${WEBHOOK_BASE}/inbound-call?tenantId=${tenantId}&fallback=dtmf`);
    return laml.toXml();
  }

  if (!speechResult) {
    laml.say('I\'m sorry, I didn\'t understand. Let me transfer you to our operator.');
    laml.redirect(`${WEBHOOK_BASE}/ai-fallback?tenantId=${tenantId}`);
    return laml.toXml();
  }

  logger.info(`AI IVR: Speech input "${speechResult}" for tenant ${tenantId}`);
  const input = speechResult.toLowerCase().trim();

  // Load tenant's extensions and ring groups for matching
  const [extensions, ringGroups] = await Promise.all([
    prisma.extension.findMany({
      where: { tenantId, status: 'active' },
      select: { id: true, number: true, name: true },
    }),
    prisma.ringGroup.findMany({
      where: { tenantId, active: true },
      select: { id: true, name: true },
    }),
  ]);

  // Try to match against department/group names
  const departmentMatch = matchDepartment(input, ringGroups, extensions);

  if (departmentMatch) {
    laml.say(`Connecting you to ${departmentMatch.name} now.`);
    laml.pause(1);
    laml.redirect(
      `${WEBHOOK_BASE}/ai-route?tenantId=${tenantId}&type=${departmentMatch.type}&targetId=${departmentMatch.id}`
    );
    return laml.toXml();
  }

  // Try to match against a person's name
  const personMatch = matchPerson(input, extensions);
  if (personMatch) {
    laml.say(`Connecting you to ${personMatch.name} now.`);
    laml.pause(1);
    laml.redirect(
      `${WEBHOOK_BASE}/ai-route?tenantId=${tenantId}&type=extension&targetId=${personMatch.id}`
    );
    return laml.toXml();
  }

  // No match found
  laml.say('I wasn\'t able to find that department or person. Let me connect you to our operator.');
  laml.redirect(`${WEBHOOK_BASE}/ai-fallback?tenantId=${tenantId}`);
  return laml.toXml();
}

/**
 * Match spoken input to a department (ring group) or common keywords.
 */
function matchDepartment(input, ringGroups, extensions) {
  // Common department keyword mappings
  const keywords = {
    sales: ['sales', 'buy', 'purchase', 'pricing', 'quote', 'order', 'new customer'],
    support: ['support', 'help', 'issue', 'problem', 'technical', 'tech support', 'troubleshoot', 'fix'],
    billing: ['billing', 'payment', 'invoice', 'charge', 'refund', 'account', 'balance'],
    accounting: ['accounting', 'finance', 'accounts payable', 'accounts receivable'],
    hr: ['human resources', 'hr', 'employment', 'hiring', 'jobs', 'careers'],
    reception: ['reception', 'front desk', 'operator', 'receptionist', 'main line', 'someone'],
  };

  // Check ring groups first
  for (const group of ringGroups) {
    const groupName = group.name.toLowerCase();
    if (input.includes(groupName)) {
      return { type: 'ring_group', id: group.id, name: group.name };
    }
    // Check keyword synonyms
    for (const [dept, syns] of Object.entries(keywords)) {
      if (groupName.includes(dept) && syns.some((s) => input.includes(s))) {
        return { type: 'ring_group', id: group.id, name: group.name };
      }
    }
  }

  // Check extensions with department-like names
  for (const ext of extensions) {
    const extName = ext.name.toLowerCase();
    for (const [dept, syns] of Object.entries(keywords)) {
      if (extName.includes(dept) && syns.some((s) => input.includes(s))) {
        return { type: 'extension', id: ext.id, name: ext.name };
      }
    }
  }

  return null;
}

/**
 * Match spoken input to a person's name.
 */
function matchPerson(input, extensions) {
  for (const ext of extensions) {
    const nameParts = ext.name.toLowerCase().split(/\s+/);
    // Match full name or last name
    if (input.includes(ext.name.toLowerCase())) {
      return ext;
    }
    // Match last name (if 2+ parts)
    if (nameParts.length >= 2 && input.includes(nameParts[nameParts.length - 1])) {
      return ext;
    }
    // Match first name
    if (nameParts.length >= 1 && nameParts[0].length > 2 && input.includes(nameParts[0])) {
      return ext;
    }
  }
  return null;
}

module.exports = { buildAiIvrResponse, processAiGatherInput };
