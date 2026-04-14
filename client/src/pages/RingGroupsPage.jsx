import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function RingGroupsPage() {
  const [groups, setGroups] = useState([]);
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', strategy: 'simultaneous', ringTime: 25, memberExtensionIds: [] });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [gRes, eRes] = await Promise.all([api.get('/ring-groups'), api.get('/extensions')]);
      setGroups(gRes.data);
      setExtensions(eRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ name: '', strategy: 'simultaneous', ringTime: 25, memberExtensionIds: [] }); setModalOpen(true); };
  const openEdit = (g) => {
    setEditing(g);
    setForm({ name: g.name, strategy: g.strategy, ringTime: g.ringTime, memberExtensionIds: g.members.map(m => m.extensionId) });
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
      if (editing) { await api.put(`/ring-groups/${editing.id}`, form); toast.success('Updated'); }
      else { await api.post('/ring-groups', form); toast.success('Created'); }
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const remove = async (g) => {
    if (!confirm(`Delete ring group "${g.name}"?`)) return;
    try { await api.delete(`/ring-groups/${g.id}`); toast.success('Deleted'); load(); }
    catch { toast.error('Failed'); }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'strategy', label: 'Strategy', render: (r) => <span className="capitalize">{r.strategy}</span> },
    { key: 'members', label: 'Members', render: (r) => r.members.map(m => m.extension.number).join(', ') || 'None' },
    { key: 'ringTime', label: 'Ring Time', render: (r) => `${r.ringTime}s` },
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
        <h1 className="text-2xl font-bold">Ring Groups</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"><Plus className="w-4 h-4" /> New Ring Group</button>
      </div>
      <DataTable columns={columns} data={groups} loading={loading} emptyMessage="No ring groups configured" />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Ring Group' : 'New Ring Group'}>
        <form onSubmit={save} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Strategy</label>
              <select value={form.strategy} onChange={(e) => setForm({...form, strategy: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                <option value="simultaneous">Simultaneous (ring all)</option><option value="sequential">Sequential</option><option value="random">Random</option>
              </select></div>
            <div><label className="block text-sm font-medium mb-1">Ring Time (sec)</label>
              <input type="number" value={form.ringTime} onChange={(e) => setForm({...form, ringTime: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-lg" min={5} max={120} /></div>
          </div>
          <div><label className="block text-sm font-medium mb-2">Members</label>
            <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
              {extensions.map(ext => (
                <label key={ext.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={form.memberExtensionIds.includes(ext.id)} onChange={() => toggleMember(ext.id)} />
                  <span className="font-mono text-sm">{ext.number}</span><span className="text-sm">{ext.name}</span>
                </label>
              ))}
              {extensions.length === 0 && <p className="text-gray-500 text-sm p-3">No extensions available</p>}
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
