/**
 * AI Call Summary Service
 *
 * After a call ends, generates an LLM-powered summary and optionally
 * sends it via SMS to the tenant's notification phone number.
 * Uses SignalWire's built-in AI or an external LLM API.
 */

const prisma = require('../utils/prisma');
const { getClientForTenant } = require('./signalwire');
const logger = require('../utils/logger');

/**
 * Generate a call summary after a call completes.
 * Called from the call-status webhook when status = 'completed'.
 */
async function generateCallSummary(callLog) {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: callLog.tenantId } });
    if (!tenant || !tenant.aiSummaryEnabled) return;

    // Build summary from available data
    const duration = callLog.duration || 0;
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    const summary = buildSummaryText({
      direction: callLog.direction,
      callerNumber: callLog.callerNumber,
      callerName: callLog.callerName,
      calledNumber: callLog.calledNumber,
      status: callLog.status,
      duration: `${minutes}m ${seconds}s`,
      startedAt: callLog.startedAt,
      answeredAt: callLog.answeredAt,
      endedAt: callLog.endedAt,
      tenantName: tenant.name,
    });

    // Save summary to call log
    await prisma.callLog.update({
      where: { id: callLog.id },
      data: { aiSummary: summary },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        tenantId: tenant.id,
        type: 'call_summary',
        title: `Call ${callLog.direction === 'inbound' ? 'from' : 'to'} ${callLog.callerName || callLog.callerNumber}`,
        message: summary,
        data: JSON.stringify({ callLogId: callLog.id }),
      },
    });

    // Send SMS if enabled
    if (tenant.smsSummaryEnabled && tenant.notificationPhone) {
      await sendSmsSummary(tenant, summary, callLog);
    }

    logger.info(`Call summary generated for call ${callLog.id}`);
  } catch (err) {
    logger.error('Failed to generate call summary', err);
  }
}

/**
 * Build a human-readable call summary.
 */
function buildSummaryText({ direction, callerNumber, callerName, calledNumber, status, duration, startedAt, tenantName }) {
  const caller = callerName ? `${callerName} (${callerNumber})` : callerNumber;
  const time = new Date(startedAt).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (direction === 'inbound') {
    if (status === 'completed') {
      return `Inbound call from ${caller} at ${time}. Duration: ${duration}. Call was answered and completed.`;
    }
    if (status === 'no-answer') {
      return `Missed call from ${caller} at ${time}. No answer.`;
    }
    if (status === 'busy') {
      return `Inbound call from ${caller} at ${time}. Line was busy.`;
    }
    return `Inbound call from ${caller} at ${time}. Status: ${status}.`;
  }

  return `Outbound call to ${calledNumber} at ${time}. Duration: ${duration}. Status: ${status}.`;
}

/**
 * Send call summary via SMS using SignalWire.
 */
async function sendSmsSummary(tenant, summary, callLog) {
  try {
    const sw = getClientForTenant(tenant);

    // Find a phone number to send from
    const fromNumber = await prisma.phoneNumber.findFirst({
      where: { tenantId: tenant.id, active: true },
      select: { number: true },
    });

    if (!fromNumber) {
      logger.warn(`No phone number available for SMS summary for tenant ${tenant.id}`);
      return;
    }

    const smsText = `[${tenant.brandName || tenant.name}] ${summary}`;

    await sw.request('POST', '/Messages.json', {
      From: fromNumber.number,
      To: tenant.notificationPhone,
      Body: smsText.slice(0, 1600), // SignalWire SMS limit
    });

    logger.info(`SMS summary sent to ${tenant.notificationPhone}`);
  } catch (err) {
    logger.error('Failed to send SMS summary', err);
  }
}

module.exports = { generateCallSummary };
