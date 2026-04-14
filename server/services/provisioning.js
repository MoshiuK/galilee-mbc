/**
 * SIP Phone Auto-Provisioning Service
 *
 * Generates configuration files for SIP phones so they automatically
 * register with SignalWire when plugged into the network.
 *
 * Supported manufacturers:
 *   - Yealink (T2x, T3x, T4x, T5x series)
 *   - Polycom (VVX series)
 *   - Grandstream (GXP/GRP series)
 *   - Cisco (SPA series)
 *   - Generic SIP (any standards-compliant phone)
 *
 * How it works:
 *   1. Admin creates extension → SIP credentials generated
 *   2. Admin selects phone model → provisioning config generated
 *   3. Phone is pointed to provisioning URL (via DHCP Option 66 or manual)
 *   4. Phone downloads its config and auto-registers
 *
 * Provisioning URL format:
 *   {BASE_URL}/api/provisioning/{mac_address}/{filename}
 */

const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

/**
 * Generate provisioning config for a specific phone/extension.
 */
async function generateConfig(extension, tenant, phoneModel) {
  const sipDomain = tenant.swSpaceUrl || process.env.SIGNALWIRE_SPACE_URL || 'example.signalwire.com';
  const sipProxy = sipDomain;
  const sipPort = '5060';
  const sipTransport = 'UDP'; // SignalWire supports UDP, TCP, TLS

  const params = {
    displayName: extension.name,
    sipUsername: extension.sipUsername,
    sipPassword: extension.sipPassword,
    sipDomain,
    sipProxy,
    sipPort,
    sipTransport,
    extensionNumber: extension.number,
    callerIdName: extension.callerIdName || extension.name,
    callerIdNumber: extension.callerIdNumber || '',
    tenantName: tenant.brandName || tenant.name,
  };

  const brand = (phoneModel || 'generic').toLowerCase();

  if (brand.startsWith('yealink')) return generateYealinkConfig(params, phoneModel);
  if (brand.startsWith('polycom')) return generatePolycomConfig(params, phoneModel);
  if (brand.startsWith('grandstream')) return generateGrandstreamConfig(params, phoneModel);
  if (brand.startsWith('cisco')) return generateCiscoConfig(params, phoneModel);
  return generateGenericConfig(params);
}

// ============================================================================
// YEALINK — .cfg format
// ============================================================================
function generateYealinkConfig(p, model) {
  return {
    filename: 'y000000000000.cfg',
    contentType: 'text/plain',
    content: `#!version:1.0.0.1

## Yealink Auto-Provisioning — ${p.tenantName}
## Extension: ${p.extensionNumber} — ${p.displayName}

## Account 1
account.1.enable = 1
account.1.label = ${p.extensionNumber}
account.1.display_name = ${p.displayName}
account.1.auth_name = ${p.sipUsername}
account.1.user_name = ${p.sipUsername}
account.1.password = ${p.sipPassword}
account.1.sip_server.1.address = ${p.sipDomain}
account.1.sip_server.1.port = ${p.sipPort}
account.1.sip_server.1.transport_type = 0
account.1.sip_server.1.register_on_enable = 1
account.1.sip_server.1.expires = 3600
account.1.outbound_proxy_enable = 0
account.1.nat.udp_update_enable = 1
account.1.nat.udp_update_time = 30

## Caller ID
account.1.cid_source = 2
account.1.caller_id_name = ${p.callerIdName}

## Codecs
account.1.codec.1.enable = 1
account.1.codec.1.payload_type = PCMU
account.1.codec.2.enable = 1
account.1.codec.2.payload_type = PCMA
account.1.codec.3.enable = 1
account.1.codec.3.payload_type = G729
account.1.codec.4.enable = 1
account.1.codec.4.payload_type = G722

## Phone Settings
phone_setting.ring_type = Ring1.wav
phone_setting.auto_answer = 0
phone_setting.send_key = Enter

## LCD
phone_setting.idle_clock_type = 3
lcd_logo.mode = 0

## Voicemail
voice_mail.number.1 = *97

## Network
network.dhcp_enable = 1
network.dns_server.1 = 8.8.8.8

## NTP
local_time.ntp_server1 = pool.ntp.org
local_time.time_zone = -5

## Firmware (auto-update)
auto_provision.mode = 0
`,
  };
}

