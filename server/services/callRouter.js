/**
 * Call Router — Core PBX call-flow engine
 *
 * Resolves where an inbound call should go based on the phone number's
 * routing configuration: IVR menu, extension, ring group, queue,
 * time condition, or external forward.
 */

const prisma = require('../utils/prisma');
const { LaML } = require('./laml');
const logger = require('../utils/logger');

const WEBHOOK_BASE = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000/api/webhooks/signalwire';

class CallRouter {
  constructor(tenantId) {
    this.tenantId = tenantId;
  }

  /**
   * Route an inbound call arriving on a specific phone number.
   * Returns LaML XML string.
   */
  async routeInboundCall(phoneNumber, callParams) {
    const pn = await prisma.phoneNumber.findUnique({
      where: { number: phoneNumber },
      include: { tenant: true },
    });

    if (!pn || !pn.active) {
      logger.warn(`No active phone number found: ${phoneNumber}`);
      const laml = new LaML();
      laml.say('The number you have called is not in service.').hangup();
      return laml.toXml();
    }

    this.tenantId = pn.tenantId;
    return this.routeToDestination(pn.routeType, pn.routeDestination, callParams);
  }

  /**
   * Route to a specific destination type + target.
   */
  async routeToDestination(type, targetId, callParams) {
    switch (type) {
      case 'ivr':
        return this.routeToIvr(targetId, callParams);
      case 'extension':
        return this.routeToExtension(targetId, callParams);
      case 'ring_group':
        return this.routeToRingGroup(targetId, callParams);
      case 'queue':
        return this.routeToQueue(targetId, callParams);
      case 'time_condition':
        return this.routeToTimeCondition(targetId, callParams);
      case 'external':
        return this.routeToExternal(targetId, callParams);
      case 'voicemail':
        return this.routeToVoicemail(targetId, callParams);
      default:
        logger.warn(`Unknown route type: ${type}`);
        const laml = new LaML();
        laml.say('Sorry, this number is not configured properly.').hangup();
        return laml.toXml();
    }
  }

  /**
   * Route to an IVR menu (auto attendant).
   */
  async routeToIvr(ivrMenuId, callParams) {
    const menu = await prisma.ivrMenu.findUnique({
      where: { id: ivrMenuId },
      include: { options: true },
    });

    if (!menu || !menu.active) {
      const laml = new LaML();
      laml.say('Sorry, this menu is not available.').hangup();
      return laml.toXml();
    }

    const laml = new LaML();
    const gatherAction = `${WEBHOOK_BASE}/ivr-input?tenantId=${this.tenantId}&menuId=${ivrMenuId}`;

    laml.gather({
      action: gatherAction,
      numDigits: 1,
      timeout: menu.timeout,
    });

    if (menu.greetingType === 'recording' && menu.greetingRecording) {
      laml.gatherPlay(menu.greetingRecording);
    } else if (menu.greetingText) {
      laml.gatherSay(menu.greetingText, { voice: menu.greetingVoice });
    }

    laml.endGather();

    // If no input, repeat or go to timeout
    if (menu.timeoutMessage) {
      laml.say(menu.timeoutMessage);
    }
    laml.redirect(gatherAction + '&timeout=true');

    return laml.toXml();
  }

