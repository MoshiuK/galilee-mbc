import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Building2, Plus, Search, ChevronRight, Phone, Hash, PhoneCall, Voicemail, Settings } from 'lucide-react';

export default function PlatformAdminPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, [search]);

  const load = async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      const { data } = await api.get(`/tenants${params}`);
      setTenants(data.tenants || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manage Clients</h1>
        <button onClick={() => navigate('/admin/tenants/new')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add New Client
        </button>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>

      <div className="grid gap-4">
        {tenants.map(t => (
          <div key={t.id} className="bg-white border rounded-lg p-5 hover:shadow-md transition">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{t.name}</h3>
                  <p className="text-sm text-gray-500">{t.slug} &middot; <span className="capitalize">{t.plan}</span> &middot; {t.active ? <span className="text-green-600">Active</span> : <span className="text-red-500">Inactive</span>}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-6 text-sm text-gray-500 mb-4">
              <span><Hash className="w-3.5 h-3.5 inline mr-1" />{t._count?.extensions || 0} extensions</span>
              <span><Phone className="w-3.5 h-3.5 inline mr-1" />{t._count?.phoneNumbers || 0} numbers</span>
              <span><PhoneCall className="w-3.5 h-3.5 inline mr-1" />{t._count?.callLogs || 0} calls</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button onClick={() => navigate(`/admin/tenant/${t.id}/extensions`)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium flex items-center gap-1">
                <Hash className="w-3 h-3" /> Extensions
              </button>
              <button onClick={() => navigate(`/admin/tenant/${t.id}/phone-numbers`)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium flex items-center gap-1">
                <Phone className="w-3 h-3" /> Phone Numbers
              </button>
              <button onClick={() => navigate(`/admin/tenant/${t.id}/ivr`)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium flex items-center gap-1">
                <PhoneCall className="w-3 h-3" /> IVR Menus
              </button>
              <button onClick={() => navigate(`/admin/tenant/${t.id}/voicemail`)}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium flex items-center gap-1">
                <Voicemail className="w-3 h-3" /> Voicemail
              </button>
              <button onClick={() => navigate(`/admin/tenant/${t.id}/ai-settings`)}
                className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-medium flex items-center gap-1">
                <Settings className="w-3 h-3" /> AI Settings
              </button>
            </div>
          </div>
        ))}

        {tenants.length === 0 && (
          <div className="bg-white border rounded-lg p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No clients yet. Click "Add New Client" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
