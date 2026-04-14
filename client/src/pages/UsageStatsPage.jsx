import { useState, useEffect } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { BarChart3, PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Voicemail } from 'lucide-react';

export default function UsageStatsPage() {
  const [stats, setStats] = useState(null);
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [days]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/usage-stats?days=${days}`);
      setStats(data);
    } catch { toast.error('Failed to load stats'); }
    finally { setLoading(false); }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  const t = stats?.totals || {};

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Usage Statistics</h1>
        <select value={days} onChange={(e) => setDays(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={PhoneCall} label="Total Calls" value={t.totalCalls} color="blue" />
        <StatCard icon={PhoneIncoming} label="Inbound" value={t.inboundCalls} color="green" />
        <StatCard icon={PhoneOutgoing} label="Outbound" value={t.outboundCalls} color="purple" />
        <StatCard icon={PhoneMissed} label="Missed" value={t.missedCalls} color="red" />
        <StatCard icon={Clock} label="Total Minutes" value={t.totalMinutes} color="orange" />
        <StatCard icon={BarChart3} label="Answer Rate" value={`${t.answerRate || 0}%`} color="teal" />
        <StatCard icon={PhoneCall} label="Answered" value={t.answeredCalls} color="green" />
        <StatCard icon={Voicemail} label="Voicemails" value={t.voicemailCount} color="blue" />
      </div>

      {/* Daily breakdown */}
      {stats?.daily && stats.daily.length > 0 && (
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold mb-4">Daily Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Inbound</th>
                  <th className="pb-2 font-medium text-right">Outbound</th>
                  <th className="pb-2 font-medium text-right">Answered</th>
                  <th className="pb-2 font-medium text-right">Missed</th>
                  <th className="pb-2 font-medium text-right">Minutes</th>
                </tr>
              </thead>
              <tbody>
                {stats.daily.map(d => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(d.date).toLocaleDateString()}</td>
                    <td className="py-2 text-right font-medium">{d.totalCalls}</td>
                    <td className="py-2 text-right">{d.inboundCalls}</td>
                    <td className="py-2 text-right">{d.outboundCalls}</td>
                    <td className="py-2 text-right text-green-600">{d.answeredCalls}</td>
                    <td className="py-2 text-right text-red-500">{d.missedCalls}</td>
                    <td className="py-2 text-right">{d.totalMinutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600', orange: 'bg-orange-50 text-orange-600',
    red: 'bg-red-50 text-red-600', teal: 'bg-teal-50 text-teal-600',
  };
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color] || colors.blue}`}><Icon className="w-5 h-5" /></div>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-xl font-bold">{value ?? 0}</p>
        </div>
      </div>
    </div>
  );
}
