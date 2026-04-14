import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function TenantFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', slug: '', plan: 'basic', maxExtensions: 50, maxPhoneNumbers: 10,
    adminEmail: '', adminPassword: '', adminFirstName: '', adminLastName: '',
    swProjectId: '', swApiToken: '', swSpaceUrl: '',
    brandName: '', brandPrimaryColor: '#2563eb', brandSecondaryColor: '#1e40af',
  });
  const [saving, setSaving] = useState(false);

  const autoSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      // Remove empty SignalWire fields
      if (!payload.swProjectId) delete payload.swProjectId;
      if (!payload.swApiToken) delete payload.swApiToken;
      if (!payload.swSpaceUrl) delete payload.swSpaceUrl;

      await api.post('/tenants', payload);
      toast.success('Tenant created successfully');
      navigate('/admin/tenants');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create tenant');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">New Tenant</h1>
      <form onSubmit={save} className="space-y-6">
        {/* Business Info */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Business Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Business Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value, slug: autoSlug(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug (URL identifier)</label>
                <input type="text" value={form.slug} onChange={(e) => setForm({...form, slug: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg font-mono" required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Plan</label>
                <select value={form.plan} onChange={(e) => setForm({...form, plan: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                  <option value="basic">Basic</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Extensions</label>
                <input type="number" value={form.maxExtensions} onChange={(e) => setForm({...form, maxExtensions: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg" min={1} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Max Phone Numbers</label>
                <input type="number" value={form.maxPhoneNumbers} onChange={(e) => setForm({...form, maxPhoneNumbers: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg" min={1} />
              </div>
            </div>
          </div>
        </div>

        {/* Admin User */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Initial Admin User</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">First Name</label>
                <input type="text" value={form.adminFirstName} onChange={(e) => setForm({...form, adminFirstName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-medium mb-1">Last Name</label>
                <input type="text" value={form.adminLastName} onChange={(e) => setForm({...form, adminLastName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Email</label>
                <input type="email" value={form.adminEmail} onChange={(e) => setForm({...form, adminEmail: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required /></div>
              <div><label className="block text-sm font-medium mb-1">Password</label>
                <input type="password" value={form.adminPassword} onChange={(e) => setForm({...form, adminPassword: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required minLength={8} /></div>
            </div>
          </div>
        </div>

        {/* SignalWire (optional) */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-1">SignalWire Credentials (Optional)</h2>
          <p className="text-sm text-gray-500 mb-4">Leave blank to use platform-level SignalWire project.</p>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium mb-1">Project ID</label>
              <input type="text" value={form.swProjectId} onChange={(e) => setForm({...form, swProjectId: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">API Token</label>
              <input type="password" value={form.swApiToken} onChange={(e) => setForm({...form, swApiToken: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
            <div><label className="block text-sm font-medium mb-1">Space URL</label>
              <input type="text" value={form.swSpaceUrl} onChange={(e) => setForm({...form, swSpaceUrl: e.target.value})} placeholder="yourspace.signalwire.com" className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          </div>
        </div>

        {/* Branding */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Branding</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="block text-sm font-medium mb-1">Brand Name</label>
              <input type="text" value={form.brandName} onChange={(e) => setForm({...form, brandName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" /></div>
            <div>
              <label className="block text-sm font-medium mb-1">Primary Color</label>
              <div className="flex gap-2"><input type="color" value={form.brandPrimaryColor} onChange={(e) => setForm({...form, brandPrimaryColor: e.target.value})} className="w-10 h-10 rounded" />
                <input type="text" value={form.brandPrimaryColor} onChange={(e) => setForm({...form, brandPrimaryColor: e.target.value})} className="flex-1 px-2 py-1 border rounded font-mono text-sm" /></div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Secondary Color</label>
              <div className="flex gap-2"><input type="color" value={form.brandSecondaryColor} onChange={(e) => setForm({...form, brandSecondaryColor: e.target.value})} className="w-10 h-10 rounded" />
                <input type="text" value={form.brandSecondaryColor} onChange={(e) => setForm({...form, brandSecondaryColor: e.target.value})} className="flex-1 px-2 py-1 border rounded font-mono text-sm" /></div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/admin/tenants')} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creating...' : 'Create Tenant'}
          </button>
        </div>
      </form>
    </div>
  );
}
