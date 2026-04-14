import { useState, useEffect } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Bell, PhoneOff, Voicemail, FileText, Trash2, CheckCheck, Info } from 'lucide-react';

const ICONS = {
  missed_call: PhoneOff,
  new_voicemail: Voicemail,
  call_summary: FileText,
  message: Info,
  system: Bell,
};

const COLORS = {
  missed_call: 'text-red-500 bg-red-50',
  new_voicemail: 'text-blue-500 bg-blue-50',
  call_summary: 'text-purple-500 bg-purple-50',
  message: 'text-green-500 bg-green-50',
  system: 'text-gray-500 bg-gray-50',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => { load(); }, [filter]);

  const load = async () => {
    try {
      const params = filter ? `?type=${filter}` : '';
      const { data } = await api.get(`/notifications${params}`);
      setNotifications(data.notifications || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const markRead = async (n) => {
    try { await api.put(`/notifications/${n.id}/read`); load(); }
    catch { toast.error('Failed'); }
  };

  const markAllRead = async () => {
    try { await api.put('/notifications/read-all'); toast.success('All marked as read'); load(); }
    catch { toast.error('Failed'); }
  };

  const remove = async (n) => {
    try { await api.delete(`/notifications/${n.id}`); load(); }
    catch { toast.error('Failed'); }
  };

  const formatDate = (d) => new Date(d).toLocaleString();
  const unread = notifications.filter(n => !n.isRead).length;

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unread > 0 && <p className="text-sm text-gray-500">{unread} unread</p>}
        </div>
        <div className="flex gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
            <option value="">All Types</option>
            <option value="missed_call">Missed Calls</option>
            <option value="new_voicemail">Voicemail</option>
            <option value="call_summary">Call Summaries</option>
            <option value="message">Messages</option>
          </select>
          {unread > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50">
              <CheckCheck className="w-4 h-4" /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const Icon = ICONS[n.type] || Bell;
            const color = COLORS[n.type] || COLORS.system;
            return (
              <div key={n.id} className={`bg-white border rounded-lg p-4 ${!n.isRead ? 'border-blue-200' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${color}`}><Icon className="w-4 h-4" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</span>
                      {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
                  </div>
                  <div className="flex gap-1">
                    {!n.isRead && (
                      <button onClick={() => markRead(n)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400" title="Mark read">
                        <CheckCheck className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => remove(n)} className="p-1.5 hover:bg-gray-100 rounded text-red-400" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
