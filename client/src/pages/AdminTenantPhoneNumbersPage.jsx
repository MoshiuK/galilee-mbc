import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Plus, Search, Pencil, Trash2, ArrowLeft, ArrowRightLeft, Phone } from 'lucide-react';

export default function AdminTenantPhoneNumbersPage() {
  const { tenantId } = useParams();
  const [tenant, setTenant] = useState(null);
  const [numbers, setNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [portModal, setPortModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ routeType: 'ivr', routeDestination: '', friendlyName: '' });
  const [areaCode, setAreaCode] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [portForm, setPortForm] = useState({ phoneNumber: '', carrierName: '', accountNumber: '', accountPin: '', contactName: '', contactPhone: '', contactEmail: '', friendlyName: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const [tRes, nRes] = await Promise.all([
        api.get(`/tenants/${tenantId}`),
        api.get(`/platform/tenants/${tenantId}/phone-numbers`),
      ]);
      setTenant(tRes.data); setNumbers(nRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const searchNumbers = async () => {
    setSearching(true);
    try {
      const { data } = await api.get(`/platform/tenants/${tenantId}/phone-numbers/available?areaCode=${areaCode}`);
      setSearchResults(data);
    } catch (err) { toast.error(err.response?.data?.error || 'Search failed'); }
    finally { setSearching(false); }
  };

  const purchase = async (n) => {
    try {
      await api.post(`/platform/tenants/${tenantId}/phone-numbers/purchase`, { phoneNumber: n.phone_number || n.phoneNumber, friendlyName: n.friendly_name || n.phone_number });
      toast.success('Number purchased!'); setPurchaseModal(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const submitPort = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/platform/tenants/${tenantId}/phone-numbers/port`, { phoneNumbers: [portForm.phoneNumber], ...portForm });
      toast.success('Port request submitted!');
      setPortModal(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const openEdit = (n) => { setEditing(n); setEditForm({ routeType: n.routeType, routeDestination: n.routeDestination || '', friendlyName: n.friendlyName || '' }); setEditModal(true); };

  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/platform/tenants/${tenantId}/phone-numbers/${editing.id}`, editForm);
      toast.success('Updated'); setEditModal(false); load();
    } catch { toast.error('Failed'); }
  };

  const remove = async (n) => {
    if (!confirm(`Release ${n.number}?`)) return;
    try { await api.delete(`/platform/tenants/${tenantId}/phone-numbers/${n.id}`); toast.success('Released'); load(); }
    catch { toast.error('Failed'); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <Link to="/admin/tenants" className="flex items-center gap-1 text-sm text-blue-600 mb-4 hover:underline"><ArrowLeft className="w-4 h-4" /> Back to Clients</Link>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold">Phone Numbers — {tenant?.name}</h1></div>
        <div className="flex gap-2">
          <button onClick={() => setPortModal(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm"><ArrowRightLeft className="w-4 h-4" /> Port Existing Number</button>
          <button onClick={() => { setSearchResults([]); setAreaCode(''); setPurchaseModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Plus className="w-4 h-4" /> Buy New Number</button>
        </div>
      </div>

      {/* Numbers list */}
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="px-4 py-3 text-left font-medium text-gray-500">Number</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Label</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Routes To</th>
            <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {numbers.map(n => (
              <tr key={n.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-bold">{n.number}</td>
                <td className="px-4 py-3">{n.friendlyName}</td>
                <td className="px-4 py-3 capitalize">{n.routeType?.replace('_', ' ')}</td>
                <td className="px-4 py-3">{n.active ? <span className="text-green-600 text-xs font-medium">Active</span> : <span className="text-orange-500 text-xs font-medium">Pending Port</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(n)} className="p-1 hover:bg-gray-100 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => remove(n)} className="p-1 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {numbers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No phone numbers. Buy or port a number to get started.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Purchase Modal */}
      <Modal open={purchaseModal} onClose={() => setPurchaseModal(false)} title="Buy New Number" wide>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Search for available numbers by area code and purchase instantly.</p>
          <div className="flex gap-2">
            <input type="text" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} placeholder="Area code (e.g. 214)" className="flex-1 px-3 py-2 border rounded-lg" maxLength={3} />
            <button onClick={searchNumbers} disabled={searching} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
              <Search className="w-4 h-4" /> {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {searchResults.map((n, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <span className="font-mono">{n.phone_number || n.phoneNumber}</span>
                  <button onClick={() => purchase(n)} className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">Buy</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Port Modal */}
      <Modal open={portModal} onClose={() => setPortModal(false)} title="Port Existing Number" wide>
        <form onSubmit={submitPort} className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
            Transfer an existing phone number from another carrier to SignalWire. This typically takes 7-14 business days.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Phone Number to Port</label>
              <input type="tel" value={portForm.phoneNumber} onChange={(e) => setPortForm({...portForm, phoneNumber: e.target.value})} placeholder="+12145551234" className="w-full px-3 py-2 border rounded-lg" required /></div>
            <div><label className="block text-sm font-medium mb-1">Label</label>
              <input type="text" value={portForm.friendlyName} onChange={(e) => setPortForm({...portForm, friendlyName: e.target.value})} placeholder="Main Office Line" className="w-full px-3 py-2 border rounded-lg" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Current Carrier</label>
              <input type="text" value={portForm.carrierName} onChange={(e) => setPortForm({...portForm, carrierName: e.target.value})} placeholder="AT&T, Verizon, etc." className="w-full px-3 py-2 border rounded-lg" required /></div>
            <div><label className="block text-sm font-medium mb-1">Account Number</label>
              <input type="text" value={portForm.accountNumber} onChange={(e) => setPortForm({...portForm, accountNumber: e.target.value})} placeholder="Your account # with carrier" className="w-full px-3 py-2 border rounded-lg" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Account PIN</label>
              <input type="text" value={portForm.accountPin} onChange={(e) => setPortForm({...portForm, accountPin: e.target.value})} placeholder="PIN or password" className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium mb-1">Authorized Contact Name</label>
              <input type="text" value={portForm.contactName} onChange={(e) => setPortForm({...portForm, contactName: e.target.value})} placeholder="Name on the account" className="w-full px-3 py-2 border rounded-lg" required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Contact Phone</label>
              <input type="tel" value={portForm.contactPhone} onChange={(e) => setPortForm({...portForm, contactPhone: e.target.value})} placeholder="+12145559999" className="w-full px-3 py-2 border rounded-lg" /></div>
            <div><label className="block text-sm font-medium mb-1">Contact Email</label>
              <input type="email" value={portForm.contactEmail} onChange={(e) => setPortForm({...portForm, contactEmail: e.target.value})} placeholder="email@company.com" className="w-full px-3 py-2 border rounded-lg" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setPortModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">Submit Port Request</button>
          </div>
        </form>
      </Modal>

      {/* Edit Route Modal */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Edit Number Routing">
        <form onSubmit={saveEdit} className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Label</label>
            <input type="text" value={editForm.friendlyName} onChange={(e) => setEditForm({...editForm, friendlyName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
          <div><label className="block text-sm font-medium mb-1">Route To</label>
            <select value={editForm.routeType} onChange={(e) => setEditForm({...editForm, routeType: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
              <option value="ivr">IVR Menu</option><option value="extension">Extension</option><option value="ring_group">Ring Group</option>
              <option value="queue">Call Queue</option><option value="time_condition">Time Condition</option><option value="external">External Number</option>
            </select></div>
          <div><label className="block text-sm font-medium mb-1">Destination ID</label>
            <input type="text" value={editForm.routeDestination} onChange={(e) => setEditForm({...editForm, routeDestination: e.target.value})} placeholder="ID of the IVR, extension, etc." className="w-full px-3 py-2 border rounded-lg" /></div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setEditModal(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Save</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
