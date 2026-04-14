import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';

export default function AdminTenantExtensionsPage() {
  const { tenantId } = useParams();
  const [tenant, setTenant] = useState(null);
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ number: '', name: '', type: 'sip', voicemailEnabled: true, voicemailPin: '1234', forwardNumber: '', voicemailEmail: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [tRes, eRes] = await Promise.all([
        api.get(`/tenants/${tenantId}`),
        api.get(`/platform/tenants/${tenantId}/extensions`),
      ]);
      setTenant(tRes.data);
      setExtensions(eRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ number: '', name: '', type: 'sip', voicemailEnabled: true, voicemailPin: '1234', forwardNumber: '', voicemailEmail: '' }); setModalOpen(true); };
  const openEdit = (ext) => { setEditing(ext); setForm({ number: ext.number, name: ext.name, type: ext.type, voicemailEnabled: ext.voicemailEnabled, voicemailPin: ext.voicemailPin || '', forwardNumber: ext.forwardNumber || '', voicemailEmail: ext.voicemailEmail || '' }); setModalOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/platform/tenants/${tenantId}/extensions/${editing.id}`, form);
        toast.success('Updated');
      } else {
        await api.post(`/platform/tenants/${tenantId}/extensions`, form);
        toast.success('Extension created');
      }
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const remove = async (ext) => {
    if (!confirm(`Delete extension ${ext.number}?`)) return;
    try { await api.delete(`/platform/tenants/${tenantId}/extensions/${ext.id}`); toast.success('Deleted'); load(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <Link to="/admin/tenants" className="flex items-center gap-1 text-sm text-blue-600 mb-4 hover:underline"><ArrowLeft className="w-4 h-4" /> Back to Clients</Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Extensions — {tenant?.name}</h1>
          <p className="text-sm text-gray-500">Manage phone extensions for this client</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Plus className="w-4 h-4" /> Add Extension</button>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="px-4 py-3 text-left font-medium text-gray-500">Ext #</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Name</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">SIP User</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">SIP Pass</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Voicemail</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {extensions.map(ext => (
              <tr key={ext.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-bold">{ext.number}</td>
                <td className="px-4 py-3 font-medium">{ext.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{ext.sipUsername}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{ext.sipPassword}</td>
                <td className="px-4 py-3 capitalize">{ext.type}</td>
                <td className="px-4 py-3">{ext.voicemailEnabled ? 'On' : 'Off'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(ext)} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => remove(ext)} className="p-1 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {extensions.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No extensions. Click "Add Extension" to create one.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Extension' : 'New Extension'}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Extension #</label><input type="text" value={form.number} onChange={(e) => setForm({...form, number: e.target.value})} placeholder="100" className="w-full px-3 py-2 border rounded-lg" required disabled={!!editing} /></div>
            <div><label className="block text-sm font-medium mb-1">Name</label><input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="John Smith" className="w-full px-3 py-2 border rounded-lg" required /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Type</label>
            <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
              <option value="sip">SIP Phone</option><option value="webrtc">Web Phone</option><option value="external">External/Cell</option>
            </select></div>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.voicemailEnabled} onChange={(e) => setForm({...form, voicemailEnabled: e.target.checked})} /> <span className="text-sm">Voicemail</span></label>
            <input type="text" value={form.voicemailPin} onChange={(e) => setForm({...form, voicemailPin: e.target.value})} placeholder="VM PIN" className="px-3 py-2 border rounded-lg text-sm" />
          </div>
          <div><label className="block text-sm font-medium mb-1">Forward to (optional)</label><input type="tel" value={form.forwardNumber} onChange={(e) => setForm({...form, forwardNumber: e.target.value})} placeholder="+12145551234" className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-sm font-medium mb-1">Voicemail email (optional)</label><input type="email" value={form.voicemailEmail} onChange={(e) => setForm({...form, voicemailEmail: e.target.value})} placeholder="john@company.com" className="w-full px-3 py-2 border rounded-lg" /></div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
