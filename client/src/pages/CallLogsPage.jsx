import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import StatusBadge from '../components/common/StatusBadge';
import { PhoneIncoming, PhoneOutgoing, Phone } from 'lucide-react';

export default function CallLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ direction: '', status: '', startDate: '', endDate: '' });

  useEffect(() => { load(); }, [page, filters]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (filters.direction) params.set('direction', filters.direction);
      if (filters.status) params.set('status', filters.status);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      const { data } = await api.get(`/call-logs?${params}`);
      setLogs(data.logs); setTotalPages(data.pages);
    } catch {} finally { setLoading(false); }
  };

  const dirIcon = (d) => {
    if (d === 'inbound') return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
    if (d === 'outbound') return <PhoneOutgoing className="w-4 h-4 text-purple-500" />;
    return <Phone className="w-4 h-4 text-gray-400" />;
  };

  const formatDuration = (s) => {
    if (!s) return '-';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleString();
  };

  const columns = [
    { key: 'direction', label: '', render: (r) => dirIcon(r.direction) },
    { key: 'callerNumber', label: 'From', render: (r) => <span className="font-mono text-sm">{r.callerNumber}</span> },
    { key: 'calledNumber', label: 'To', render: (r) => <span className="font-mono text-sm">{r.calledNumber}</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'duration', label: 'Duration', render: (r) => formatDuration(r.duration) },
    { key: 'startedAt', label: 'Date', render: (r) => formatDate(r.startedAt) },
    { key: 'ext', label: 'Extension', render: (r) => r.inboundExt?.number || r.outboundExt?.number || '-' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Call Logs</h1>
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filters.direction} onChange={(e) => { setFilters({...filters, direction: e.target.value}); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Directions</option><option value="inbound">Inbound</option><option value="outbound">Outbound</option><option value="internal">Internal</option>
        </select>
        <select value={filters.status} onChange={(e) => { setFilters({...filters, status: e.target.value}); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="">All Statuses</option><option value="completed">Completed</option><option value="no-answer">No Answer</option><option value="busy">Busy</option><option value="failed">Failed</option>
        </select>
        <input type="date" value={filters.startDate} onChange={(e) => { setFilters({...filters, startDate: e.target.value}); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm" />
        <input type="date" value={filters.endDate} onChange={(e) => { setFilters({...filters, endDate: e.target.value}); setPage(1); }}
          className="px-3 py-2 border rounded-lg text-sm" />
      </div>
      <DataTable columns={columns} data={logs} loading={loading} emptyMessage="No call logs found" />
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
