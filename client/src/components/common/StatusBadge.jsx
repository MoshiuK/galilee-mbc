const STATUS_STYLES = {
  active: 'bg-green-100 text-green-700',
  disabled: 'bg-gray-100 text-gray-600',
  completed: 'bg-green-100 text-green-700',
  'in-progress': 'bg-blue-100 text-blue-700',
  ringing: 'bg-yellow-100 text-yellow-700',
  'no-answer': 'bg-orange-100 text-orange-700',
  busy: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-600',
  inbound: 'bg-blue-100 text-blue-700',
  outbound: 'bg-purple-100 text-purple-700',
  internal: 'bg-gray-100 text-gray-600',
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full capitalize ${style}`}>
      {status}
    </span>
  );
}
