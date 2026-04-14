import { useState, useEffect } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import Modal from '../components/common/Modal';
import { Smartphone, Download, Copy, Check } from 'lucide-react';

export default function ProvisioningPage() {
  const [extensions, setExtensions] = useState([]);
  const [phoneModels, setPhoneModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedExt, setSelectedExt] = useState(null);
  const [form, setForm] = useState({ phoneModel: '', macAddress: '' });
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [extRes, modRes] = await Promise.all([
        api.get('/extensions'),
        api.get('/provisioning/phones/models'),
      ]);
      setExtensions(extRes.data);
      setPhoneModels(modRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openProvision = (ext) => {
    setSelectedExt(ext);
    setForm({ phoneModel: ext.provisionModel || '', macAddress: ext.provisionMac || '' });
    setResult(null);
    setModalOpen(true);
  };

  const generate = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/provisioning/generate', {
        extensionId: selectedExt.id,
        phoneModel: form.phoneModel,
        macAddress: form.macAddress,
      });
      setResult(data);
      toast.success('Config generated');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const copyConfig = () => {
    navigator.clipboard.writeText(result.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadConfig = () => {
    const blob = new Blob([result.content], { type: result.contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Phone Provisioning</h1>
        <p className="text-sm text-gray-500 mt-1">Auto-configure SIP phones for your extensions</p>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">How Auto-Provisioning Works</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Select an extension and phone model below</li>
          <li>Enter the phone's MAC address (found on the back of the phone)</li>
          <li>Generate the config and download it, or set up DHCP Option 66</li>
          <li>The phone will automatically register with SignalWire</li>
        </ol>
      </div>

      {/* Extensions list */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-4 py-3 text-left font-medium text-gray-500">Ext #</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">SIP User</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Phone</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">MAC</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500"></th>
            </tr>
          </thead>
          <tbody>
            {extensions.map(ext => (
              <tr key={ext.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-bold">{ext.number}</td>
                <td className="px-4 py-3">{ext.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{ext.sipUsername}</td>
                <td className="px-4 py-3 text-sm">
                  {ext.provisionModel ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{ext.provisionModel}</span>
                  ) : (
                    <span className="text-gray-400 text-xs">Not configured</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{ext.provisionMac || '-'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => openProvision(ext)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
                    <Smartphone className="w-3 h-3" /> Provision
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Provision Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={`Provision: Ext ${selectedExt?.number} — ${selectedExt?.name}`} wide>
        <form onSubmit={generate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone Model</label>
              <select value={form.phoneModel} onChange={(e) => setForm({...form, phoneModel: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" required>
                <option value="">Select phone...</option>
                {phoneModels.map(brand => (
                  <optgroup key={brand.brand} label={brand.brand}>
                    {brand.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">MAC Address</label>
              <input type="text" value={form.macAddress} onChange={(e) => setForm({...form, macAddress: e.target.value})}
                placeholder="AA:BB:CC:DD:EE:FF" className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
              <p className="text-xs text-gray-400 mt-1">Found on the back/bottom of the phone</p>
            </div>
          </div>

          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            Generate Config
          </button>

          {result && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Generated: {result.filename}</p>
                  <p className="text-xs text-gray-500 font-mono mt-1">{result.provisioningUrl}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={copyConfig}
                    className="flex items-center gap-1 px-3 py-1.5 border rounded text-xs hover:bg-gray-50">
                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                  <button type="button" onClick={downloadConfig}
                    className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                    <Download className="w-3 h-3" /> Download
                  </button>
                </div>
              </div>
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto max-h-64">
                {result.content}
              </pre>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
