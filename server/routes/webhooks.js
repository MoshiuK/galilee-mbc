/**
 * SignalWire Webhook Handlers
 *
 * These endpoints are called by SignalWire when calls come in, digits are
 * pressed, calls end, recordings complete, etc. They return LaML (XML)
 * responses that tell SignalWire what to do next.
 *
 * NO AUTHENTICATION — SignalWire calls these directly.
 * Content-Type returned is application/xml.
 */

const router = require('express').Router();
const prisma = require('../utils/prisma');
const { CallRouter } = require('../services/callRouter');
const { LaML } = require('../services/laml');
const { buildAiIvrResponse, processAiGatherInput } = require('../services/aiIvr');
const { getSwaigFunctions, handleSwaigTransfer, handleSwaigCheckHours, handleSwaigTakeMessage } = require('../services/swaig');
const { generateCallSummary } = require('../services/callSummary');
const logger = require('../utils/logger');

/**
 * Helper: send LaML XML response.
 */
function sendLaml(res, xml) {
  res.set('Content-Type', 'application/xml');
  res.send(xml);
}

/**
 * Helper: safe error response (always valid LaML so caller hears something).
 */
function sendError(res, message = 'We are sorry, an error occurred. Please try again later.') {
  const laml = new LaML();
  laml.say(message).hangup();
  sendLaml(res, laml.toXml());
}

// ============================================================================
// POST /api/webhooks/signalwire/inbound-call
// Main entry point — SignalWire calls this when a phone number receives a call.
// ============================================================================
router.post('/inbound-call', async (req, res) => {
  try {
    const { CallSid, From, To, CallerName, Direction } = req.body;
    logger.info(`Inbound call: ${From} -> ${To} (CallSid: ${CallSid})`);

    // Find the phone number and tenant
    const phoneNumber = await prisma.phoneNumber.findUnique({
      where: { number: To },
      include: { tenant: true },
    });

    if (!phoneNumber || !phoneNumber.active || !phoneNumber.tenant.active) {
      logger.warn(`No active phone number found for: ${To}`);
      return sendError(res, 'The number you have called is not in service.');
    }

    // Create call log entry
    await prisma.callLog.create({
      data: {
        tenantId: phoneNumber.tenantId,
        phoneNumberId: phoneNumber.id,
        swCallId: CallSid,
        direction: 'inbound',
        callerNumber: From,
        callerName: CallerName || null,
        calledNumber: To,
        status: 'ringing',
        startedAt: new Date(),
      },
    }).catch((err) => {
      // Don't fail the call if CDR write fails
      logger.error('Failed to create call log', err);
    });

    // Route the call
    const router = new CallRouter(phoneNumber.tenantId);
    const xml = await router.routeToDestination(
      phoneNumber.routeType,
      phoneNumber.routeDestination,
      req.body
    );

    sendLaml(res, xml);
  } catch (err) {
    logger.error('Webhook inbound-call error', err);
    sendError(res);
  }
});

// ============================================================================
// POST /api/webhooks/signalwire/ivr-play
// Replay an IVR menu (on retry or initial play).
// ============================================================================
router.post('/ivr-play', async (req, res) => {
  try {
    const { tenantId, menuId, retry } = req.query;
    const callRouter = new CallRouter(tenantId);
    const xml = await callRouter.routeToIvr(menuId, req.body);
    sendLaml(res, xml);
  } catch (err) {
    logger.error('Webhook ivr-play error', err);
    sendError(res);
  }
});

// ============================================================================
// POST /api/webhooks/signalwire/ivr-input
// Called when a caller presses a digit in an IVR menu.
// ============================================================================
router.post('/ivr-input', async (req, res) => {
  try {
    const { tenantId, menuId, timeout } = req.query;
    const { Digits } = req.body;

    logger.info(`IVR input: menu=${menuId}, digit=${Digits}, timeout=${timeout}`);

    const callRouter = new CallRouter(tenantId);

    // If timeout (no input), treat as retry
    if (timeout === 'true' || !Digits) {
      const xml = await callRouter.processIvrInput(menuId, null, 0);
      return sendLaml(res, xml);
    }

    const xml = await callRouter.processIvrInput(menuId, Digits);
    sendLaml(res, xml);
  } catch (err) {
    logger.error('Webhook ivr-input error', err);
    sendError(res);
  }
});

