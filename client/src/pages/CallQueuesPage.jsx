import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function CallQueuesPage() {
  const [queues, setQueues] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', strategy: 'round_robin', maxWaitTime: 300, maxCallers: 10, holdMessage: '', memberExtensionIds: [] });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [qRes, eRes] = await Promise.all([api.get('/call-queues'), api.get('/extensions')]);
      setQueues(qRes.data); setExtensions(eRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ name: '', strategy: 'round_robin', maxWaitTime: 300, maxCallers: 10, holdMessage: '', memberExtensionIds: [] }); setModalOpen(true); };
  const openEdit = (q) => {
    setEditing(q);
    setForm({ name: q.name, strategy: q.strategy, maxWaitTime: q.maxWaitTime, maxCallers: q.maxCallers, holdMessage: q.holdMessage || '', memberExtensionIds: q.members.map(m => m.extensionId) });
    setModalOpen(true);
  };

  const toggleMember = (extId) => {
    const ids = form.memberExtensionIds.includes(extId)
      ? form.memberExtensionIds.filter(id => id !== extId)
      : [...form.memberExtensionIds, extId];
    setForm({ ...form, memberExtensionIds: ids });
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/call-queues/${editing.id}`, form); toast.success('Updated'); }
      else { await api.post('/call-queues', form); toast.success('Created'); }
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const remove = async (q) => {
    if (!confirm(`Delete queue "${q.name}"?`)) return;
    try { await api.delete(`/call-queues/${q.id}`); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'strategy', label: 'Strategy', render: (r) => <span className="capitalize">{r.strategy.replace('_', ' ')}</span> },
    { key: 'members', label: 'Agents', render: (r) => r.members.length },
    { key: 'maxCallers', label: 'Max Callers' },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex gap-2 justify-end">
        <button onClick={() => openEdit(r)} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
        <button onClick={() => remove(r)} className="p-1 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Call Queues</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"><Plus className="w-4 h-4" /> New Queue</button>
      </div>
      <DataTable columns={columns} data={queues} loading={loading} emptyMessage="No call queues" />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Call Queue' : 'New Call Queue'}>
        <form onSubmit={save} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Name</label><input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium mb-1">Strategy</label>
              <select value={form.strategy} onChange={(e) => setForm({...form, strategy: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                <option value="round_robin">Round Robin</option><option value="longest_idle">Longest Idle</option><option value="ring_all">Ring All</option>
              </select></div>
            <div><label className="block text-sm font-medium mb-1">Max Wait (sec)</label><input type="number" value={form.maxWaitTime} onChange={(e) => setForm({...form, maxWaitTime: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium mb-1">Max Callers</label><input type="number" value={form.maxCallers} onChange={(e) => setForm({...form, maxCallers: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Hold Message</label><input type="text" value={form.holdMessage} onChange={(e) => setForm({...form, holdMessage: e.target.value})} placeholder="Your call is important to us..." className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-sm font-medium mb-2">Agents (Extensions)</label>
            <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
              {extensions.map(ext => (
                <label key={ext.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={form.memberExtensionIds.includes(ext.id)} onChange={() => toggleMember(ext.id)} />
                  <span className="font-mono text-sm">{ext.number}</span><span className="text-sm">{ext.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