  /**
   * Process IVR digit input.
   */
  async processIvrInput(ivrMenuId, digit, retryCount = 0) {
    const menu = await prisma.ivrMenu.findUnique({
      where: { id: ivrMenuId },
      include: { options: true },
    });

    if (!menu) {
      const laml = new LaML();
      laml.say('Menu not found.').hangup();
      return laml.toXml();
    }

    const option = menu.options.find((o) => o.digit === digit);

    if (!option) {
      const laml = new LaML();
      if (retryCount >= menu.maxRetries) {
        laml.say('Goodbye.').hangup();
        return laml.toXml();
      }
      if (menu.invalidMessage) {
        laml.say(menu.invalidMessage);
      }
      // Replay the menu
      laml.redirect(
        `${WEBHOOK_BASE}/ivr-play?tenantId=${this.tenantId}&menuId=${ivrMenuId}&retry=${retryCount + 1}`
      );
      return laml.toXml();
    }

    // Route based on option action
    switch (option.actionType) {
      case 'extension':
        return this.routeToExtension(option.actionTarget);
      case 'ring_group':
        return this.routeToRingGroup(option.actionTarget);
      case 'queue':
        return this.routeToQueue(option.actionTarget);
      case 'ivr_menu':
        return this.routeToIvr(option.actionTarget);
      case 'external':
        return this.routeToExternal(option.actionTarget);
      case 'voicemail':
        return this.routeToVoicemail(option.actionTarget);
      case 'repeat':
        return this.routeToIvr(ivrMenuId);
      case 'hangup': {
        const laml = new LaML();
        laml.say('Goodbye.').hangup();
        return laml.toXml();
      }
      default: {
        const laml = new LaML();
        laml.say('Sorry, that option is not available.').hangup();
        return laml.toXml();
      }
    }
  }

  /**
   * Route to an extension — ring the SIP endpoint, then voicemail fallback.
   */
  async routeToExtension(extensionId, callParams) {
    const ext = await prisma.extension.findUnique({ where: { id: extensionId } });

    if (!ext || ext.status !== 'active') {
      const laml = new LaML();
      laml.say('That extension is not available.').hangup();
      return laml.toXml();
    }

    if (ext.dndEnabled) {
      if (ext.voicemailEnabled) {
        return this.routeToVoicemail(ext.id);
      }
      const laml = new LaML();
      laml.say('That extension is currently unavailable.').hangup();
      return laml.toXml();
    }

    const laml = new LaML();
    const dialAction = `${WEBHOOK_BASE}/dial-result?tenantId=${this.tenantId}&extId=${ext.id}`;

    if (ext.type === 'sip' && ext.sipUsername) {
      const sipDomain = process.env.SIGNALWIRE_SPACE_URL || 'example.signalwire.com';
      const sipUri = `sip:${ext.sipUsername}@${sipDomain}`;
      laml.dialSip(sipUri, {
        action: dialAction,
        timeout: ext.forwardAfter,
        callerId: callParams?.From,
      });
    } else if (ext.type === 'external' && ext.forwardNumber) {
      laml.dial(ext.forwardNumber, {
        action: dialAction,
        timeout: ext.forwardAfter,
        callerId: callParams?.From,
      });
    } else {
      // WebRTC or fallback
      const sipDomain = process.env.SIGNALWIRE_SPACE_URL || 'example.signalwire.com';
      laml.dialSip(`sip:${ext.number}@${sipDomain}`, {
        action: dialAction,
        timeout: ext.forwardAfter,
        callerId: callParams?.From,
      });
    }

    return laml.toXml();
  }

  /**
   * Route to a ring group — ring multiple extensions.
   */
  async routeToRingGroup(ringGroupId, callParams) {
    const rg = await prisma.ringGroup.findUnique({
      where: { id: ringGroupId },
      include: { members: { include: { extension: true }, orderBy: { priority: 'asc' } } },
    });

    if (!rg || !rg.active || rg.members.length === 0) {
      const laml = new LaML();
      laml.say('No one is available. Please try again later.').hangup();
      return laml.toXml();
    }

    const laml = new LaML();
    const dialAction = `${WEBHOOK_BASE}/ring-group-result?tenantId=${this.tenantId}&rgId=${rg.id}`;
    const sipDomain = process.env.SIGNALWIRE_SPACE_URL || 'example.signalwire.com';

    if (rg.strategy === 'simultaneous') {
      // Ring all at once
      const sipUris = rg.members
        .filter((m) => m.extension.status === 'active' && !m.extension.dndEnabled)
        .map((m) => {
          const user = m.extension.sipUsername || m.extension.number;
          return `sip:${user}@${sipDomain}`;
        });

      if (sipUris.length === 0) {
        laml.say('No one is available. Please try again later.').hangup();
        return laml.toXml();
      }

      // Use dialNumbers for simultaneous (external numbers) or
      // multiple Sip elements for SIP URIs
      const sipElements = sipUris.map((uri) => `    <Sip>${uri}</Sip>`).join('\n');
      laml.elements.push(
        `  <Dial action="${dialAction}" method="POST" timeout="${rg.ringTime}">\n${sipElements}\n  </Dial>`
      );
    } else {
      // Sequential — ring first member, webhook will advance
      const firstMember = rg.members.find(
        (m) => m.extension.status === 'active' && !m.extension.dndEnabled
      );
      if (!firstMember) {
        laml.say('No one is available.').hangup();
        return laml.toXml();
      }

      const user = firstMember.extension.sipUsername || firstMember.extension.number;
      laml.dialSip(`sip:${user}@${sipDomain}`, {
        action: `${dialAction}&memberIdx=0`,
        timeout: rg.ringTime,
        callerId: callParams?.From,
      });
    }

    return laml.toXml();
  }