// ============================================================================
// POST /api/webhooks/signalwire/dial-result
// Called after a Dial attempt completes (answered, no-answer, busy, failed).
// ============================================================================
router.post('/dial-result', async (req, res) => {
  try {
    const { tenantId, extId } = req.query;
    const { DialCallStatus, CallSid, DialCallDuration } = req.body;

    logger.info(`Dial result: ext=${extId}, status=${DialCallStatus}`);

    // Update call log
    if (CallSid) {
      const updateData = { status: DialCallStatus === 'completed' ? 'completed' : DialCallStatus };
      if (DialCallStatus === 'completed') {
        updateData.answeredAt = new Date();
        updateData.endedAt = new Date();
        updateData.duration = parseInt(DialCallDuration) || 0;
        updateData.inboundExtId = extId;
      }
      await prisma.callLog.updateMany({
        where: { swCallId: CallSid },
        data: updateData,
      }).catch((err) => logger.error('Failed to update call log', err));
    }

    // If answered, nothing more to do
    if (DialCallStatus === 'completed') {
      const laml = new LaML();
      laml.hangup();
      return sendLaml(res, laml.toXml());
    }

    // Not answered — check for voicemail or forwarding
    const ext = await prisma.extension.findUnique({ where: { id: extId } });

    if (!ext) {
      return sendError(res, 'Extension not found.');
    }

    // Try forwarding first
    if (ext.forwardEnabled && ext.forwardNumber && DialCallStatus !== 'busy') {
      const laml = new LaML();
      const WEBHOOK_BASE = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000/api/webhooks/signalwire';
      laml.dial(ext.forwardNumber, {
        action: `${WEBHOOK_BASE}/forward-result?tenantId=${tenantId}&extId=${extId}`,
        timeout: 25,
      });
      return sendLaml(res, laml.toXml());
    }

    // Fall back to voicemail
    if (ext.voicemailEnabled) {
      const callRouter = new CallRouter(tenantId);
      const xml = await callRouter.routeToVoicemail(extId, req.body);
      return sendLaml(res, xml);
    }

    // Nothing else to do
    const laml = new LaML();
    laml.say('The person you are trying to reach is unavailable. Goodbye.').hangup();
    sendLaml(res, laml.toXml());
  } catch (err) {
    logger.error('Webhook dial-result error', err);
    sendError(res);
  }
});

// ============================================================================
// POST /api/webhooks/signalwire/forward-result
// Called after a call forward attempt completes.
// ============================================================================
router.post('/forward-result', async (req, res) => {
  try {
    const { tenantId, extId } = req.query;
    const { DialCallStatus } = req.body;

    if (DialCallStatus === 'completed') {
      const laml = new LaML();
      laml.hangup();
      return sendLaml(res, laml.toXml());
    }

    // Forward failed — try voicemail
    const ext = await prisma.extension.findUnique({ where: { id: extId } });
    if (ext && ext.voicemailEnabled) {
      const callRouter = new CallRouter(tenantId);
      const xml = await callRouter.routeToVoicemail(extId, req.body);
      return sendLaml(res, xml);
    }

    const laml = new LaML();
    laml.say('We were unable to connect your call. Goodbye.').hangup();
    sendLaml(res, laml.toXml());
  } catch (err) {
    logger.error('Webhook forward-result error', err);
    sendError(res);
  }
});

