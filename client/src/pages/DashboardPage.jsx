import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import api from '../api/client';
import { PhoneCall, PhoneIncoming, PhoneOutgoing, Clock, Voicemail, Users, Hash, Phone } from 'lucide-react';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isPlatform = user?.scope === 'platform';
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      if (isPlatform) {
        const { data } = await api.get('/platform/dashboard');
        setStats(data);
      } else {
        const { data } = await api.get('/call-logs/stats');
        setStats(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading...</div></div>;
  }

  if (isPlatform && stats) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Users} label="Total Tenants" value={stats.stats.tenantCount} color="blue" />
          <StatCard icon={Users} label="Total Users" value={stats.stats.totalUsers} color="green" />
          <StatCard icon={Hash} label="Total Extensions" value={stats.stats.totalExtensions} color="purple" />
          <StatCard icon={PhoneCall} label="Total Calls" value={stats.stats.totalCalls} color="orange" />
        </div>
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Recent Tenants</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">Name</th><th className="pb-2 font-medium">Slug</th>
                <th className="pb-2 font-medium">Plan</th><th className="pb-2 font-medium">Status</th>
              </tr></thead>
              <tbody>
                {stats.recentTenants.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{t.name}</td>
                    <td className="py-3 text-gray-500">{t.slug}</td>
                    <td className="py-3"><span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 capitalize">{t.plan}</span></td>
                    <td className="py-3">{t.active ? <span className="text-green-600">Active</span> : <span className="text-red-500">Inactive</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={PhoneCall} label="Calls Today" value={stats?.today || 0} color="blue" />
        <StatCard icon={PhoneIncoming} label="This Week" value={stats?.thisWeek || 0} color="green" />
        <StatCard icon={PhoneOutgoing} label="This Month" value={stats?.thisMonth || 0} color="purple" />
        <StatCard icon={Clock} label="Avg Duration" value={`${stats?.averageDuration || 0}s`} color="orange" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Call Volume</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Inbound</span>
              <span className="font-semibold">{stats?.byDirection?.inbound || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Outbound</span>
              <span className="font-semibold">{stats?.byDirection?.outbound || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Internal</span>
              <span className="font-semibold">{stats?.byDirection?.internal || 0}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t font-semibold">
              <span>Total</span>
              <span>{stats?.total || 0}</span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <QuickAction to="/extensions" icon={Hash} label="Extensions" />
            <QuickAction to="/phone-numbers" icon={Phone} label="Phone Numbers" />
            <QuickAction to="/ivr" icon={PhoneCall} label="IVR Menus" />
            <QuickAction to="/voicemail" icon={Voicemail} label="Voicemail" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-lg border p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-lg ${colors[color]}`}><Icon className="w-5 h-5" /></div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }) {
  return (
    <a href={to} className="flex items-center gap-2 p-3 rounded-lg border hover:bg-gray-50 transition text-sm font-medium">
      <Icon className="w-4 h-4 text-gray-500" /> {label}
    </a>
  );
}
