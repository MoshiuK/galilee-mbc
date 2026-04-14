import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const emptyForm = {
  number: '', name: '', type: 'sip', voicemailEnabled: true, voicemailPin: '1234',
  forwardEnabled: false, forwardNumber: '', forwardAfter: 25, dndEnabled: false,
  callerIdName: '', voicemailEmail: '',
};

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.get('/extensions');
      setExtensions(data);
    } catch { toast.error('Failed to load extensions'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (ext) => {
    setEditing(ext);
    setForm({
      number: ext.number, name: ext.name, type: ext.type,
      voicemailEnabled: ext.voicemailEnabled, voicemailPin: ext.voicemailPin || '',
      forwardEnabled: ext.forwardEnabled, forwardNumber: ext.forwardNumber || '',
      forwardAfter: ext.forwardAfter, dndEnabled: ext.dndEnabled,
      callerIdName: ext.callerIdName || '', voicemailEmail: ext.voicemailEmail || '',
    });
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/extensions/${editing.id}`, form);
        toast.success('Extension updated');
      } else {
        await api.post('/extensions', form);
        toast.success('Extension created');
      }
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
  };

  const remove = async (ext) => {
    if (!confirm(`Delete extension ${ext.number} - ${ext.name}?`)) return;
    try { await api.delete(`/extensions/${ext.id}`); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const columns = [
    { key: 'number', label: 'Ext #', render: (r) => <span className="font-mono font-bold">{r.number}</span> },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', render: (r) => <span className="capitalize">{r.type}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'user', label: 'User', render: (r) => r.user ? `${r.user.firstName} ${r.user.lastName}` : '-' },
    { key: 'voicemail', label: 'Voicemail', render: (r) => r.voicemailEnabled ? 'On' : 'Off' },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex gap-2 justify-end">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
        <button onClick={(e) => { e.stopPropagation(); remove(r); }} className="p-1 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Extensions</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Extension
        </button>
      </div>
      <DataTable columns={columns} data={extensions} loading={loading} emptyMessage="No extensions configured" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Extension' : 'New Extension'}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Extension Number</label>
              <input type="text" value={form.number} onChange={(e) => setForm({...form, number: e.target.value})}
                placeholder="e.g. 100" className="w-full px-3 py-2 border rounded-lg" required disabled={!!editing} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
                placeholder="John Smith" className="w-full px-3 py-2 border rounded-lg" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({...form, type: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                <option value="sip">SIP</option><option value="webrtc">WebRTC</option><option value="external">External</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Caller ID Name</label>
              <input type="text" value={form.callerIdName} onChange={(e) => setForm({...form, callerIdName: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Voicemail</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.voicemailEnabled} onChange={(e) => setForm({...form, voicemailEnabled: e.target.checked})} />
                <span className="text-sm">Enable Voicemail</span>
              </label>
              <div>
                <input type="text" value={form.voicemailPin} onChange={(e) => setForm({...form, voicemailPin: e.target.value})}
                  placeholder="PIN" className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div className="mt-2">
              <input type="email" value={form.voicemailEmail} onChange={(e) => setForm({...form, voicemailEmail: e.target.value})}
                placeholder="Email for voicemail notifications" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Call Forwarding</h3>
            <label className="flex items-center gap-2 mb-2">
              <input type="checkbox" checked={form.forwardEnabled} onChange={(e) => setForm({...form, forwardEnabled: e.target.checked})} />
              <span className="text-sm">Enable Forwarding</span>
            </label>
            {form.forwardEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <input type="tel" value={form.forwardNumber} onChange={(e) => setForm({...form, forwardNumber: e.target.value})}
                  placeholder="+15551234567" className="w-full px-3 py-2 border rounded-lg text-sm" />
                <div className="flex items-center gap-2">
                  <input type="number" value={form.forwardAfter} onChange={(e) => setForm({...form, forwardAfter: parseInt(e.target.value)})}
                    className="w-20 px-3 py-2 border rounded-lg text-sm" min="5" max="120" />
                  <span className="text-sm text-gray-500">seconds</span>
                </div>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 border-t pt-4">
            <input type="checkbox" checked={form.dndEnabled} onChange={(e) => setForm({...form, dndEnabled: e.target.checked})} />
            <span className="text-sm font-medium">Do Not Disturb</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
