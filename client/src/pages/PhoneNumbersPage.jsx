import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

export default function PhoneNumbersPage() {
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ routeType: 'ivr', routeDestination: '', friendlyName: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [areaCode, setAreaCode] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const { data } = await api.get('/phone-numbers'); setNumbers(data); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const searchNumbers = async () => {
    setSearching(true);
    try {
      const { data } = await api.get(`/phone-numbers/available?areaCode=${areaCode}`);
      setSearchResults(data);
    } catch (err) { toast.error(err.response?.data?.error || 'Search failed'); }
    finally { setSearching(false); }
  };

  const purchase = async (number) => {
    try {
      await api.post('/phone-numbers/purchase', { phoneNumber: number.phone_number || number.phoneNumber, friendlyName: number.friendly_name || number.phone_number });
      toast.success('Number purchased!');
      setPurchaseModal(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Purchase failed'); }
  };

  const openEdit = (num) => {
    setEditing(num);
    setForm({ routeType: num.routeType, routeDestination: num.routeDestination || '', friendlyName: num.friendlyName || '' });
    setEditModal(true);
  };

  const saveRoute = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/phone-numbers/${editing.id}`, form);
      toast.success('Updated');
      setEditModal(false);
      load();
    } catch (err) { toast.error('Failed to update'); }
  };

  const remove = async (num) => {
    if (!confirm(`Release ${num.number}? This will remove it from your account.`)) return;
    try { await api.delete(`/phone-numbers/${num.id}`); toast.success('Released'); load(); }
    catch { toast.error('Failed to release'); }
  };

  const columns = [
    { key: 'number', label: 'Number', render: (r) => <span className="font-mono font-bold">{r.number}</span> },
    { key: 'friendlyName', label: 'Label' },
    { key: 'routeType', label: 'Routes To', render: (r) => <span className="capitalize">{r.routeType?.replace('_', ' ')}</span> },
    { key: 'active', label: 'Status', render: (r) => r.active
      ? <span className="text-green-600 text-xs font-medium">Active</span>
      : <span className="text-gray-400 text-xs">Inactive</span>
    },
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
        <h1 className="text-2xl font-bold">Phone Numbers</h1>
        <button onClick={() => { setSearchResults([]); setAreaCode(''); setPurchaseModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Purchase Number
        </button>
      </div>
      <DataTable columns={columns} data={numbers} loading={loading} emptyMessage="No phone numbers. Purchase one to get started." />

      {/* Edit Route Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Number Routing">
        <form onSubmit={saveRoute} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Friendly Name</label>
            <input type="text" value={form.friendlyName} onChange={(e) => setForm({...form, friendlyName: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Route To</label>
            <select value={form.routeType} onChange={(e) => setForm({...form, routeType: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
              <option value="ivr">IVR Menu</option>
              <option value="extension">Extension</option>
              <option value="ring_group">Ring Group</option>
              <option value="queue">Call Queue</option>
              <option value="time_condition">Time Condition</option>
              <option value="external">External Number</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Destination ID / Number</label>
            <input type="text" value={form.routeDestination} onChange={(e) => setForm({...form, routeDestination: e.target.value})}
              placeholder="ID of IVR, extension, etc." className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setEditModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Save</button>
          </div>
        </form>
      </Modal>

      {/* Purchase Modal */}
      <Modal open={purchaseModal} onClose={() => setPurchaseModal(false)} title="Purchase Phone Number" wide>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" value={areaCode} onChange={(e) => setAreaCode(e.target.value)}
              placeholder="Area code (e.g. 212)" className="flex-1 px-3 py-2 border rounded-lg" maxLength={3} />
            <button onClick={searchNumbers} disabled={searching}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              <Search className="w-4 h-4" /> {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {searchResults.map((n, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <span className="font-mono">{n.phone_number || n.phoneNumber}</span>
                  <button onClick={() => purchase(n)} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                    Purchase
                  </button>
                </div>
              ))}
            </div>
          )}
          {searchResults.length === 0 && areaCode && !searching && (
            <p className="text-gray-500 text-sm text-center py-4">No numbers found. Try a different area code.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
