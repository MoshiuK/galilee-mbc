import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import toast from 'react-hot-toast';
import { Plus, Trash2, Building2, Search } from 'lucide-react';

export default function PlatformAdminPage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => { load(); }, [page, search]);

  const load = async () => {
    try {
      const params = new URLSearchParams({ page, limit: 25 });
      if (search) params.set('search', search);
      const { data } = await api.get(`/tenants?${params}`);
      setTenants(data.tenants); setTotalPages(data.pages);
    } catch { toast.error('Failed to load tenants'); }
    finally { setLoading(false); }
  };

  const remove = async (t) => {
    if (!confirm(`Delete tenant "${t.name}"? This will remove ALL data for this business.`)) return;
    try { await api.delete(`/tenants/${t.id}`); toast.success('Tenant deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (r) => (
      <div className="flex items-center gap-2">
        <Building2 className="w-4 h-4 text-blue-500" />
        <span className="font-medium">{r.name}</span>
      </div>
    )},
    { key: 'slug', label: 'Slug', render: (r) => <span className="font-mono text-sm text-gray-500">{r.slug}</span> },
    { key: 'plan', label: 'Plan', render: (r) => <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 capitalize">{r.plan}</span> },
    { key: 'users', label: 'Users', render: (r) => r._count?.users || 0 },
    { key: 'extensions', label: 'Extensions', render: (r) => r._count?.extensions || 0 },
    { key: 'numbers', label: 'Numbers', render: (r) => r._count?.phoneNumbers || 0 },
    { key: 'active', label: 'Status', render: (r) => r.active
      ? <span className="text-green-600 text-xs font-medium">Active</span>
      : <span className="text-red-500 text-xs">Inactive</span>
    },
    { key: 'actions', label: '', render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); remove(r); }} className="p-1 hover:bg-gray-100 rounded">
        <Trash2 className="w-4 h-4 text-red-500" />
      </button>
    )},
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tenants</h1>
        <button onClick={() => navigate('/admin/tenants/new')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New Tenant
        </button>
      </div>
      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search tenants..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
      </div>
      <DataTable columns={columns} data={tenants} loading={loading} emptyMessage="No tenants yet" />
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="px-3 py-1 border rounded text-sm disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}