// ============================================================================
// POLYCOM — .cfg XML format
// ============================================================================
function generatePolycomConfig(p, model) {
  return {
    filename: '000000000000.cfg',
    contentType: 'application/xml',
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<!-- Polycom Auto-Provisioning — ${p.tenantName} -->
<!-- Extension: ${p.extensionNumber} — ${p.displayName} -->
<polycomConfig>
  <reg reg.1.displayName="${p.displayName}"
       reg.1.label="${p.extensionNumber}"
       reg.1.address="${p.sipUsername}"
       reg.1.auth.userId="${p.sipUsername}"
       reg.1.auth.password="${p.sipPassword}"
       reg.1.server.1.address="${p.sipDomain}"
       reg.1.server.1.port="${p.sipPort}"
       reg.1.server.1.transport="UDPonly"
       reg.1.server.1.register="1"
       reg.1.server.1.expires="3600"
       reg.1.lineKeys="1"
       reg.1.type="private"
       reg.1.ringType="ringer2" />

  <voIpProt voIpProt.server.1.address="${p.sipProxy}"
            voIpProt.server.1.port="${p.sipPort}"
            voIpProt.server.1.transport="UDPonly" />

  <dialplan dialplan.digitmap="[2-9]11|0T|011xxx.T|[0-1][2-9]xxxxxxxxx|[2-9]xxxxxxxxx|[2-9]xxx|xx.T"
            dialplan.digitmap.timeOut="3" />

  <voice voice.codecPref.G711Mu="1"
         voice.codecPref.G711A="2"
         voice.codecPref.G729AB="3"
         voice.codecPref.G722="4" />

  <msg msg.mwi.1.subscribe="${p.sipUsername}"
       msg.mwi.1.callBackMode="contact"
       msg.mwi.1.callBack="*97" />

  <nat nat.keepalive.interval="30" />

  <tcpIpApp tcpIpApp.sntp.address="pool.ntp.org"
            tcpIpApp.sntp.gmtOffset="-18000" />
</polycomConfig>
`,
  };
}

// ============================================================================
// GRANDSTREAM — .xml format
// ============================================================================
function generateGrandstreamConfig(p, model) {
  return {
    filename: 'cfg000000000000.xml',
    contentType: 'application/xml',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!-- Grandstream Auto-Provisioning — ${p.tenantName} -->
<!-- Extension: ${p.extensionNumber} — ${p.displayName} -->
<gs_provision version="1">

  <!-- Account 1 -->
  <config name="P271" value="1"/>                          <!-- Account Active -->
  <config name="P270" value="${p.displayName}"/>            <!-- Account Name -->
  <config name="P47" value="${p.sipDomain}"/>               <!-- SIP Server -->
  <config name="P2312" value="${p.sipPort}"/>               <!-- SIP Server Port -->
  <config name="P35" value="${p.sipUsername}"/>              <!-- SIP User ID -->
  <config name="P36" value="${p.sipUsername}"/>              <!-- Authenticate ID -->
  <config name="P34" value="${p.sipPassword}"/>              <!-- Authenticate Password -->
  <config name="P3" value="${p.displayName}"/>              <!-- Display Name -->
  <config name="P33" value="${p.callerIdName}"/>            <!-- Caller ID Name -->
  <config name="P2347" value="0"/>                          <!-- Register Expiration: 3600 -->

  <!-- Codecs -->
  <config name="P57" value="0"/>     <!-- PCMU -->
  <config name="P58" value="8"/>     <!-- PCMA -->
  <config name="P59" value="18"/>    <!-- G729 -->

  <!-- NAT -->
  <config name="P52" value="1"/>     <!-- NAT Traversal: STUN -->
  <config name="P72" value="30"/>    <!-- Keep-alive interval -->

  <!-- Voicemail -->
  <config name="P33" value="*97"/>   <!-- Voicemail User ID -->

  <!-- NTP -->
  <config name="P30" value="pool.ntp.org"/>
  <config name="P64" value="-5"/>    <!-- Time Zone -->

  <!-- Network -->
  <config name="P8" value="0"/>      <!-- DHCP -->

</gs_provision>
`,
  };
}