// ============================================================================
// POST /api/webhooks/signalwire/ring-group-result
// Called after a ring group dial attempt.
// ============================================================================
router.post('/ring-group-result', async (req, res) => {
  try {
    const { tenantId, rgId, memberIdx } = req.query;
    const { DialCallStatus, CallSid } = req.body;

    if (DialCallStatus === 'completed') {
      if (CallSid) {
        await prisma.callLog.updateMany({
          where: { swCallId: CallSid },
          data: { status: 'completed', answeredAt: new Date(), endedAt: new Date() },
        }).catch(() => {});
      }
      const laml = new LaML();
      laml.hangup();
      return sendLaml(res, laml.toXml());
    }

    // For sequential strategy — try next member
    const rg = await prisma.ringGroup.findUnique({
      where: { id: rgId },
      include: {
        members: {
          include: { extension: true },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (rg && rg.strategy === 'sequential' && memberIdx !== undefined) {
      const nextIdx = parseInt(memberIdx) + 1;
      const nextMember = rg.members[nextIdx];

      if (nextMember && nextMember.extension.status === 'active') {
        const WEBHOOK_BASE = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000/api/webhooks/signalwire';
        const sipDomain = process.env.SIGNALWIRE_SPACE_URL || 'example.signalwire.com';
        const user = nextMember.extension.sipUsername || nextMember.extension.number;

        const laml = new LaML();
        laml.dialSip(`sip:${user}@${sipDomain}`, {
          action: `${WEBHOOK_BASE}/ring-group-result?tenantId=${tenantId}&rgId=${rgId}&memberIdx=${nextIdx}`,
          timeout: rg.ringTime,
        });
        return sendLaml(res, laml.toXml());
      }
    }

    // All members tried — failover
    if (rg && rg.failoverType && rg.failoverTarget) {
      const callRouter = new CallRouter(tenantId);
      const xml = await callRouter.routeToDestination(rg.failoverType, rg.failoverTarget, req.body);
      return sendLaml(res, xml);
    }

    const laml = new LaML();
    laml.say('All representatives are busy. Please try again later. Goodbye.').hangup();
    sendLaml(res, laml.toXml());
  } catch (err) {
    logger.error('Webhook ring-group-result error', err);
    sendError(res);
  }
});

// ============================================================================
// POST /api/webhooks/signalwire/queue-wait
// Called while a caller is waiting in a queue (hold music / messages).
// ============================================================================
router.post('/queue-wait', async (req, res) => {
  try {
    const { tenantId, queueId } = req.query;

    const queue = await prisma.callQueue.findUnique({ where: { id: queueId } });

    const laml = new LaML();

    if (queue && queue.holdMusic) {
      laml.play(queue.holdMusic, { loop: 0 });
    } else {
      laml.say('Your call is important to us. Please continue to hold.');
      laml.play('https://api.twilio.com/cowbell.mp3', { loop: 5 });
    }

    if (queue && queue.holdMessage) {
      laml.pause(queue.holdMessageInterval || 30);
      laml.say(queue.holdMessage);
    }

    sendLaml(res, laml.toXml());
  } catch (err) {
    logger.error('Webhook queue-wait error', err);
    const laml = new LaML();
    laml.say('Please continue to hold.');
    laml.pause(30);
    sendLaml(res, laml.toXml());
  }
});

// ============================================================================
// POST /api/webhooks/signalwire/queue-result
// Called when a caller exits a queue (connected or timed out).
// ============================================================================
router.post('/queue-result', async (req, res) => {
  try {
    const { tenantId, queueId } = req.query;
    const { QueueResult } = req.body;

    if (QueueResult === 'bridged') {
      // Caller was connected — nothing to do
      const laml = new LaML();
      laml.hangup();
      return sendLaml(res, laml.toXml());
    }

    // Queue timeout or error — try failover
    const queue = await prisma.callQueue.findUnique({ where: { id: queueId } });
    if (queue && queue.failoverType && queue.failoverTarget) {
      const callRouter = new CallRouter(tenantId);
      const xml = await callRouter.routeToDestination(queue.failoverType, queue.failoverTarget, req.body);
      return sendLaml(res, xml);
    }

    const laml = new LaML();
    laml.say('We are unable to take your call right now. Please try again later. Goodbye.');
    laml.hangup();
    sendLaml(res, laml.toXml());
  } catch (err) {
    logger.error('Webhook queue-result error', err);
    sendError(res);
  }
});

// ============================================================================
// POST /api/webhooks/signalwire/voicemail-recording
// Called after a voicemail recording is complete.
// ============================================================================
router.post('/voicemail-recording', async (req, res) => {
  try {
    const { tenantId, extId } = req.query;
    const { RecordingUrl, RecordingDuration, RecordingSid, CallSid, From, CallerName, TranscriptionText } = req.body;

    logger.info(`Voicemail recorded: ext=${extId}, duration=${RecordingDuration}s`);

    // Save voicemail record
    await prisma.voicemail.create({
      data: {
        tenantId,
        extensionId: extId,
        callerNumber: From || 'Unknown',
        callerName: CallerName || null,
        duration: parseInt(RecordingDuration) || 0,
        recordingUrl: RecordingUrl,
        transcription: TranscriptionText || null,
      },
    });

    // Update call log
    if (CallSid) {
      await prisma.callLog.updateMany({
        where: { swCallId: CallSid },
        data: {
          status: 'completed',
          endedAt: new Date(),
          recordingUrl: RecordingUrl,
          inboundExtId: extId,
        },
      }).catch(() => {});
    }

    // Save recording
    if (RecordingSid) {
      await prisma.recording.create({
        data: {
          tenantId,
          swRecordingId: RecordingSid,
          callId: CallSid,
          url: RecordingUrl,
          duration: parseInt(RecordingDuration) || 0,
        },
      }).catch(() => {});
    }

    // Create voicemail notification
    const ext = await prisma.extension.findUnique({ where: { id: extId } });
    await prisma.notification.create({
      data: {
        tenantId,
        type: 'new_voicemail',
        title: `New voicemail from ${From || 'Unknown'}`,
        message: `${CallerName || From || 'Unknown caller'} left a ${RecordingDuration || 0}s voicemail for ext ${ext?.number || extId}`,
        data: JSON.stringify({ extensionId: extId, callerNumber: From }),
      },
    }).catch(() => {});

    const laml = new LaML();
    laml.say('Your message has been recorded. Goodbye.').hangup();
    sendLaml(res, laml.toXml());
  } catch (err) {
    logger.error('Webhook voicemail-recording error', err);
    const laml = new LaML();
    laml.hangup();
    sendLaml(res, laml.toXml());
  }
});

// ============================================================================
// POST /api/webhooks/signalwire/call-status
// Status callback — SignalWire sends updates as call progresses.
// ============================================================================
router.post('/call-status', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration, Timestamp } = req.body;

    if (!CallSid) return res.sendStatus(200);

    const statusMap = {
      queued: 'ringing',
      ringing: 'ringing',
      'in-progress': 'in-progress',
      completed: 'completed',
      busy: 'busy',
      'no-answer': 'no-answer',
      failed: 'failed',
      canceled: 'canceled',
    };

    const data = {
      status: statusMap[CallStatus] || CallStatus,
    };

    if (CallStatus === 'completed' || CallStatus === 'busy' || CallStatus === 'no-answer' || CallStatus === 'failed' || CallStatus === 'canceled') {
      data.endedAt = new Date();
      if (CallDuration) {
        data.duration = parseInt(CallDuration);
      }
    }

    if (CallStatus === 'in-progress') {
      data.answeredAt = new Date();
    }

    await prisma.callLog.updateMany({
      where: { swCallId: CallSid },
      data,
    });

    // Generate AI call summary when call completes
    if (CallStatus === 'completed' || CallStatus === 'no-answer') {
      const callLog = await prisma.callLog.findFirst({ where: { swCallId: CallSid } });
      if (callLog) {
        generateCallSummary(callLog).catch((err) => logger.error('Call summary error', err));

        // Create missed call notification
        if (CallStatus === 'no-answer' && callLog.direction === 'inbound') {
          await prisma.notification.create({
            data: {
              tenantId: callLog.tenantId,
              type: 'missed_call',
              title: `Missed call from ${callLog.callerName || callLog.callerNumber}`,
              message: `Missed inbound call from ${callLog.callerNumber} at ${new Date().toLocaleString()}`,
              data: JSON.stringify({ callLogId: callLog.id, callerNumber: callLog.callerNumber }),
            },
          }).catch(() => {});
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    logger.error('Webhook call-status error', err);
    res.sendStatus(200); // Always 200 so SignalWire doesn't retry
  }
});

// ============================================================================
// POST /api/webhooks/signalwire/recording-status
// Called when a recording's status changes (e.g., processing complete).
// ============================================================================
router.post('/recording-status', async (req, res) => {
  try {
    const { RecordingSid, RecordingUrl, RecordingStatus, RecordingDuration, CallSid } = req.body;

    logger.info(`Recording status: ${RecordingSid} = ${RecordingStatus}`);

    if (RecordingStatus === 'completed' && RecordingSid) {
      // Update existing recording or create one
      const existing = await prisma.recording.findFirst({ where: { swRecordingId: RecordingSid } });
      if (existing) {
        await prisma.recording.update({
          where: { id: existing.id },
          data: { url: RecordingUrl, duration: parseInt(RecordingDuration) || 0 },
        });
      }

      // Update call log with recording URL
      if (CallSid) {
        await prisma.callLog.updateMany({
          where: { swCallId: CallSid },
          data: { recordingUrl: RecordingUrl },
        }).catch(() => {});
      }
    }

    res.sendStatus(200);
  } catch (err) {
    logger.error('Webhook recording-status error', err);
    res.sendStatus(200);
  }
});

// ============================================================================
// AI IVR ENDPOINTS
// ============================================================================

// POST /api/webhooks/signalwire/ai-gather
// Called when caller speaks into the AI IVR speech gather.
router.post('/ai-gather', async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { SpeechResult, Digits } = req.body;

    logger.info(`AI Gather: tenant=${tenantId}, speech="${SpeechResult}", digits=${Digits}`);

    const xml = await processAiGatherInput(tenantId, SpeechResult, Digits);
    sendLaml(res, xml);
  } catch (err) {
    logger.error('Webhook ai-gather error', err);
    sendError(res);
  }
});

// POST /api/webhooks/signalwire/ai-fallback
// Called when AI IVR can't understand input — routes to first available extension.
router.post('/ai-fallback', async (req, res) => {
  try {
    const { tenantId } = req.query;

    // Find the first active extension (operator/reception)
    const ext = await prisma.extension.findFirst({
      where: { tenantId, status: 'active' },
      orderBy: { number: 'asc' },
    });

    if (ext) {
      const callRouter = new CallRouter(tenantId);
      const xml = await callRouter.routeToExtension(ext.id, req.body);
      return sendLaml(res, xml);
    }

    const laml = new LaML();
    laml.say('We are unable to connect your call at this time. Please try again later. Goodbye.');
    laml.hangup();
    sendLaml(res, laml.toXml());
  } catch (err) {
    logger.error('Webhook ai-fallback error', err);
    sendError(res);
  }
});

// POST /api/webhooks/signalwire/ai-route
// Routes the call after AI IVR has determined the destination.
router.post('/ai-route', async (req, res) => {
  try {
    const { tenantId, type, targetId } = req.query;

    const callRouter = new CallRouter(tenantId);
    const xml = await callRouter.routeToDestination(type, targetId, req.body);
    sendLaml(res, xml);
  } catch (err) {
    logger.error('Webhook ai-route error', err);
    sendError(res);
  }
});

// ============================================================================
// SWAIG ENDPOINTS (SignalWire AI Gateway)
// ============================================================================

// GET /api/webhooks/signalwire/swaig-functions
// Returns available SWAIG functions for SignalWire Call Flow Builder.
router.get('/swaig-functions', async (req, res) => {
  try {
    const { tenantId } = req.query;
    const functions = await getSwaigFunctions(tenantId);
    res.json(functions);
  } catch (err) {
    logger.error('SWAIG functions error', err);
    res.json([]);
  }
});

// POST /api/webhooks/signalwire/swaig-transfer
// Called by SignalWire AI Agent when it decides to transfer the call.
router.post('/swaig-transfer', async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { argument_parsed } = req.body;
    const destination = argument_parsed?.destination || req.body.destination;

    logger.info(`SWAIG transfer: tenant=${tenantId}, destination="${destination}"`);

    const result = await handleSwaigTransfer(tenantId, destination);

    if (result.action === 'transfer') {
      // Tell SignalWire AI to stop and hand off to call routing
      const WEBHOOK_BASE = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000/api/webhooks/signalwire';
      res.json({
        back_to_back_functions: false,
        stop: true,
        transfer: `${WEBHOOK_BASE}/ai-route?tenantId=${tenantId}&type=${result.type}&targetId=${result.targetId}`,
      });
    } else {
      res.json({
        back_to_back_functions: false,
        stop: false,
        response: `I couldn't find ${destination}. Could you be more specific about who you'd like to reach?`,
      });
    }
  } catch (err) {
    logger.error('SWAIG transfer error', err);
    res.json({ stop: false, response: 'I had trouble processing that transfer. Let me connect you to our main line.' });
  }
});

// POST /api/webhooks/signalwire/swaig-check-hours
router.post('/swaig-check-hours', async (req, res) => {
  try {
    const { tenantId } = req.query;
    const result = await handleSwaigCheckHours(tenantId);
    res.json({
      back_to_back_functions: false,
      stop: false,
      response: result.message,
    });
  } catch (err) {
    logger.error('SWAIG check-hours error', err);
    res.json({ stop: false, response: 'I had trouble checking our hours.' });
  }
});

// POST /api/webhooks/signalwire/swaig-take-message
router.post('/swaig-take-message', async (req, res) => {
  try {
    const { tenantId } = req.query;
    const { argument_parsed } = req.body;
    const result = await handleSwaigTakeMessage(tenantId, argument_parsed || req.body);
    res.json({
      back_to_back_functions: false,
      stop: true,
      response: result.message,
    });
  } catch (err) {
    logger.error('SWAIG take-message error', err);
    res.json({ stop: false, response: 'I had trouble saving your message. Please try calling back.' });
  }
});

module.exports = router;
