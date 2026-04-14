import { useState, useEffect } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Palette, Upload } from 'lucide-react';

export default function BrandingPage() {
  const [branding, setBranding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ brandName: '', brandPrimaryColor: '#2563eb', brandSecondaryColor: '#1e40af', customCss: '' });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.get('/branding');
      setBranding(data);
      setForm({
        brandName: data.brandName || '', brandPrimaryColor: data.brandPrimaryColor || '#2563eb',
        brandSecondaryColor: data.brandSecondaryColor || '#1e40af', customCss: data.customCss || '',
      });
    } catch { toast.error('Failed to load branding'); }
    finally { setLoading(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      await api.put('/branding', form);
      // Apply colors immediately
      document.documentElement.style.setProperty('--brand-primary', form.brandPrimaryColor);
      toast.success('Branding updated');
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update'); }
  };

  const uploadLogo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('logo', file);
    try {
      await api.post('/branding/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Logo uploaded');
      load();
    } catch { toast.error('Failed to upload logo'); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Branding</h1>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Palette className="w-5 h-5 text-blue-500" /> Appearance</h2>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Brand Name</label>
            <input type="text" value={form.brandName} onChange={(e) => setForm({...form, brandName: e.target.value})} className="w-full px-3 py-2 border rounded-lg" placeholder="Your Company Name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Primary Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.brandPrimaryColor} onChange={(e) => setForm({...form, brandPrimaryColor: e.target.value})} className="w-10 h-10 border rounded cursor-pointer" />
                <input type="text" value={form.brandPrimaryColor} onChange={(e) => setForm({...form, brandPrimaryColor: e.target.value})} className="flex-1 px-3 py-2 border rounded-lg font-mono text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Secondary Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.brandSecondaryColor} onChange={(e) => setForm({...form, brandSecondaryColor: e.target.value})} className="w-10 h-10 border rounded cursor-pointer" />
                <input type="text" value={form.brandSecondaryColor} onChange={(e) => setForm({...form, brandSecondaryColor: e.target.value})} className="flex-1 px-3 py-2 border rounded-lg font-mono text-sm" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Custom CSS (advanced)</label>
            <textarea value={form.customCss} onChange={(e) => setForm({...form, customCss: e.target.value})} className="w-full px-3 py-2 border rounded-lg font-mono text-sm" rows={4} placeholder=":root { --brand-primary: #2563eb; }" />
          </div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Save Branding</button>
        </form>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Upload className="w-5 h-5 text-blue-500" /> Logo</h2>
        {branding?.brandLogo && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg">
            <img src={branding.brandLogo} alt="Logo" className="max-h-20 object-contain" />
          </div>
        )}
        <label className="inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition">
          <Upload className="w-4 h-4 text-gray-500" />
          <span className="text-sm">Upload Logo (PNG, JPG, SVG, max 2MB)</span>
          <input type="file" accept="image/*" onChange={uploadLogo} className="hidden" />
        </label>
      </div>

      {/* Preview */}
      <div className="mt-6 bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Preview</h2>
        <div className="rounded-lg overflow-hidden border">
          <div className="h-12 flex items-center px-4 text-white font-bold" style={{ backgroundColor: form.brandPrimaryColor }}>
            {form.brandName || 'Your Brand'}
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-600 mb-2">This is how your dashboard header will look.</p>
            <button className="px-4 py-2 text-white text-sm rounded" style={{ backgroundColor: form.brandPrimaryColor }}>Primary Button</button>
            <button className="px-4 py-2 text-white text-sm rounded ml-2" style={{ backgroundColor: form.brandSecondaryColor }}>Secondary Button</button>
          </div>
        </div>
      </div>
    </div>
  );
}
