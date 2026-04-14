import { useState, useEffect } from 'react';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Play, Trash2, Mail, MailOpen, Voicemail } from 'lucide-react';

export default function VoicemailPage() {
  const [voicemails, setVoicemails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const { data } = await api.get('/voicemail'); setVoicemails(data); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const markRead = async (vm) => {
    try { await api.put(`/voicemail/${vm.id}/read`); load(); }
    catch { toast.error('Failed'); }
  };

  const remove = async (vm) => {
    if (!confirm('Delete this voicemail?')) return;
    try { await api.delete(`/voicemail/${vm.id}`); toast.success('Deleted'); load(); }
    catch { toast.error('Failed'); }
  };

  const formatDate = (d) => new Date(d).toLocaleString();
  const formatDuration = (s) => s ? `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}` : '-';

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  const unread = voicemails.filter(v => !v.isRead).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Voicemail</h1>
          {unread > 0 && <p className="text-sm text-gray-500">{unread} unread message{unread !== 1 ? 's' : ''}</p>}
        </div>
      </div>

      {voicemails.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center">
          <Voicemail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No voicemail messages</p>
        </div>
      ) : (
        <div className="space-y-2">
          {voicemails.map(vm => (
            <div key={vm.id} className={`bg-white border rounded-lg p-4 ${!vm.isRead ? 'border-blue-200 bg-blue-50/30' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  {vm.isRead ? <MailOpen className="w-5 h-5 text-gray-400" /> : <Mail className="w-5 h-5 text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono font-medium">{vm.callerNumber}</span>
                    {vm.callerName && <span className="text-sm text-gray-500">{vm.callerName}</span>}
                    <span className="text-xs text-gray-400">{formatDuration(vm.duration)}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Ext {vm.extension?.number} ({vm.extension?.name}) &mdash; {formatDate(vm.createdAt)}
                  </p>
                  {vm.transcription && <p className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">{vm.transcription}</p>}
                  {vm.recordingUrl && (
                    <audio controls className="mt-2 w-full max-w-md" src={vm.recordingUrl}>
                      Your browser does not support audio playback.
                    </audio>
                  )}
                </div>
                <div className="flex gap-1">
                  {!vm.isRead && (
                    <button onClick={() => markRead(vm)} className="p-1.5 hover:bg-gray-100 rounded text-gray-500" title="Mark read">
                      <MailOpen className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => remove(vm)} className="p-1.5 hover:bg-gray-100 rounded text-red-500" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