// ============================================================================
// CISCO SPA — .xml format
// ============================================================================
function generateCiscoConfig(p, model) {
  return {
    filename: 'spa000000000000.xml',
    contentType: 'application/xml',
    content: `<flat-profile>
<!-- Cisco SPA Auto-Provisioning — ${p.tenantName} -->
<!-- Extension: ${p.extensionNumber} — ${p.displayName} -->

<!-- Line 1 -->
<Line_Enable_1_ ua="na">Yes</Line_Enable_1_>
<Display_Name_1_ ua="na">${p.displayName}</Display_Name_1_>
<User_ID_1_ ua="na">${p.sipUsername}</User_ID_1_>
<Auth_ID_1_ ua="na">${p.sipUsername}</Auth_ID_1_>
<Password_1_ ua="na">${p.sipPassword}</Password_1_>
<Proxy_1_ ua="na">${p.sipDomain}</Proxy_1_>
<Outbound_Proxy_1_ ua="na">${p.sipProxy}</Outbound_Proxy_1_>
<Use_Outbound_Proxy_1_ ua="na">No</Use_Outbound_Proxy_1_>
<Register_1_ ua="na">Yes</Register_1_>
<Register_Expires_1_ ua="na">3600</Register_Expires_1_>
<SIP_Port_1_ ua="na">${p.sipPort}</SIP_Port_1_>
<SIP_Transport_1_ ua="na">UDP</SIP_Transport_1_>

<!-- Caller ID -->
<Caller_ID_Name_1_ ua="na">${p.callerIdName}</Caller_ID_Name_1_>

<!-- Codecs -->
<Preferred_Codec_1_ ua="na">G711u</Preferred_Codec_1_>
<Use_Pref_Codec_Only_1_ ua="na">No</Use_Pref_Codec_Only_1_>
<G729a_Enable_1_ ua="na">Yes</G729a_Enable_1_>
<G722_Enable_1_ ua="na">Yes</G722_Enable_1_>

<!-- NAT / Keep-alive -->
<NAT_Keep_Alive_Enable_1_ ua="na">Yes</NAT_Keep_Alive_Enable_1_>
<NAT_Keep_Alive_Msg_1_ ua="na">$NOTIFY</NAT_Keep_Alive_Msg_1_>
<NAT_Keep_Alive_Dest_1_ ua="na">$PROXY</NAT_Keep_Alive_Dest_1_>

<!-- Voicemail -->
<Voice_Mail_Number_1_ ua="na">*97</Voice_Mail_Number_1_>

<!-- NTP -->
<Primary_NTP_Server ua="na">pool.ntp.org</Primary_NTP_Server>
<Time_Zone ua="na">GMT-05:00</Time_Zone>

<!-- Network -->
<Connection_Type ua="na">DHCP</Connection_Type>

</flat-profile>
`,
  };
}

// ============================================================================
// GENERIC SIP — .cfg text format (works with most SIP phones)
// ============================================================================
function generateGenericConfig(p) {
  return {
    filename: 'phone.cfg',
    contentType: 'text/plain',
    content: `# SIP Phone Auto-Provisioning — ${p.tenantName}
# Extension: ${p.extensionNumber} — ${p.displayName}
#
# Configure your SIP phone with these settings:
#
# ============ Account Settings ============
# Display Name:    ${p.displayName}
# Username/Auth:   ${p.sipUsername}
# Password:        ${p.sipPassword}
# SIP Server:      ${p.sipDomain}
# SIP Port:        ${p.sipPort}
# Transport:       ${p.sipTransport}
# Register:        Yes
# Expiry:          3600
#
# ============ Caller ID ============
# Caller ID Name:  ${p.callerIdName}
# Caller ID Num:   ${p.callerIdNumber || p.extensionNumber}
#
# ============ Voicemail ============
# Voicemail:       *97
#
# ============ Codecs (in order) ============
# 1. G.711u (PCMU)
# 2. G.711a (PCMA)
# 3. G.729
# 4. G.722 (HD Voice)
#
# ============ NAT ============
# Keep-alive:      30 seconds
# STUN:            stun.signalwire.com
`,
  };
}

/**
 * Get list of supported phone models.
 */
function getSupportedPhones() {
  return [
    { brand: 'Yealink', models: ['Yealink T21P', 'Yealink T23G', 'Yealink T27G', 'Yealink T29G', 'Yealink T33G', 'Yealink T43U', 'Yealink T46U', 'Yealink T48U', 'Yealink T53W', 'Yealink T54W', 'Yealink T57W', 'Yealink T58A'] },
    { brand: 'Polycom', models: ['Polycom VVX 150', 'Polycom VVX 250', 'Polycom VVX 350', 'Polycom VVX 450', 'Polycom VVX 501', 'Polycom VVX 601'] },
    { brand: 'Grandstream', models: ['Grandstream GXP1610', 'Grandstream GXP1620', 'Grandstream GXP1630', 'Grandstream GXP2130', 'Grandstream GXP2140', 'Grandstream GXP2170', 'Grandstream GRP2612', 'Grandstream GRP2614', 'Grandstream GRP2616'] },
    { brand: 'Cisco', models: ['Cisco SPA501G', 'Cisco SPA502G', 'Cisco SPA504G', 'Cisco SPA508G', 'Cisco SPA512G', 'Cisco SPA514G'] },
    { brand: 'Generic', models: ['Generic SIP'] },
  ];
}

module.exports = { generateConfig, getSupportedPhones };
