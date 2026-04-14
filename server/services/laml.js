/**
 * LaML (SignalWire Markup Language) Generator
 *
 * Generates LaML XML responses for SignalWire webhooks.
 * LaML is compatible with TwiML but includes SignalWire-specific extensions.
 */

class LaML {
  constructor() {
    this.elements = [];
  }

  /**
   * Wrap content in a <Response> root element.
   */
  toXml() {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${this.elements.join('\n')}\n</Response>`;
  }

  /**
   * <Say> — Text-to-speech
   */
  say(text, { voice = 'Polly.Joanna', language = 'en-US', loop = 1 } = {}) {
    this.elements.push(
      `  <Say voice="${voice}" language="${language}" loop="${loop}">${escapeXml(text)}</Say>`
    );
    return this;
  }

  /**
   * <Play> — Play audio file
   */
  play(url, { loop = 1 } = {}) {
    this.elements.push(`  <Play loop="${loop}">${escapeXml(url)}</Play>`);
    return this;
  }

  /**
   * <Gather> — Collect DTMF input
   */
  gather({ action, method = 'POST', numDigits = 1, timeout = 5, finishOnKey = '', input = 'dtmf' } = {}) {
    const attrs = [
      `action="${escapeXml(action)}"`,
      `method="${method}"`,
      `numDigits="${numDigits}"`,
      `timeout="${timeout}"`,
      `input="${input}"`,
    ];
    if (finishOnKey) attrs.push(`finishOnKey="${finishOnKey}"`);

    this._gatherAttrs = attrs.join(' ');
    this._gatherChildren = [];
    return this;
  }

  /**
   * Add content inside a <Gather> block.
   */
  gatherSay(text, { voice = 'Polly.Joanna', language = 'en-US' } = {}) {
    this._gatherChildren.push(
      `    <Say voice="${voice}" language="${language}">${escapeXml(text)}</Say>`
    );
    return this;
  }

  gatherPlay(url) {
    this._gatherChildren.push(`    <Play>${escapeXml(url)}</Play>`);
    return this;
  }

  /**
   * End <Gather> and add it to elements.
   */
  endGather() {
    this.elements.push(
      `  <Gather ${this._gatherAttrs}>\n${this._gatherChildren.join('\n')}\n  </Gather>`
    );
    this._gatherAttrs = null;
    this._gatherChildren = null;
    return this;
  }

  /**
   * <Dial> — Connect the call to another endpoint
   */
  dial(target, {
    action,
    method = 'POST',
    timeout = 30,
    callerId,
    record = false,
    timeLimit = 14400,
    ringTone,
  } = {}) {
    const attrs = [`timeout="${timeout}"`, `timeLimit="${timeLimit}"`];
    if (action) attrs.push(`action="${escapeXml(action)}"`, `method="${method}"`);
    if (callerId) attrs.push(`callerId="${escapeXml(callerId)}"`);
    if (record) attrs.push(`record="record-from-answer-dual"`);
    if (ringTone) attrs.push(`ringTone="${ringTone}"`);

    if (typeof target === 'string') {
      // Simple number dial
      this.elements.push(`  <Dial ${attrs.join(' ')}>${escapeXml(target)}</Dial>`);
    }
    return this;
  }

  /**
   * <Dial> with <Sip> child — dial a SIP endpoint
   */
  dialSip(sipUri, {
    action,
    method = 'POST',
    timeout = 30,
    callerId,
    record = false,
  } = {}) {
    const attrs = [`timeout="${timeout}"`];
    if (action) attrs.push(`action="${escapeXml(action)}"`, `method="${method}"`);
    if (callerId) attrs.push(`callerId="${escapeXml(callerId)}"`);
    if (record) attrs.push(`record="record-from-answer-dual"`);

    this.elements.push(
      `  <Dial ${attrs.join(' ')}>\n    <Sip>${escapeXml(sipUri)}</Sip>\n  </Dial>`
    );
    return this;
  }

  /**
   * <Dial> with multiple <Number> children — simultaneous ring
   */
  dialNumbers(numbers, {
    action,
    method = 'POST',
    timeout = 30,
    callerId,
    record = false,
  } = {}) {
    const attrs = [`timeout="${timeout}"`];
    if (action) attrs.push(`action="${escapeXml(action)}"`, `method="${method}"`);
    if (callerId) attrs.push(`callerId="${escapeXml(callerId)}"`);
    if (record) attrs.push(`record="record-from-answer-dual"`);

    const numberEls = numbers.map((n) => `    <Number>${escapeXml(n)}</Number>`).join('\n');
    this.elements.push(`  <Dial ${attrs.join(' ')}>\n${numberEls}\n  </Dial>`);
    return this;
  }

  /**
   * <Dial> with <Queue> child
   */
  dialQueue(queueName, { action, method = 'POST' } = {}) {
    const attrs = [];
    if (action) attrs.push(`action="${escapeXml(action)}"`, `method="${method}"`);
    this.elements.push(
      `  <Dial ${attrs.join(' ')}>\n    <Queue>${escapeXml(queueName)}</Queue>\n  </Dial>`
    );
    return this;
  }

  /**
   * <Enqueue> — Place caller in a queue
   */
  enqueue(queueName, { waitUrl, action } = {}) {
    const attrs = [];
    if (waitUrl) attrs.push(`waitUrl="${escapeXml(waitUrl)}"`);
    if (action) attrs.push(`action="${escapeXml(action)}"`);
    this.elements.push(
      `  <Enqueue ${attrs.join(' ')}>${escapeXml(queueName)}</Enqueue>`
    );
    return this;
  }

  /**
   * <Record> — Record audio (voicemail)
   */
  record({
    action,
    method = 'POST',
    maxLength = 120,
    timeout = 10,
    transcribe = false,
    playBeep = true,
    finishOnKey = '#',
  } = {}) {
    const attrs = [
      `maxLength="${maxLength}"`,
      `timeout="${timeout}"`,
      `playBeep="${playBeep}"`,
      `finishOnKey="${finishOnKey}"`,
    ];
    if (action) attrs.push(`action="${escapeXml(action)}"`, `method="${method}"`);
    if (transcribe) attrs.push(`transcribe="true"`);

    this.elements.push(`  <Record ${attrs.join(' ')}/>`);
    return this;
  }

  /**
   * <Redirect> — Redirect to another URL
   */
  redirect(url, { method = 'POST' } = {}) {
    this.elements.push(`  <Redirect method="${method}">${escapeXml(url)}</Redirect>`);
    return this;
  }

  /**
   * <Pause> — Pause for N seconds
   */
  pause(length = 1) {
    this.elements.push(`  <Pause length="${length}"/>`);
    return this;
  }

  /**
   * <Hangup>
   */
  hangup() {
    this.elements.push('  <Hangup/>');
    return this;
  }

  /**
   * <Reject> — Reject the call
   */
  reject({ reason = 'rejected' } = {}) {
    this.elements.push(`  <Reject reason="${reason}"/>`);
    return this;
  }
}

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = { LaML };
