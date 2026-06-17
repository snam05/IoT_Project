/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback, useMemo } from 'react';
import TopNavBar from '../components/TopNavBar';
import AdminCabinetsTab from './AdminCabinetsTab';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { key: 'overview', icon: 'dashboard', label: 'Overview' },
  { key: 'lockers', icon: 'grid_view', label: 'Lockers' },
  { key: 'cabinets', icon: 'dns', label: 'Cabinets' },
  { key: 'users', icon: 'group', label: 'Users' },
  { key: 'unlock-logs', icon: 'key', label: 'Unlock Logs' },
  { key: 'system-logs', icon: 'history', label: 'System Logs' },
];

const STATUS_COLOR = { AVAILABLE: '#E8F5E9', IN_USE: '#d8e2ff', MAINTENANCE: '#ffdad6' };
const STATUS_TEXT = { AVAILABLE: 'text-green-700', IN_USE: 'text-blue-700', MAINTENANCE: 'text-red-700' };

function Badge({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_TEXT[status]}`}
      style={{ backgroundColor: STATUS_COLOR[status] }}>
      {status}
    </span>
  );
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-outline-variant border-t-secondary rounded-full animate-spin" />;
}

function formatLockerId(lockerOrId) {
  if (!lockerOrId) return '';
  if (typeof lockerOrId === 'object') {
    const zone = lockerOrId.zone || '';
    const compNo = lockerOrId.compartmentNo;
    if (compNo != null) {
      return `${zone}-${String(compNo).padStart(3, '0')}`;
    }
    return lockerOrId.lockerId || '';
  }
  const [cabinetCode, compNoStr] = String(lockerOrId).split(':');
  const compNoParsed = Number(compNoStr);
  if (cabinetCode && !isNaN(compNoParsed)) {
    return `${cabinetCode}-${String(compNoParsed).padStart(3, '0')}`;
  }
  return lockerOrId;
}

// ── Overview Tab ──────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats', { credentials: 'include' }).then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const statCards = stats ? [
    { label: 'Total Lockers', value: stats.total, icon: 'grid_view', sub: stats.growth },
    { label: 'In Use', value: stats.inUse, icon: 'lock', sub: stats.capacity },
    { label: 'Available', value: stats.available, icon: 'lock_open', sub: 'Ready', color: 'text-green-600' },
    { label: 'Maintenance', value: stats.maintenance, icon: 'build', sub: 'Needs attention', color: 'text-red-500' },
  ] : [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {!stats ? Array.from({length:4}).map((_,i)=><div key={i} className="bg-surface-container-lowest rounded-2xl p-6 h-36 animate-pulse border border-outline-variant/10 shadow-sm"/>) :
          statCards.map(s => (
            <div key={s.label} className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/10 shadow-sm hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <span className="text-label-lg font-medium text-on-surface-variant">{s.label}</span>
                <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" style={{fontSize:'24px'}}>{s.icon}</span>
              </div>
              <div className={`text-display-md font-bold text-on-surface ${s.color||''}`}>{s.value}</div>
              <div className="text-body-sm font-medium text-on-surface-variant mt-2 bg-surface-container-low inline-block px-2.5 py-1 rounded-lg">{s.sub}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ── Lockers Tab ───────────────────────────────────────────────
function LockersTab() {
  const [data, setData] = useState({ lockers: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', cabinetId: '', zone: '' });
  const [cabinets, setCabinets] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

  const zones = useMemo(() => {
    const set = new Set();
    cabinets.forEach(c => {
      if (c.cabinetCode) {
        set.add(c.cabinetCode.slice(0, 10).toUpperCase());
      }
    });
    (data.lockers || []).forEach(l => {
      if (l.zone) {
        set.add(l.zone.toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [cabinets, data.lockers]);

  useEffect(() => {
    fetch('/api/admin/cabinets?limit=100', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setCabinets(d.cabinets || []))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ limit: '50', ...Object.fromEntries(Object.entries(filter).filter(([,v])=>v)) });
    fetch(`/api/admin/lockers?${q}`, { credentials: 'include' })
      .then(r => r.json()).then(setData).catch(()=>{}).finally(()=>setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (lockerId, status, action) => {
    setActionLoading(lockerId);
    await fetch('/api/admin/lockers', {
      method: 'PUT', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lockerId, status, action }),
    });
    load();
    setActionLoading(null);
  };

  const [editingFloorLocker, setEditingFloorLocker] = useState(null);
  const [newFloor, setNewFloor] = useState('');
  const [floorUpdating, setFloorUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleUpdateFloor = async () => {
    if (!editingFloorLocker || newFloor === '') return;
    setFloorUpdating(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/admin/lockers', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockerId: editingFloorLocker.lockerId, floor: parseInt(newFloor) }),
      });
      const body = await res.json();
      if (!res.ok) setErrorMsg(body.error || 'Update floor failed');
      else {
        setEditingFloorLocker(null);
        setNewFloor('');
        load();
      }
    } catch {
      setErrorMsg('Network error, failed to update floor.');
    } finally {
      setFloorUpdating(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-4 mb-6 bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-sm items-start lg:items-center">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
          <div className="relative">
            <select value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))}
              className="w-full px-4 py-2.5 appearance-none rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium">
              <option value="">All Status</option>
              <option>AVAILABLE</option><option>IN_USE</option><option>MAINTENANCE</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant pointer-events-none" style={{fontSize:'20px'}}>expand_more</span>
          </div>
          <div className="relative">
            <select value={filter.zone} onChange={e=>setFilter(f=>({...f,zone:e.target.value}))}
              className="w-full px-4 py-2.5 appearance-none rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium">
              <option value="">All Zones</option>
              {zones.map(z => (
                <option key={z} value={z}>{z}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant pointer-events-none" style={{fontSize:'20px'}}>expand_more</span>
          </div>
          <div className="relative">
            <select value={filter.cabinetId} onChange={e=>setFilter(f=>({...f,cabinetId:e.target.value}))}
              className="w-full px-4 py-2.5 appearance-none rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium">
              <option value="">All Cabinets</option>
              {cabinets.map(c => (
                <option key={c.id} value={c.id}>
                  {c.cabinetCode} ({c.identity})
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-3 top-3 text-on-surface-variant pointer-events-none" style={{fontSize:'20px'}}>expand_more</span>
          </div>
        </div>
        <button onClick={load} className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm">
          <span className="material-symbols-outlined" style={{fontSize:'20px'}}>refresh</span>
          Refresh
        </button>
      </div>
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm responsive-table table-lockers">
            <thead className="bg-surface-container-low border-b border-outline-variant/10">
              <tr>
                {['Locker ID','Zone','Floor','Status','Assigned User','Locked At','Actions'].map(h=>(
                  <th key={h} className="text-left px-5 py-4 text-label-md text-on-surface-variant font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8"><Spinner/></td></tr>
              ) : (!data.lockers || data.lockers.length === 0) ? (
                <tr><td colSpan={7} className="text-center py-8 text-on-surface-variant font-medium">No lockers found</td></tr>
              ) : data.lockers.map(l => {
                const isOffline = l.cabinet && (!l.cabinet.lastSeenAt || (new Date() - new Date(l.cabinet.lastSeenAt) > 10000));
                return (
                  <tr key={l.lockerId} className={`hover:bg-surface-container-low transition-colors ${isOffline ? 'opacity-40 bg-surface-container-lowest select-none' : ''}`}>
                    <td className="px-5 py-3 font-mono font-bold text-primary">{formatLockerId(l)}</td>
                    <td className="px-5 py-3 text-on-surface-variant font-medium">{l.zone}</td>
                    <td className="px-5 py-3 text-on-surface-variant font-medium">
                      <div className="flex items-center gap-1.5 group">
                        <span>{l.floor}</span>
                        <button onClick={() => { if (!isOffline) { setEditingFloorLocker(l); setNewFloor(String(l.floor)); } }}
                          disabled={isOffline}
                          title={isOffline ? "Cannot edit floor (offline)" : "Edit Floor"}
                          className={`p-1 rounded hover:bg-surface-container-high text-on-surface-variant/40 hover:text-primary active:scale-90 transition-all ${isOffline ? 'cursor-not-allowed opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {isOffline ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-600 border border-gray-300">OFFLINE</span>
                      ) : (
                        <Badge status={l.status}/>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {l.user?.role === 'ADMIN' ? (
                        <span className="text-red-600 font-bold">Admin</span>
                      ) : (
                        <span className="text-on-surface-variant font-medium">{l.user?.name || '—'}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant text-xs font-medium">{l.lockedAt ? new Date(l.lockedAt).toLocaleString() : '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        {l.status === 'IN_USE' && (
                          <button onClick={() => updateStatus(l.lockerId, 'AVAILABLE', 'unlock')}
                            disabled={actionLoading===l.lockerId || isOffline}
                            className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-semibold hover:bg-green-200 active:scale-95 transition-all disabled:opacity-50">
                            Unlock
                          </button>
                        )}
                        {l.status === 'AVAILABLE' && (
                          <>
                            <button onClick={() => updateStatus(l.lockerId, 'IN_USE', 'lock')}
                              disabled={actionLoading===l.lockerId || isOffline}
                              className="px-3 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold hover:bg-amber-200 active:scale-95 transition-all disabled:opacity-50">
                              Lock
                            </button>
                            <button onClick={() => updateStatus(l.lockerId, 'MAINTENANCE', null)}
                              disabled={actionLoading===l.lockerId || isOffline}
                              className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 active:scale-95 transition-all disabled:opacity-50">
                              Maintenance
                            </button>
                          </>
                        )}
                        {l.status === 'MAINTENANCE' && (
                          <button onClick={() => updateStatus(l.lockerId, 'AVAILABLE', null)}
                            disabled={actionLoading===l.lockerId || isOffline}
                            className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200 active:scale-95 transition-all disabled:opacity-50">
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-outline-variant/10 text-label-md font-medium text-on-surface-variant bg-surface-container-low/30">
          Total: {data.total} lockers
        </div>
      </div>
      {/* Edit Locker Floor Modal */}
      {editingFloorLocker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-card border border-outline-variant/10 transform scale-100 transition-all">
            <h3 className="text-title-lg font-bold text-on-surface mb-2">Edit Locker Floor</h3>
            <p className="text-body-md text-on-surface-variant mb-4">
              Enter the new floor number for locker <span className="font-mono font-semibold text-primary">{editingFloorLocker.lockerId}</span>.
            </p>
            <input
              type="number"
              value={newFloor}
              onChange={(e) => setNewFloor(e.target.value)}
              placeholder="e.g. 1"
              className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-secondary mb-2"
              min={0}
              max={100}
              disabled={floorUpdating}
              autoFocus
            />
            {errorMsg && <p className="text-body-sm text-red-600 mb-4">{errorMsg}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setEditingFloorLocker(null); setNewFloor(''); setErrorMsg(''); }}
                disabled={floorUpdating}
                className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-lg font-semibold hover:bg-surface-container-low active:scale-95 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateFloor}
                disabled={floorUpdating || newFloor === ''}
                className="px-5 py-2.5 rounded-xl bg-secondary text-white text-label-lg font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {floorUpdating ? 'Saving...' : 'Save Floor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────
function UsersTab() {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username:'', email:'', name:'', password:'', role:'USER' });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  // Password reset state
  const [resettingUser, setResettingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetting, setResetting] = useState(false);

  // User deletion state
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ limit: '50', ...(search ? {search} : {}) });
    fetch(`/api/admin/users?${q}`, { credentials: 'include' })
      .then(r=>r.json()).then(setData).catch(()=>{}).finally(()=>setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (id, isActive) => {
    await fetch(`/api/admin/users/${id}`, {
      method:'PUT', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ isActive: !isActive }),
    });
    load();
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/users/${deletingUser.id}`, { method:'DELETE', credentials:'include' });
      load();
      setDeletingUser(null);
    } catch {
      alert('Failed to delete user.');
    } finally {
      setDeleting(false);
    }
  };

  const createUser = async (e) => {
    e.preventDefault();
    setCreating(true); setMsg('');
    try {
      const res = await fetch('/api/admin/users', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (res.ok) { setMsg('User created!'); setShowCreate(false); setForm({username:'',email:'',name:'',password:'',role:'USER'}); load(); }
      else setMsg(d.error);
    } finally { setCreating(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetting(true); setResetMsg('');
    try {
      const res = await fetch(`/api/admin/users/${resettingUser.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const d = await res.json();
      if (res.ok) {
        alert(`Password for ${resettingUser.name} has been reset successfully!`);
        setResettingUser(null);
        setNewPassword('');
      } else {
        setResetMsg(d.error || 'Failed to reset password');
      }
    } catch {
      setResetMsg('Network error, please try again.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-center justify-between bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-sm">
        <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-md group">
          <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-on-surface-variant group-focus-within:text-primary transition-colors" style={{fontSize:'20px'}}>search</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users by name, email, username..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md font-medium focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"/>
        </div>
        <button onClick={() => setShowCreate(s=>!s)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm whitespace-nowrap">
          <span className="material-symbols-outlined" style={{fontSize:'20px'}}>{showCreate ? 'close' : 'person_add'}</span>
          {showCreate ? 'Close Form' : 'Add User'}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createUser} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-6 md:p-8 mb-6 shadow-sm">
          <h3 className="text-headline-sm text-primary font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined">person_add</span> Create New User
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            {[['username','Username','text'],['email','Email','email'],['name','Full Name','text'],['password','Password','password']].map(([k,l,t])=>(
              <div key={k}>
                <label className="text-label-md text-on-surface-variant mb-1.5 block font-medium">{l}</label>
                <input type={t} value={form[k]} required onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"/>
              </div>
            ))}
            <div>
              <label className="text-label-md text-on-surface-variant mb-1.5 block font-medium">Role</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all">
                <option>USER</option><option>ADMIN</option>
              </select>
            </div>
          </div>
          {msg && <p className="text-body-md text-error font-medium mb-5">{msg}</p>}
          <div className="flex flex-wrap gap-3 pt-5 border-t border-outline-variant/10">
            <button type="submit" disabled={creating}
              className="flex-1 md:flex-none px-6 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {creating ? 'Creating...' : 'Confirm Creation'}
            </button>
            <button type="button" onClick={()=>setShowCreate(false)}
              className="flex-1 md:flex-none px-6 py-2.5 rounded-xl border border-outline-variant/60 text-on-surface text-label-md font-bold hover:bg-surface-container-low active:scale-95 transition-all">
              Cancel
            </button>
          </div>
        </form>
      )}

      {resettingUser && (
        <form onSubmit={handleResetPassword} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 p-6 md:p-8 mb-6 shadow-sm">
          <h3 className="text-headline-sm text-primary font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined">lock_reset</span> Reset Password
          </h3>
          <p className="text-body-md text-on-surface-variant mb-5">Resetting password for <strong className="text-on-surface">{resettingUser.name}</strong> (@{resettingUser.username})</p>
          <div className="flex flex-col sm:flex-row gap-4 items-end max-w-xl mb-2">
            <div className="flex-1 w-full">
              <label className="text-label-md text-on-surface-variant mb-1.5 block font-medium">New Password</label>
              <input
                type="password"
                value={newPassword}
                required
                minLength={8}
                onChange={e=>setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="At least 8 characters"
              />
            </div>
          </div>
          {resetMsg && <p className="text-body-md text-error font-medium mt-3 mb-2">{resetMsg}</p>}
          <div className="flex flex-wrap gap-3 pt-5 mt-5 border-t border-outline-variant/10">
            <button type="submit" disabled={resetting}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">
              {resetting ? 'Resetting...' : 'Update Password'}
            </button>
            <button type="button" onClick={()=>{setResettingUser(null); setNewPassword(''); setResetMsg('');}}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-outline-variant/60 text-on-surface text-label-md font-bold hover:bg-surface-container-low transition-all whitespace-nowrap active:scale-95">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm responsive-table table-users">
            <thead className="bg-surface-container-low border-b border-outline-variant/10">
              <tr>
                {['Name','Username','Email','Role','Status','Created','Actions'].map(h=>(
                  <th key={h} className="text-left px-5 py-4 text-label-md text-on-surface-variant font-bold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? <tr><td colSpan={7} className="text-center py-8"><Spinner/></td></tr> :
                (!data.users || data.users.length === 0) ? (
                  <tr><td colSpan={7} className="text-center py-8 text-on-surface-variant font-medium">No users found</td></tr>
                ) : data.users.map(u => (
                  <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-5 py-3 font-bold text-primary">{u.name}</td>
                    <td className="px-5 py-3 font-mono text-on-surface-variant font-medium">{u.username}</td>
                    <td className="px-5 py-3 text-on-surface-variant font-medium">{u.email}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.role==='ADMIN'?'bg-purple-100 text-purple-700':'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.isActive?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant text-xs font-medium">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-nowrap gap-2">
                        <button onClick={()=>toggleActive(u.id, u.isActive)}
                          disabled={u.id === currentUser?.id}
                          title={u.id === currentUser?.id ? "You cannot deactivate your own account" : ""}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${u.isActive?'bg-yellow-100 text-yellow-700 hover:bg-yellow-200':'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={()=>setResettingUser(u)}
                          className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200 active:scale-95 transition-all">
                          Reset PW
                        </button>
                        <button onClick={()=>setDeletingUser(u)}
                          disabled={u.id === currentUser?.id}
                          title={u.id === currentUser?.id ? "You cannot delete your own account" : ""}
                          className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        <div className="px-5 py-4 border-t border-outline-variant/10 text-label-md font-medium text-on-surface-variant bg-surface-container-low/30">Total: {data.total} users</div>
      </div>

      <ConfirmDialog
        isOpen={!!deletingUser}
        title="Delete User"
        message={`Are you sure you want to delete user "${deletingUser?.name}"? This action is permanent and cannot be undone.`}
        confirmText="Delete User"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onClose={()=>setDeletingUser(null)}
      />
    </div>
  );
}

// ── Generic Log Table ─────────────────────────────────────────
// ── Generic Log Table ─────────────────────────────────────────
function LogTable({ endpoint, columns, rowFn, logTypeName, tableClassName }) {
  const [data, setData] = useState({ logs: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [inputPage, setInputPage] = useState('1');

  // Filtering states
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Auto-refresh state
  const [autoRefreshSecs, setAutoRefreshSecs] = useState(0); // 0 means off
  const [refreshCountdown, setRefreshCountdown] = useState(0);

  // Delete modal state
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearOption, setClearOption] = useState('all'); // 'all', '7days', '30days'
  const [clearing, setClearing] = useState(false);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch function
  const load = useCallback((showLoading = true) => {
    if (showLoading) setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    });

    fetch(`${endpoint}?${params}`, { credentials: 'include' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => {
        if (showLoading) setLoading(false);
      });
  }, [endpoint, page, debouncedSearch, startDate, endDate]);

  // Load when parameters change
  useEffect(() => {
    load(true);
  }, [load]);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefreshSecs <= 0) {
      setRefreshCountdown(0);
      return;
    }
    setRefreshCountdown(autoRefreshSecs);
    const interval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          load(false); // fetch silently
          return autoRefreshSecs;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [load, autoRefreshSecs]);

  useEffect(() => {
    setInputPage(String(page));
  }, [page]);

  const pageRange = useMemo(() => {
    const totalPages = data.pages || 1;
    const current = page;
    const range = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      let start = Math.max(1, current - 2);
      let end = Math.min(totalPages, current + 2);

      if (current <= 3) {
        start = 1;
        end = maxVisible;
      } else if (current >= totalPages - 2) {
        start = totalPages - maxVisible + 1;
        end = totalPages;
      }

      for (let i = start; i <= end; i++) range.push(i);
    }
    return range;
  }, [data.pages, page]);

  // Export to CSV
  const handleExportCSV = async () => {
    const params = new URLSearchParams({
      page: '1',
      limit: '10000',
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    });

    try {
      const res = await fetch(`${endpoint}?${params}`, { credentials: 'include' });
      const d = await res.json();
      if (!d.logs || d.logs.length === 0) {
        alert('No logs found to export.');
        return;
      }

      let csvContent = "data:text/csv;charset=utf-8,";
      
      if (endpoint.includes('lockers')) {
        csvContent += "Time,Locker ID,Zone,User,Action,Method\n";
        d.logs.forEach(log => {
          const time = new Date(log.timestamp).toISOString();
          const lockerId = log.lockerId || '';
          const zone = log.locker?.zone || '';
          const user = log.user?.name || 'Unknown';
          const action = log.action || '';
          const method = log.method || '';
          csvContent += `"${time}","${lockerId}","${zone}","${user}","${action}","${method}"\n`;
        });
      } else {
        csvContent += "Time,User,Action,Details,IP Address\n";
        d.logs.forEach(log => {
          const time = new Date(log.timestamp).toISOString();
          const user = log.user?.username || 'System';
          const action = log.action || '';
          const details = (log.details || '').replace(/"/g, '""');
          const ip = log.ipAddress || '';
          csvContent += `"${time}","${user}","${action}","${details}","${ip}"\n`;
        });
      }

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${logTypeName.toLowerCase().replace(/\s+/g, '_')}_export_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert('Failed to export logs: ' + err.message);
    }
  };

  // Clear/Delete Logs
  const handleClearLogs = async () => {
    setClearing(true);
    try {
      let beforeDate = '';
      if (clearOption === '7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        beforeDate = d.toISOString();
      } else if (clearOption === '30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        beforeDate = d.toISOString();
      }

      const params = new URLSearchParams(beforeDate ? { beforeDate } : {});
      const res = await fetch(`${endpoint}?${params}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await res.json();
      if (res.ok) {
        alert(`Successfully deleted ${d.count} logs.`);
        setShowClearModal(false);
        setPage(1);
        load(true);
      } else {
        alert('Failed to delete logs: ' + (d.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Network error, failed to delete logs.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters and Controls Toolbar */}
      <div className="flex flex-col gap-4 bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/10 shadow-sm">
        <div className="flex flex-col lg:flex-row justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
            {/* Search box */}
            <div className="relative w-full sm:flex-1 sm:max-w-md group">
              <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-on-surface-variant group-focus-within:text-primary transition-colors" style={{fontSize:'20px'}}>search</span>
              <input
                type="text"
                placeholder="Search logs by user, action, details..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-low text-body-md font-medium focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all shadow-sm"
              />
            </div>

            {/* Date range filters */}
            <div className="flex items-center gap-2 bg-surface-container-low p-1 rounded-xl border border-outline-variant/50 shadow-sm w-full sm:w-auto justify-center">
              <input
                type="date"
                value={startDate}
                onChange={e => { setStartDate(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-lg bg-transparent text-body-md font-medium focus:outline-none focus:bg-surface-container-lowest transition-colors flex-1 w-0 sm:w-auto"
                title="Start Date"
              />
              <span className="material-symbols-outlined text-on-surface-variant shrink-0" style={{fontSize: '18px'}}>arrow_right_alt</span>
              <input
                type="date"
                value={endDate}
                onChange={e => { setEndDate(e.target.value); setPage(1); }}
                className="px-3 py-1.5 rounded-lg bg-transparent text-body-md font-medium focus:outline-none focus:bg-surface-container-lowest transition-colors flex-1 w-0 sm:w-auto"
                title="End Date"
              />
            </div>
          </div>

          {/* Action buttons (Export, Clear) */}
          <div className="flex items-center gap-3 pt-4 lg:pt-0 lg:pl-4 border-t lg:border-t-0 lg:border-l border-outline-variant/20 w-full lg:w-auto">
            <button
              onClick={handleExportCSV}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-label-md font-bold hover:bg-primary/5 hover:border-primary/30 hover:text-primary active:scale-95 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined" style={{fontSize:'18px'}}>download</span>
              Export
            </button>
            <button
              onClick={() => setShowClearModal(true)}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-label-md font-bold hover:bg-red-100 active:scale-95 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined" style={{fontSize:'18px'}}>delete_sweep</span>
              Clear
            </button>
          </div>
        </div>
        
        {/* Secondary Toolbar Row for Auto Refresh & Stats */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-outline-variant/10">
           {/* Auto refresh control */}
          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-3 bg-surface-container-low px-3 py-1.5 rounded-xl border border-outline-variant/50 shadow-sm">
            <span className="text-label-md text-on-surface-variant font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>sync</span>
              Auto Refresh:
            </span>
            <div className="flex items-center gap-2">
              <select
                value={autoRefreshSecs}
                onChange={e => setAutoRefreshSecs(Number(e.target.value))}
                className="bg-transparent text-primary font-bold appearance-none focus:outline-none cursor-pointer pr-4"
              >
                <option value={0}>Off</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
              </select>
              {autoRefreshSecs > 0 && (
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold ring-1 ring-primary/20" title="Seconds until next refresh">
                  {refreshCountdown}
                </div>
              )}
            </div>
          </div>
          
          <div className="text-body-sm text-on-surface-variant font-medium">
            Showing <span className="font-bold text-primary">{data.logs?.length || 0}</span> logs on this page
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className={`w-full text-sm responsive-table ${tableClassName || ''}`}>
            <thead className="bg-surface-container-low border-b border-outline-variant/10">
              <tr>
                {columns.map(c => (
                  <th key={c} className="text-left px-5 py-4 text-label-md text-on-surface-variant font-bold whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr><td colSpan={columns.length} className="text-center py-8"><Spinner /></td></tr>
              ) : (!data.logs || data.logs.length === 0) ? (
                <tr><td colSpan={columns.length} className="text-center py-8 text-on-surface-variant">No logs found matching filters.</td></tr>
              ) : (
                data.logs.map((log, i) => <tr key={log.id || i} className="hover:bg-surface-container-low transition-colors">{rowFn(log)}</tr>)
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-5 py-4 border-t border-outline-variant/10 flex flex-wrap gap-4 items-center justify-between bg-surface-container-low/30">
          <span className="text-label-md font-medium text-on-surface-variant">Page {data.page} of {data.pages} ({data.total} total)</span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}
                className="p-2 rounded-xl border border-outline-variant text-label-md disabled:opacity-40 hover:bg-surface-container-low transition-all active:scale-95 disabled:scale-100 flex items-center justify-center"
                title="Previous Page">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {data.pages > 5 && page > 3 && (
                <>
                  <button onClick={() => setPage(1)} className="w-9 h-9 rounded-xl border border-outline-variant text-label-md hover:bg-surface-container-low transition-all active:scale-95 flex items-center justify-center">1</button>
                  {page > 4 && <span className="text-on-surface-variant/40 px-0.5">...</span>}
                </>
              )}

              {pageRange.map(p => (
                <button key={p} onClick={() => setPage(p)} disabled={loading}
                  className={`w-9 h-9 rounded-xl text-label-md font-semibold transition-all active:scale-95 flex items-center justify-center ${page === p ? 'bg-primary text-on-primary shadow-sm' : 'border border-outline-variant hover:bg-surface-container-low'}`}>
                  {p}
                </button>
              ))}

              {data.pages > 5 && page < data.pages - 2 && (
                <>
                  {page < data.pages - 3 && <span className="text-on-surface-variant/40 px-0.5">...</span>}
                  <button onClick={() => setPage(data.pages)} className="w-9 h-9 rounded-xl border border-outline-variant text-label-md hover:bg-surface-container-low transition-all active:scale-95 flex items-center justify-center">{data.pages}</button>
                </>
              )}

              <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page >= data.pages || loading}
                className="p-2 rounded-xl border border-outline-variant text-label-md disabled:opacity-40 hover:bg-surface-container-low transition-all active:scale-95 disabled:scale-100 flex items-center justify-center"
                title="Next Page">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {data.pages > 1 && (
              <div className="flex items-center gap-2 pl-3 border-l border-outline-variant/30 text-label-md text-on-surface-variant">
                <span>Go to:</span>
                <input type="number" min={1} max={data.pages} value={inputPage}
                  onChange={e => setInputPage(e.target.value)}
                  onBlur={() => {
                    const p = parseInt(inputPage);
                    if (p >= 1 && p <= data.pages) setPage(p);
                    else setInputPage(String(page));
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const p = parseInt(inputPage);
                      if (p >= 1 && p <= data.pages) setPage(p);
                      else setInputPage(String(page));
                    }
                  }}
                  className="w-12 px-1.5 py-1 text-center rounded-lg border border-outline-variant bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary font-semibold"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear Logs Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-6 shadow-card border border-outline-variant/10 transform scale-100 transition-all">
            <h3 className="text-title-lg font-bold text-on-surface mb-2">Clear {logTypeName}</h3>
            <p className="text-body-md text-on-surface-variant mb-4">
              Select which logs you want to delete to reduce database size and improve performance. This action is permanent.
            </p>
            
            <div className="space-y-2.5 mb-6">
              {[
                { value: 'all', label: 'Delete all logs' },
                { value: '7days', label: 'Delete logs older than 7 days' },
                { value: '30days', label: 'Delete logs older than 30 days' }
              ].map(opt => (
                <label key={opt.value} className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant hover:bg-surface-container-low cursor-pointer transition-all">
                  <input
                    type="radio"
                    name="clearOption"
                    value={opt.value}
                    checked={clearOption === opt.value}
                    onChange={() => setClearOption(opt.value)}
                    className="w-4 h-4 text-primary focus:ring-secondary"
                  />
                  <span className="text-body-md font-semibold text-on-surface">{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="px-5 py-2.5 rounded-xl border border-outline-variant text-label-lg font-semibold hover:bg-surface-container-low active:scale-95 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClearLogs}
                disabled={clearing}
                className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-label-lg font-semibold hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {clearing ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen">
      <TopNavBar />
      <main className="pt-36 pb-section-padding px-margin-mobile md:px-margin-desktop md:pt-24 max-w-container-max mx-auto">
        {/* Tab Bar */}
        <div className="flex gap-1 mb-8 bg-surface-container-lowest rounded-2xl p-1.5 border border-outline-variant/10 overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.key} onClick={()=>setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-label-md font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab===tab.key ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
              }`}>
              <span className="material-symbols-outlined" style={{fontSize:'18px'}}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview'     && <OverviewTab />}
        {activeTab === 'lockers'      && <LockersTab />}
        {activeTab === 'users'        && <UsersTab />}
        {activeTab === 'cabinets'     && <AdminCabinetsTab />}
        {activeTab === 'unlock-logs'  && (
          <LogTable
            endpoint="/api/admin/logs/lockers"
            logTypeName="Unlock Logs"
            tableClassName="table-logs-lockers"
            columns={['Time', 'Locker ID', 'Zone', 'User', 'Action', 'Method']}
            rowFn={l => (
              <>
                <td className="px-5 py-3 text-on-surface-variant text-xs font-medium">{new Date(l.timestamp).toLocaleString()}</td>
                <td className="px-5 py-3 font-mono font-bold text-primary">{formatLockerId(l.locker || l.lockerId)}</td>
                <td className="px-5 py-3 text-on-surface-variant font-medium">{l.locker?.zone || '—'}</td>
                <td className="px-5 py-3 text-on-surface-variant font-medium">{l.user?.name || 'Unknown'}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${l.action==='unlock'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{l.action}</span>
                </td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">{l.method}</span>
                </td>
              </>
            )}
          />
        )}
        {activeTab === 'system-logs' && (
          <LogTable
            endpoint="/api/admin/logs/system"
            logTypeName="System Logs"
            tableClassName="table-logs-system"
            columns={['Time', 'User', 'Action', 'Details', 'IP']}
            rowFn={l => (
              <>
                <td className="px-5 py-3 text-on-surface-variant text-xs font-medium">{new Date(l.timestamp).toLocaleString()}</td>
                <td className="px-5 py-3 text-on-surface-variant font-medium">{l.user?.username || 'System'}</td>
                <td className="px-5 py-3"><span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-container-high text-on-surface-variant">{l.action}</span></td>
                <td className="px-5 py-3 text-on-surface-variant text-xs max-w-xs truncate font-medium">{l.details || '—'}</td>
                <td className="px-5 py-3 font-mono text-on-surface-variant text-xs font-medium">{l.ipAddress || '—'}</td>
              </>
            )}
          />
        )}
      </main>
    </div>
  );
}
