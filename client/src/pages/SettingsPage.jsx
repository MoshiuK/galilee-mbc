import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import api from '../api/client';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    if (pwForm.newPassword.length < 8) {
      return toast.error('Password must be at least 8 characters');
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success('Password changed');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <div className="space-y-2 text-sm">
          <div className="flex"><span className="w-24 text-gray-500">Name:</span><span className="font-medium">{user?.firstName ? `${user.firstName} ${user.lastName}` : user?.name}</span></div>
          <div className="flex"><span className="w-24 text-gray-500">Email:</span><span>{user?.email}</span></div>
          <div className="flex"><span className="w-24 text-gray-500">Role:</span><span className="capitalize">{user?.role}</span></div>
          {user?.tenantId && <div className="flex"><span className="w-24 text-gray-500">Tenant:</span><span>{user?.tenantName || user?.tenantId}</span></div>}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Change Password</h2>
        <form onSubmit={changePassword} className="space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <input type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({...pwForm, currentPassword: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({...pwForm, newPassword: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg" required minLength={8} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <input type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({...pwForm, confirmPassword: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
