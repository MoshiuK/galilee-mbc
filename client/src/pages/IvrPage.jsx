import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/common/DataTable';
import Modal from '../components/common/Modal';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, ListTree } from 'lucide-react';

const ACTION_TYPES = [
  { value: 'extension', label: 'Extension' },
  { value: 'ring_group', label: 'Ring Group' },
  { value: 'queue', label: 'Call Queue' },
  { value: 'ivr_menu', label: 'Sub-Menu (IVR)' },
  { value: 'external', label: 'External Number' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'repeat', label: 'Repeat Menu' },
  { value: 'hangup', label: 'Hang Up' },
];

const emptyForm = {
  name: '', greetingType: 'tts', greetingText: '', timeout: 5, maxRetries: 3,
  invalidMessage: 'That is not a valid option. Please try again.',
  timeoutMessage: 'We did not receive your selection.',
  options: [],
};

const emptyOption = { digit: '', label: '', actionType: 'extension', actionTarget: '' };

export default function IvrPage() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { const { data } = await api.get('/ivr'); setMenus(data); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, options: [{ ...emptyOption }] });
    setModalOpen(true);
  };

  const openEdit = (menu) => {
    setEditing(menu);
    setForm({
      name: menu.name, greetingType: menu.greetingType, greetingText: menu.greetingText || '',
      timeout: menu.timeout, maxRetries: menu.maxRetries,
      invalidMessage: menu.invalidMessage || '', timeoutMessage: menu.timeoutMessage || '',
      options: menu.options.length > 0 ? menu.options.map(o => ({
        digit: o.digit, label: o.label, actionType: o.actionType, actionTarget: o.actionTarget || '',
      })) : [{ ...emptyOption }],
    });
    setModalOpen(true);
  };

  const addOption = () => setForm({ ...form, options: [...form.options, { ...emptyOption }] });
  const removeOption = (idx) => setForm({ ...form, options: form.options.filter((_, i) => i !== idx) });
  const updateOption = (idx, field, value) => {
    const opts = [...form.options];
    opts[idx] = { ...opts[idx], [field]: value };
    setForm({ ...form, options: opts });
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/ivr/${editing.id}`, form);
        toast.success('IVR menu updated');
      } else {
        await api.post('/ivr', form);
        toast.success('IVR menu created');
      }
      setModalOpen(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
  };

  const remove = async (menu) => {
    if (!confirm(`Delete IVR menu "${menu.name}"?`)) return;
    try { await api.delete(`/ivr/${menu.id}`); toast.success('Deleted'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  const columns = [
    { key: 'name', label: 'Name', render: (r) => <div className="flex items-center gap-2"><ListTree className="w-4 h-4 text-blue-500" /><span className="font-medium">{r.name}</span></div> },
    { key: 'greetingType', label: 'Greeting', render: (r) => <span className="capitalize">{r.greetingType}</span> },
    { key: 'options', label: 'Options', render: (r) => `${r.options.length} options` },
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
        <h1 className="text-2xl font-bold">IVR Menus</h1>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> New IVR Menu
        </button>
      </div>
      <DataTable columns={columns} data={menus} loading={loading} emptyMessage="No IVR menus configured" />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit IVR Menu' : 'New IVR Menu'} wide>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Menu Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}
              placeholder="e.g. Main Menu" className="w-full px-3 py-2 border rounded-lg" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Greeting Type</label>
            <select value={form.greetingType} onChange={(e) => setForm({...form, greetingType: e.target.value})} className="w-full px-3 py-2 border rounded-lg">
              <option value="tts">Text-to-Speech</option>
              <option value="recording">Audio Recording</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Greeting Text</label>
            <textarea value={form.greetingText} onChange={(e) => setForm({...form, greetingText: e.target.value})}
              rows={3} placeholder="Thank you for calling. Press 1 for sales..."
              className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Timeout (seconds)</label>
              <input type="number" value={form.timeout} onChange={(e) => setForm({...form, timeout: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded-lg" min={1} max={30} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Retries</label>
              <input type="number" value={form.maxRetries} onChange={(e) => setForm({...form, maxRetries: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border rounded-lg" min={1} max={10} />
            </div>
          </div>

          {/* Menu Options */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">Menu Options</h3>
              <button type="button" onClick={addOption} className="text-sm text-blue-600 hover:text-blue-700">+ Add Option</button>
            </div>
            <div className="space-y-3">
              {form.options.map((opt, idx) => (
                <div key={idx} className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg">
                  <div className="w-16">
                    <label className="text-xs text-gray-500">Digit</label>
                    <select value={opt.digit} onChange={(e) => updateOption(idx, 'digit', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm">
                      <option value="">--</option>
                      {['1','2','3','4','5','6','7','8','9','0','*','#'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Label</label>
                    <input type="text" value={opt.label} onChange={(e) => updateOption(idx, 'label', e.target.value)}
                      placeholder="Sales" className="w-full px-2 py-1.5 border rounded text-sm" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Action</label>
                    <select value={opt.actionType} onChange={(e) => updateOption(idx, 'actionType', e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm">
                      {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Target</label>
                    <input type="text" value={opt.actionTarget} onChange={(e) => updateOption(idx, 'actionTarget', e.target.value)}
                      placeholder="ID" className="w-full px-2 py-1.5 border rounded text-sm" />
                  </div>
                  <button type="button" onClick={() => removeOption(idx)} className="mt-5 p-1 text-red-500 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              {editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
