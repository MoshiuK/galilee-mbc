/**
 * SignalWire REST API Client
 *
 * Handles all SignalWire API interactions: phone numbers, calls, SIP endpoints.
 * Supports both platform-level and per-tenant SignalWire credentials.
 */

const logger = require('../utils/logger');

class SignalWireClient {
  constructor({ projectId, apiToken, spaceUrl } = {}) {
    this.projectId = projectId || process.env.SIGNALWIRE_PROJECT_ID;
    this.apiToken = apiToken || process.env.SIGNALWIRE_API_TOKEN;
    this.spaceUrl = spaceUrl || process.env.SIGNALWIRE_SPACE_URL;
    this.baseUrl = `https://${this.spaceUrl}/api/laml/2010-04-01/Accounts/${this.projectId}`;
  }

  /**
   * Build auth header for SignalWire REST API.
   */
  get authHeader() {
    const encoded = Buffer.from(`${this.projectId}:${this.apiToken}`).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * Make an authenticated request to SignalWire REST API.
   */
  async request(method, path, body = null) {
    const url = `${this.baseUrl}${path}`;
    const options = {
      method,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    };

    if (body) {
      options.body = new URLSearchParams(body).toString();
    }

    logger.debug(`SignalWire API: ${method} ${url}`);

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      logger.error('SignalWire API error', { status: response.status, data });
      const err = new Error(data.message || 'SignalWire API error');
      err.status = response.status;
      err.swCode = data.code;
      throw err;
    }

    return data;
  }

  // =========================================================================
  // Phone Numbers
  // =========================================================================

  async listAvailableNumbers({ areaCode, country = 'US', limit = 20 } = {}) {
    const params = new URLSearchParams({ PageSize: limit });
    if (areaCode) params.set('AreaCode', areaCode);
    return this.request('GET', `/AvailablePhoneNumbers/${country}/Local.json?${params}`);
  }

  async purchaseNumber(phoneNumber) {
    return this.request('POST', '/IncomingPhoneNumbers.json', {
      PhoneNumber: phoneNumber,
    });
  }

  async configureNumber(swPhoneNumberSid, { voiceUrl, voiceMethod = 'POST', statusCallback }) {
    return this.request('POST', `/IncomingPhoneNumbers/${swPhoneNumberSid}.json`, {
      VoiceUrl: voiceUrl,
      VoiceMethod: voiceMethod,
      ...(statusCallback && { StatusCallback: statusCallback }),
    });
  }

  async releaseNumber(swPhoneNumberSid) {
    return this.request('DELETE', `/IncomingPhoneNumbers/${swPhoneNumberSid}.json`);
  }

  async listNumbers({ limit = 50 } = {}) {
    return this.request('GET', `/IncomingPhoneNumbers.json?PageSize=${limit}`);
  }

  // =========================================================================
  // Calls
  // =========================================================================

  async makeCall({ to, from, url, statusCallback }) {
    return this.request('POST', '/Calls.json', {
      To: to,
      From: from,
      Url: url,
      ...(statusCallback && { StatusCallback: statusCallback }),
    });
  }

  async getCall(callSid) {
    return this.request('GET', `/Calls/${callSid}.json`);
  }

  async updateCall(callSid, params) {
    return this.request('POST', `/Calls/${callSid}.json`, params);
  }

  async hangupCall(callSid) {
    return this.updateCall(callSid, { Status: 'completed' });
  }

  // =========================================================================
  // SIP Endpoints (for extensions)
  // =========================================================================

  async createSipEndpoint({ friendlyName, username, password, domain }) {
    // SignalWire uses SIP Domains and Credentials
    return this.request('POST', '/SIP/CredentialLists.json', {
      FriendlyName: friendlyName,
    });
  }

  async createSipCredential(credentialListSid, { username, password }) {
    return this.request(
      'POST',
      `/SIP/CredentialLists/${credentialListSid}/Credentials.json`,
      { Username: username, Password: password }
    );
  }

  // =========================================================================
  // Recordings
  // =========================================================================

  async listRecordings({ callSid, limit = 50 } = {}) {
    const path = callSid
      ? `/Calls/${callSid}/Recordings.json?PageSize=${limit}`
      : `/Recordings.json?PageSize=${limit}`;
    return this.request('GET', path);
  }

  async getRecording(recordingSid) {
    return this.request('GET', `/Recordings/${recordingSid}.json`);
  }

  async deleteRecording(recordingSid) {
    return this.request('DELETE', `/Recordings/${recordingSid}.json`);
  }
}

/**
 * Get a SignalWire client for a specific tenant.
 * Falls back to platform credentials if tenant doesn't have its own.
 */
function getClientForTenant(tenant) {
  if (tenant && tenant.swProjectId && tenant.swApiToken && tenant.swSpaceUrl) {
    return new SignalWireClient({
      projectId: tenant.swProjectId,
      apiToken: tenant.swApiToken,
      spaceUrl: tenant.swSpaceUrl,
    });
  }
  return new SignalWireClient();
}

module.exports = { SignalWireClient, getClientForTenant };
