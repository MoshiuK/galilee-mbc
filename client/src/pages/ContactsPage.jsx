import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', phoneAlt: '', company: '', email: '', notes: '' });

  useEffect(() => { load(); }, [search]);

  const load = async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const { data } = await api.get(`/contacts${params}`);
      setContacts(data.contacts || data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ firstName: '', lastName: '', phone: '', phoneAlt: '', company: '', email: '', notes: '' }); setModalOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ firstName: c.firstName, lastName: c.lastName || '', phone: c.phone, phoneAlt: c.phoneAlt || '', company: c.company || '', email: c.email || '', notes: c.notes || '' }); setModalOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) { await api.put(`/contacts/${editing.id}`, form); toast.success('Updated'); }
      else { await api.post('/contacts', form); toast.success('Created'); }
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const remove = async (c) => {
    if (!confirm(`Delete ${c.firstName} ${c.lastName}?`)) return;
    try { await api.delete(`/contacts/${c.id}`); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.firstName} {r.lastName}</span> },
    { key: 'phone', label: 'Phone', render: (r) => <span className="font-mono text-sm">{r.phone}</span> },
    { key: 'company', label: 'Company' },
    { key: 'email', label: 'Email' },
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
        <h1 className="text-2xl font-bold">Contacts</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"><Plus className="w-4 h-4" /> Add Contact</button>
      </div>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>
      <DataTable columns={columns} data={contacts} loading={loading} emptyMessage="No contacts" />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Contact' : 'New Contact'}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">First Name</label><input type="text" value={form.firstName} onChange={(e) => setForm({...form, firstName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required /></div>
            <div><label className="block text-sm font-medium mb-1">Last Name</label><input type="text" value={form.lastName} onChange={(e) => setForm({...form, lastName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required /></div>
            <div><label className="block text-sm font-medium mb-1">Alt Phone</label><input type="tel" value={form.phoneAlt} onChange={(e) => setForm({...form, phoneAlt: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Company</label><input type="text" value={form.company} onChange={(e) => setForm({...form, company: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
          </div>
          <div><label className="block text-sm font-medium mb-1">Notes</label><textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg" rows={2} /></div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