  /**
   * Route to a call queue.
   */
  async routeToQueue(queueId, callParams) {
    const queue = await prisma.callQueue.findUnique({ where: { id: queueId } });

    if (!queue || !queue.active) {
      const laml = new LaML();
      laml.say('The queue is not available.').hangup();
      return laml.toXml();
    }

    const laml = new LaML();
    const queueName = `tenant_${this.tenantId}_queue_${queue.id}`;

    laml.say('Please hold while we connect you to the next available representative.');
    laml.enqueue(queueName, {
      waitUrl: `${WEBHOOK_BASE}/queue-wait?tenantId=${this.tenantId}&queueId=${queue.id}`,
      action: `${WEBHOOK_BASE}/queue-result?tenantId=${this.tenantId}&queueId=${queue.id}`,
    });

    return laml.toXml();
  }

  /**
   * Route based on time conditions (business hours).
   */
  async routeToTimeCondition(timeConditionId, callParams) {
    const tc = await prisma.timeCondition.findUnique({
      where: { id: timeConditionId },
      include: { schedules: true },
    });

    if (!tc || !tc.active) {
      const laml = new LaML();
      laml.say('This service is currently unavailable.').hangup();
      return laml.toXml();
    }

    const isOpen = this.isWithinSchedule(tc.schedules, tc.timezone);

    if (isOpen) {
      return this.routeToDestination(tc.matchType, tc.matchTarget, callParams);
    } else {
      return this.routeToDestination(tc.noMatchType, tc.noMatchTarget, callParams);
    }
  }

  /**
   * Check if current time is within any of the schedules.
   */
  isWithinSchedule(schedules, timezone) {
    const now = new Date();
    const options = { timeZone: timezone, hour12: false };
    const formatter = new Intl.DateTimeFormat('en-US', {
      ...options,
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

    return schedules.some(
      (s) => s.dayOfWeek === currentDay && currentTime >= s.startTime && currentTime <= s.endTime
    );
  }

  /**
   * Route to an external phone number.
   */
  async routeToExternal(number, callParams) {
    const laml = new LaML();
    laml.dial(number, {
      callerId: callParams?.From,
      timeout: 30,
    });
    return laml.toXml();
  }

  /**
   * Route to voicemail for a specific extension.
   */
  async routeToVoicemail(extensionId, callParams) {
    const ext = await prisma.extension.findUnique({ where: { id: extensionId } });

    const laml = new LaML();

    if (!ext || !ext.voicemailEnabled) {
      laml.say('Voicemail is not available for this extension.').hangup();
      return laml.toXml();
    }

    // Play greeting
    if (ext.voicemailGreeting) {
      laml.play(ext.voicemailGreeting);
    } else {
      laml.say(
        `You have reached extension ${ext.number}, ${ext.name}. ` +
        `Please leave a message after the beep. Press pound when finished.`
      );
    }

    // Record
    laml.record({
      action: `${WEBHOOK_BASE}/voicemail-recording?tenantId=${this.tenantId}&extId=${ext.id}`,
      maxLength: 120,
      timeout: 10,
      transcribe: true,
    });

    laml.say('Goodbye.');
    laml.hangup();

    return laml.toXml();
  }
}

module.exports = { CallRouter };
