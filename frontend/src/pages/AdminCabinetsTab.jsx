import { useCallback, useEffect, useState, Fragment } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

const STATUS_CLASS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

function CabinetBadge({ status, isOffline }) {
  if (isOffline) {
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600 border border-gray-300">OFFLINE</span>;
  }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASS[status] || 'bg-surface-container-high text-on-surface-variant'}`}>{status}</span>;
}

export default function AdminCabinetsTab() {
  const [data, setData] = useState({ cabinets: [], total: 0 });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setMessage('');
    const q = new URLSearchParams({ limit: '50', ...(status ? { status } : {}) });
    fetch(`/api/admin/cabinets?${q}`, { credentials: 'include' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setMessage('Could not load cabinets'))
      .finally(() => setLoading(false));
  }, [status]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const update = async (id, action) => {
    setBusyId(id);
    setMessage('');
    try {
      const res = await fetch('/api/admin/cabinets', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const body = await res.json();
      if (!res.ok) setMessage(body.error || 'Update failed');
      load();
    } finally {
      setBusyId(null);
    }
  };

  const [deletingCabinet, setDeletingCabinet] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDeleteCabinet = async () => {
    if (!deletingCabinet) return;
    setDeleting(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/cabinets?id=${deletingCabinet.id}`, { method: 'DELETE', credentials: 'include' });
      const body = await res.json();
      if (!res.ok) setMessage(body.error || 'Delete failed');
      load();
      setDeletingCabinet(null);
    } catch {
      setMessage('Network error, failed to delete cabinet.');
    } finally {
      setDeleting(false);
    }
  };
  const [editingZoneCabinet, setEditingZoneCabinet] = useState(null);
  const [newZone, setNewZone] = useState('');
  const [zoneUpdating, setZoneUpdating] = useState(false);

  const handleUpdateCabinetZone = async () => {
    if (!editingZoneCabinet || !newZone.trim()) return;
    setZoneUpdating(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cabinetId: editingZoneCabinet.id, zone: newZone }),
      });
      const body = await res.json();
      if (!res.ok) setMessage(body.error || 'Update zone failed');
      else {
        setEditingZoneCabinet(null);
        setNewZone('');
        load();
      }
    } catch {
      setMessage('Network error, failed to update zone.');
    } finally {
      setZoneUpdating(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6 bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-sm items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-3 flex-1 w-full">
          <div className="relative w-full sm:w-auto sm:max-w-sm">
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2.5 pr-10 appearance-none rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md font-medium focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
              <option value="">All Cabinets</option>
              <option>PENDING</option>
              <option>APPROVED</option>
              <option>REJECTED</option>
            </select>
            <span className="material-symbols-outlined absolute right-4 top-3 text-on-surface-variant pointer-events-none" style={{fontSize:'20px'}}>expand_more</span>
          </div>
          {message && <span className="text-body-md text-error font-medium w-full sm:w-auto text-center sm:text-left">{message}</span>}
        </div>
        <button onClick={load} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm">
          <span className="material-symbols-outlined" style={{fontSize:'20px'}}>refresh</span>
          Refresh
        </button>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm responsive-table table-cabinets">
            <thead className="bg-surface-container-low border-b border-outline-variant/10">
              <tr>
                {['Identity', 'Cabinet Code', 'Compartments', 'Status', 'Last Seen', 'DB Lockers', 'Actions'].map((h, i) => (
                  <th key={h} className={`text-left px-5 py-4 text-label-md text-on-surface-variant font-bold whitespace-nowrap ${i > 0 ? 'hidden lg:table-cell' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr><td colSpan={7} className="py-8"><div className="flex justify-center text-on-surface-variant font-medium">Loading...</div></td></tr>
              ) : (!data.cabinets || data.cabinets.length === 0) ? (
                <tr><td colSpan={7} className="py-8"><div className="flex justify-center text-on-surface-variant font-medium">No cabinets found.</div></td></tr>
              ) : data.cabinets.map((cabinet) => {
                const isOffline = cabinet.status === 'APPROVED' && (!cabinet.lastSeenAt || (new Date() - new Date(cabinet.lastSeenAt) > 10000));
                return (
                  <Fragment key={cabinet.id}>
                  <tr onClick={() => setExpandedId(expandedId === cabinet.id ? null : cabinet.id)} className="hover:bg-surface-container-low transition-colors cursor-pointer lg:cursor-default">
                    <td className={`px-5 py-4 font-mono font-bold text-primary flex justify-between items-center lg:table-cell ${isOffline ? 'opacity-50' : ''}`}>
                      <span>{cabinet.identity}</span>
                      <span className="material-symbols-outlined lg:hidden text-on-surface-variant">{expandedId === cabinet.id ? 'expand_less' : 'expand_more'}</span>
                    </td>
                    <td className={`hidden lg:table-cell px-5 py-3 font-mono text-on-surface-variant font-medium ${isOffline ? 'opacity-50' : ''}`}>{cabinet.cabinetCode}</td>
                    <td className={`hidden lg:table-cell px-5 py-3 text-on-surface-variant font-medium ${isOffline ? 'opacity-50' : ''}`}>{cabinet.compartmentCount}</td>
                    <td className="hidden lg:table-cell px-5 py-3"><CabinetBadge status={cabinet.status} isOffline={isOffline} /></td>
                    <td className={`hidden lg:table-cell px-5 py-3 text-on-surface-variant text-xs font-medium ${isOffline ? 'opacity-50' : ''}`}>{cabinet.lastSeenAt ? new Date(cabinet.lastSeenAt).toLocaleString() : '-'}</td>
                    <td className={`hidden lg:table-cell px-5 py-3 text-on-surface-variant font-medium ${isOffline ? 'opacity-50' : ''}`}>{cabinet._count?.lockers || 0}</td>
                    <td className="hidden lg:table-cell px-5 py-3">
                      <div className="flex flex-nowrap gap-2 overflow-x-auto overflow-y-hidden max-w-full pb-1 scrollbar-hide">
                        {cabinet.status === 'APPROVED' && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); update(cabinet.id, 'unlock_all'); }} disabled={busyId === cabinet.id || isOffline}
                              className="px-3 py-1.5 rounded-lg bg-teal-100 text-teal-700 text-xs font-bold hover:bg-teal-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">
                              Unlock All
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); update(cabinet.id, 'lock_all'); }} disabled={busyId === cabinet.id || isOffline}
                              className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold hover:bg-amber-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">
                              Lock All
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setEditingZoneCabinet(cabinet); }} disabled={busyId === cabinet.id || isOffline}
                              className="px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold hover:bg-indigo-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">
                              Edit Zone
                            </button>
                          </>
                        )}
                        {cabinet.status !== 'APPROVED' && (
                          <button onClick={(e) => { e.stopPropagation(); update(cabinet.id, 'approve'); }} disabled={busyId === cabinet.id}
                            className="px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-xs font-bold hover:bg-green-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">
                            Approve
                          </button>
                        )}
                        {cabinet.status === 'PENDING' && (
                          <button onClick={(e) => { e.stopPropagation(); update(cabinet.id, 'reject'); }} disabled={busyId === cabinet.id}
                            className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">
                            Reject
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); setDeletingCabinet(cabinet); }} disabled={busyId === cabinet.id}
                          className="px-3 py-1.5 rounded-lg border border-outline-variant/60 text-on-surface-variant text-xs font-bold hover:bg-surface-container-low hover:text-red-600 hover:border-red-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === cabinet.id && (
                    <tr className="lg:hidden bg-surface-container-low/50">
                      <td className="px-5 py-4 border-t border-outline-variant/10" colSpan={1}>
                        <div className="flex flex-col gap-3">
                          <div className={`flex justify-between items-center ${isOffline ? 'opacity-50' : ''}`}><span className="text-xs text-on-surface-variant font-bold uppercase">Status</span><CabinetBadge status={cabinet.status} isOffline={isOffline} /></div>
                          <div className={`flex justify-between items-center ${isOffline ? 'opacity-50' : ''}`}><span className="text-xs text-on-surface-variant font-bold uppercase">Cabinet Code</span><span className="font-mono text-sm">{cabinet.cabinetCode}</span></div>
                          <div className={`flex justify-between items-center ${isOffline ? 'opacity-50' : ''}`}><span className="text-xs text-on-surface-variant font-bold uppercase">Compartments</span><span className="text-sm font-medium">{cabinet.compartmentCount}</span></div>
                          <div className={`flex justify-between items-center ${isOffline ? 'opacity-50' : ''}`}><span className="text-xs text-on-surface-variant font-bold uppercase">DB Lockers</span><span className="text-sm font-medium">{cabinet._count?.lockers || 0}</span></div>
                          <div className={`flex justify-between items-center ${isOffline ? 'opacity-50' : ''}`}><span className="text-xs text-on-surface-variant font-bold uppercase">Last Seen</span><span className="text-xs font-medium">{cabinet.lastSeenAt ? new Date(cabinet.lastSeenAt).toLocaleString() : '-'}</span></div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {cabinet.status === 'APPROVED' && (
                              <>
                                <button onClick={() => update(cabinet.id, 'unlock_all')} disabled={busyId === cabinet.id || isOffline} className="flex-1 px-3 py-2 rounded-lg bg-teal-100 text-teal-700 text-xs font-bold hover:bg-teal-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">Unlock All</button>
                                <button onClick={() => update(cabinet.id, 'lock_all')} disabled={busyId === cabinet.id || isOffline} className="flex-1 px-3 py-2 rounded-lg bg-amber-100 text-amber-700 text-xs font-bold hover:bg-amber-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">Lock All</button>
                                <button onClick={() => setEditingZoneCabinet(cabinet)} disabled={busyId === cabinet.id || isOffline} className="flex-1 px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold hover:bg-indigo-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">Edit Zone</button>
                              </>
                            )}
                            {cabinet.status !== 'APPROVED' && <button onClick={() => update(cabinet.id, 'approve')} disabled={busyId === cabinet.id} className="flex-1 px-3 py-2 rounded-lg bg-green-100 text-green-700 text-xs font-bold hover:bg-green-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">Approve</button>}
                            {cabinet.status === 'PENDING' && <button onClick={() => update(cabinet.id, 'reject')} disabled={busyId === cabinet.id} className="flex-1 px-3 py-2 rounded-lg bg-red-100 text-red-700 text-xs font-bold hover:bg-red-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">Reject</button>}
                            <button onClick={() => setDeletingCabinet(cabinet)} disabled={busyId === cabinet.id} className="w-full px-3 py-2 rounded-lg border border-outline-variant/60 text-on-surface-variant text-xs font-bold hover:bg-surface-container-low hover:text-red-600 hover:border-red-200 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">Delete</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-outline-variant/10 text-label-md font-medium text-on-surface-variant bg-surface-container-low/30">Total: {data.total} cabinets</div>
      </div>

      <ConfirmDialog
        isOpen={!!deletingCabinet}
        title="Delete Cabinet"
        message={`Are you sure you want to delete cabinet "${deletingCabinet?.identity}"? The physical ESP32 cabinet will need to be reset after this action.`}
        confirmText="Delete Cabinet"
        loading={deleting}
        onConfirm={handleConfirmDeleteCabinet}
        onClose={()=>setDeletingCabinet(null)}
      />

      {/* Edit Zone Modal */}
      {editingZoneCabinet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-card border border-outline-variant/10 transform scale-100 transition-all">
            <h3 className="text-title-lg font-bold text-on-surface mb-2">Edit Cabinet Zone</h3>
            <p className="text-body-md text-on-surface-variant mb-4">
              Enter the new zone for all lockers in cabinet <span className="font-mono font-semibold text-primary">{editingZoneCabinet.identity}</span>.
            </p>
            <input
              type="text"
              value={newZone}
              onChange={(e) => setNewZone(e.target.value.toUpperCase())}
              placeholder="e.g. ZONE-A"
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-secondary mb-6 font-mono"
              maxLength={10}
              disabled={zoneUpdating}
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setEditingZoneCabinet(null); setNewZone(''); }}
                disabled={zoneUpdating}
                className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-lg font-semibold hover:bg-surface-container-low active:scale-95 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateCabinetZone}
                disabled={zoneUpdating || !newZone.trim()}
                className="px-5 py-2.5 rounded-xl bg-secondary text-white text-label-lg font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {zoneUpdating ? 'Saving...' : 'Save Zone'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
