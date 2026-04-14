import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Clock } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TimeConditionsPage() {
  const [conditions, setConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', timezone: 'America/New_York', matchType: 'ivr', matchTarget: '',
    noMatchType: 'voicemail', noMatchTarget: '',
    schedules: DAYS.map((_, i) => ({ dayOfWeek: i, startTime: '09:00', endTime: '17:00', enabled: i >= 1 && i <= 5 })),
  });

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const { data } = await api.get('/time-conditions'); setConditions(data); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '', timezone: 'America/New_York', matchType: 'ivr', matchTarget: '',
      noMatchType: 'voicemail', noMatchTarget: '',
      schedules: DAYS.map((_, i) => ({ dayOfWeek: i, startTime: '09:00', endTime: '17:00', enabled: i >= 1 && i <= 5 })),
    });
    setModalOpen(true);
  };

  const openEdit = (tc) => {
    setEditing(tc);
    const schedMap = {};
    tc.schedules.forEach(s => { schedMap[s.dayOfWeek] = s; });
    setForm({
      name: tc.name, timezone: tc.timezone, matchType: tc.matchType, matchTarget: tc.matchTarget || '',
      noMatchType: tc.noMatchType, noMatchTarget: tc.noMatchTarget || '',
      schedules: DAYS.map((_, i) => ({
        dayOfWeek: i,
        startTime: schedMap[i]?.startTime || '09:00',
        endTime: schedMap[i]?.endTime || '17:00',
        enabled: !!schedMap[i],
      })),
    });
    setModalOpen(true);
  };

  const updateSchedule = (idx, field, value) => {
    const s = [...form.schedules];
    s[idx] = { ...s[idx], [field]: value };
    setForm({ ...form, schedules: s });
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name, timezone: form.timezone,
      matchType: form.matchType, matchTarget: form.matchTarget,
      noMatchType: form.noMatchType, noMatchTarget: form.noMatchTarget,
      schedules: form.schedules.filter(s => s.enabled).map(s => ({
        dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime,
      })),
    };
    try {
      if (editing) { await api.put(`/time-conditions/${editing.id}`, payload); toast.success('Updated'); }
      else { await api.post('/time-conditions', payload); toast.success('Created'); }
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const remove = async (tc) => {
    if (!confirm(`Delete "${tc.name}"?`)) return;
    try { await api.delete(`/time-conditions/${tc.id}`); toast.success('Deleted'); load(); } catch { toast.error('Failed'); }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-500" /><span className="font-medium">{r.name}</span></div> },
    { key: 'timezone', label: 'Timezone' },
    { key: 'schedules', label: 'Open Days', render: (r) => r.schedules.map(s => DAYS[s.dayOfWeek]?.slice(0,3)).join(', ') || 'None' },
    { key: 'matchType', label: 'Open Route', render: (r) => <span className="capitalize">{r.matchType}</span> },
    { key: 'noMatchType', label: 'Closed Route', render: (r) => <span className="capitalize">{r.noMatchType}</span> },
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
        <h1 className="text-2xl font-bold">Time Conditions</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"><Plus className="w-4 h-4" /> New Condition</button>
      </div>
      <DataTable columns={columns} data={conditions} loading={loading} emptyMessage="No time conditions configured" />
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Time Condition' : 'New Time Condition'} wide>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Name</label><input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg" required /></div>
            <div><label className="block text-sm font-medium mb-1">Timezone</label>
              <select value={form.timezone} onChange={(e) => setForm({...form, timezone: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
                {['America/New_York','America/Chicago','America/Denver','America/Los_Angeles','America/Phoenix','Pacific/Honolulu','Europe/London','Europe/Paris','Asia/Tokyo'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select></div>
          </div>
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Schedule</h3>
            <div className="space-y-2">
              {form.schedules.map((s, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-28">
                    <input type="checkbox" checked={s.enabled} onChange={(e) => updateSchedule(idx, 'enabled', e.target.checked)} />
                    <span className="text-sm">{DAYS[idx]}</span>
                  </label>
                  {s.enabled && (
                    <>
                      <input type="time" value={s.startTime} onChange={(e) => updateSchedule(idx, 'startTime', e.target.value)} className="px-2 py-1 border rounded text-sm" />
                      <span className="text-gray-400">to</span>
                      <input type="time" value={s.endTime} onChange={(e) => updateSchedule(idx, 'endTime', e.target.value)} className="px-2 py-1 border rounded text-sm" />
                    </>
                  )}
                  {!s.enabled && <span className="text-sm text-gray-400">Closed</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t pt-4 grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium mb-2">During Open Hours</h3>
              <select value={form.matchType} onChange={(e) => setForm({...form, matchType: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm mb-2">
                <option value="ivr">IVR Menu</option><option value="extension">Extension</option><option value="ring_group">Ring Group</option><option value="queue">Queue</option><option value="external">External</option>
              </select>
              <input type="text" value={form.matchTarget} onChange={(e) => setForm({...form, matchTarget: e.target.value})} placeholder="Target ID" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div>
              <h3 className="font-medium mb-2">After Hours</h3>
              <select value={form.noMatchType} onChange={(e) => setForm({...form, noMatchType: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm mb-2">
                <option value="voicemail">Voicemail</option><option value="ivr">IVR Menu</option><option value="extension">Extension</option><option value="external">External</option><option value="hangup">Hang Up</option>
              </select>
              <input type="text" value={form.noMatchTarget} onChange={(e) => setForm({...form, noMatchTarget: e.target.value})} placeholder="Target ID" className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">{editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
