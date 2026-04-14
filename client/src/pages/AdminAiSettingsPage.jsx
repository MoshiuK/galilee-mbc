import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Brain, MessageSquare, Phone, Copy, Check, Zap } from 'lucide-react';

export default function AdminAiSettingsPage() {
  const { tenantId } = useParams();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.get(`/platform/tenants/${tenantId}/ai-settings`);
      setSettings(data);
    } catch { toast.error('Failed to load AI settings'); }
    finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/platform/tenants/${tenantId}/ai-settings`, {
        aiIvrEnabled: settings.aiIvrEnabled,
        aiIvrPrompt: settings.aiIvrPrompt,
        aiSummaryEnabled: settings.aiSummaryEnabled,
        smsSummaryEnabled: settings.smsSummaryEnabled,
        notificationPhone: settings.notificationPhone,
      });
      toast.success('AI settings saved');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const copyUrl = (url, label) => {
    navigator.clipboard.writeText(url);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-3xl">
      <Link to="/admin/tenants" className="flex items-center gap-1 text-sm text-blue-600 mb-4 hover:underline"><ArrowLeft className="w-4 h-4" /> Back to Clients</Link>
      <h1 className="text-2xl font-bold mb-6">AI Settings — {settings?.name}</h1>

      {/* AI IVR */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><Brain className="w-5 h-5 text-purple-600" /></div>
            <div>
              <h2 className="text-lg font-semibold">AI-Powered IVR</h2>
              <p className="text-sm text-gray-500">Callers speak naturally instead of pressing buttons</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={settings?.aiIvrEnabled || false}
              onChange={(e) => setSettings({...settings, aiIvrEnabled: e.target.checked})}
              className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-purple-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>

        {settings?.aiIvrEnabled && (
          <div className="space-y-3 pt-3 border-t">
            <div>
              <label className="block text-sm font-medium mb-1">AI Greeting Prompt</label>
              <textarea value={settings?.aiIvrPrompt || ''} onChange={(e) => setSettings({...settings, aiIvrPrompt: e.target.value})}
                rows={3} placeholder="Thank you for calling. How can I help you today? You can say the name of the person or department you'd like to reach."
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <p className="text-xs text-gray-400 mt-1">This is what the AI says when it answers. The caller then speaks their request and gets routed automatically.</p>
            </div>
          </div>
        )}
      </div>

      {/* Call Summaries */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><MessageSquare className="w-5 h-5 text-blue-600" /></div>
            <div>
              <h2 className="text-lg font-semibold">AI Call Summaries</h2>
              <p className="text-sm text-gray-500">Automatically summarize every call</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={settings?.aiSummaryEnabled || false}
              onChange={(e) => setSettings({...settings, aiSummaryEnabled: e.target.checked})}
              className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>

        {settings?.aiSummaryEnabled && (
          <div className="space-y-3 pt-3 border-t">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings?.smsSummaryEnabled || false}
                onChange={(e) => setSettings({...settings, smsSummaryEnabled: e.target.checked})} />
              <span className="text-sm font-medium">Also send summaries via SMS</span>
            </label>
            {settings?.smsSummaryEnabled && (
              <div>
                <label className="block text-sm font-medium mb-1">SMS Notification Phone</label>
                <input type="tel" value={settings?.notificationPhone || ''} onChange={(e) => setSettings({...settings, notificationPhone: e.target.value})}
                  placeholder="+12145551234" className="w-full px-3 py-2 border rounded-lg" />
                <p className="text-xs text-gray-400 mt-1">Call summaries will be sent to this number after every call.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SWAIG — Full AI Agent */}
      <div className="bg-white border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-100 rounded-lg"><Zap className="w-5 h-5 text-green-600" /></div>
          <div>
            <h2 className="text-lg font-semibold">SWAIG — Full AI Agent</h2>
            <p className="text-sm text-gray-500">SignalWire AI handles the entire call conversation</p>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 mb-4">
          SWAIG lets SignalWire's AI Agent have a natural conversation with the caller. It can transfer calls, check business hours, and take messages — all automatically.
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Webhook URLs for SignalWire Call Flow Builder:</p>
          <p className="text-xs text-gray-500 mb-2">Copy these URLs and paste them into your SignalWire Call Flow Builder under the AI Agent node's SWAIG Functions section.</p>

          {settings?.swaigConfig && Object.entries({
            'Transfer Calls': settings.swaigConfig.transferUrl,
            'Check Business Hours': settings.swaigConfig.checkHoursUrl,
            'Take Message': settings.swaigConfig.takeMessageUrl,
            'All Functions (GET)': settings.swaigConfig.functionsUrl,
            'Inbound Call Handler': settings.swaigConfig.inboundCallUrl,
            'AI Gather': settings.swaigConfig.aiGatherUrl,
          }).map(([label, url]) => (
            <div key={label} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-600">{label}</p>
                <p className="text-xs font-mono text-gray-500 truncate">{url}</p>
              </div>
              <button onClick={() => copyUrl(url, label)}
                className="p-1.5 hover:bg-gray-200 rounded text-gray-500 shrink-0">
                {copied === label ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save Button */}
      <button onClick={save} disabled={saving}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
        {saving ? 'Saving...' : 'Save AI Settings'}
      </button>
    </div>
  );
}
