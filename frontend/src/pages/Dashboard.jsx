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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {!stats ? Array.from({length:4}).map((_,i)=><div key={i} className="bg-surface-container-lowest rounded-xl p-6 h-32 animate-pulse border border-outline-variant/10"/>) :
          statCards.map(s => (
            <div key={s.label} className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10 hover:shadow-card transition-shadow">
              <div className="flex justify-between mb-4">
                <span className="text-label-md text-on-surface-variant">{s.label}</span>
                <span className="material-symbols-outlined text-outline" style={{fontSize:'20px'}}>{s.icon}</span>
              </div>
              <div className={`text-display-lg font-bold text-primary ${s.color||''}`}>{s.value}</div>
              <div className="text-body-md text-on-surface-variant mt-1">{s.sub}</div>
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
    data.lockers.forEach(l => {
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
      <div className="flex flex-wrap gap-3 mb-6">
        <select value={filter.status} onChange={e=>setFilter(f=>({...f,status:e.target.value}))}
          className="px-4 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-secondary">
          <option value="">All Status</option>
          <option>AVAILABLE</option><option>IN_USE</option><option>MAINTENANCE</option>
        </select>
        <select value={filter.zone} onChange={e=>setFilter(f=>({...f,zone:e.target.value}))}
          className="px-4 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-secondary">
          <option value="">All Zones</option>
          {zones.map(z => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
        <select value={filter.cabinetId} onChange={e=>setFilter(f=>({...f,cabinetId:e.target.value}))}
          className="px-4 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-secondary">
          <option value="">All Cabinets</option>
          {cabinets.map(c => (
            <option key={c.id} value={c.id}>
              {c.cabinetCode} ({c.identity})
            </option>
          ))}
        </select>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-secondary text-white text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all">Refresh</button>
      </div>
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant/10">
              <tr>
                {['Locker ID','Zone','Floor','Status','Assigned User','Locked At','Actions'].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-label-md text-on-surface-variant font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8"><Spinner/></td></tr>
              ) : data.lockers.map(l => (
                <tr key={l.lockerId} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-primary">{formatLockerId(l)}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{l.zone}</td>
                  <td className="px-4 py-3 text-on-surface-variant">
                    <div className="flex items-center gap-1.5 group">
                      <span>{l.floor}</span>
                      <button onClick={() => { setEditingFloorLocker(l); setNewFloor(String(l.floor)); }}
                        title="Edit Floor"
                        className="p-1 rounded hover:bg-surface-container-high text-on-surface-variant/40 hover:text-primary active:scale-90 transition-all opacity-0 group-hover:opacity-100">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge status={l.status}/></td>
                   <td className="px-4 py-3">
                     {l.user?.role === 'ADMIN' ? (
                       <span className="text-red-600 font-semibold">Admin</span>
                     ) : (
                       <span className="text-on-surface-variant">{l.user?.name || '—'}</span>
                     )}
                   </td>
                   <td className="px-4 py-3 text-on-surface-variant text-xs">{l.lockedAt ? new Date(l.lockedAt).toLocaleString() : '—'}</td>
                   <td className="px-4 py-3">
                     <div className="flex gap-2">
                       {l.status === 'IN_USE' && (
                         <button onClick={() => updateStatus(l.lockerId, 'AVAILABLE', 'unlock')}
                           disabled={actionLoading===l.lockerId}
                           className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-semibold hover:bg-green-200 active:scale-95 transition-all disabled:opacity-50">
                           Unlock
                         </button>
                       )}
                       {l.status === 'AVAILABLE' && (
                         <>
                           <button onClick={() => updateStatus(l.lockerId, 'IN_USE', 'lock')}
                             disabled={actionLoading===l.lockerId}
                             className="px-3 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold hover:bg-amber-200 active:scale-95 transition-all disabled:opacity-50">
                             Lock
                           </button>
                           <button onClick={() => updateStatus(l.lockerId, 'MAINTENANCE', null)}
                             disabled={actionLoading===l.lockerId}
                             className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 active:scale-95 transition-all disabled:opacity-50">
                             Maintenance
                           </button>
                         </>
                       )}
                       {l.status === 'MAINTENANCE' && (
                         <button onClick={() => updateStatus(l.lockerId, 'AVAILABLE', null)}
                           disabled={actionLoading===l.lockerId}
                           className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200 active:scale-95 transition-all disabled:opacity-50">
                           Restore
                         </button>
                       )}
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-outline-variant/10 text-label-md text-on-surface-variant">
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
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search users..."
          className="px-4 py-2 rounded-xl border border-outline-variant bg-surface-container-lowest text-body-md focus:outline-none focus:ring-2 focus:ring-secondary flex-1 min-w-48"/>
        <button onClick={() => setShowCreate(s=>!s)}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-on-primary text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all">
          <span className="material-symbols-outlined" style={{fontSize:'18px'}}>person_add</span>
          Add User
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createUser} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6 mb-6 grid grid-cols-2 gap-4">
          <h3 className="col-span-2 text-headline-md text-primary font-semibold">Create New User</h3>
          {[['username','Username','text'],['email','Email','email'],['name','Full Name','text'],['password','Password','password']].map(([k,l,t])=>(
            <div key={k}>
              <label className="text-label-md text-on-surface-variant mb-1 block">{l}</label>
              <input type={t} value={form[k]} required onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary"/>
            </div>
          ))}
          <div>
            <label className="text-label-md text-on-surface-variant mb-1 block">Role</label>
            <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}
              className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary">
              <option>USER</option><option>ADMIN</option>
            </select>
          </div>
          {msg && <p className="col-span-2 text-body-md text-error">{msg}</p>}
          <div className="col-span-2 flex gap-3">
            <button type="submit" disabled={creating}
              className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50">
              {creating ? 'Creating...' : 'Create User'}
            </button>
            <button type="button" onClick={()=>setShowCreate(false)}
              className="px-6 py-2.5 rounded-xl border border-outline-variant text-on-surface text-label-md hover:bg-surface-container-low transition-all">
              Cancel
            </button>
          </div>
        </form>
      )}

      {resettingUser && (
        <form onSubmit={handleResetPassword} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6 mb-6">
          <h3 className="text-headline-md text-primary font-semibold mb-4">Reset Password for {resettingUser.name} (@{resettingUser.username})</h3>
          <div className="flex flex-col sm:flex-row gap-4 items-end max-w-xl">
            <div className="flex-1 w-full">
              <label className="text-label-md text-on-surface-variant mb-1 block">New Password</label>
              <input
                type="password"
                value={newPassword}
                required
                minLength={8}
                onChange={e=>setNewPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary"
                placeholder="At least 8 characters"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={resetting}
                className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">
                {resetting ? 'Resetting...' : 'Update Password'}
              </button>
              <button type="button" onClick={()=>{setResettingUser(null); setNewPassword(''); setResetMsg('');}}
                className="px-6 py-2.5 rounded-xl border border-outline-variant text-on-surface text-label-md hover:bg-surface-container-low transition-all whitespace-nowrap">
                Cancel
              </button>
            </div>
          </div>
          {resetMsg && <p className="text-body-md text-error mt-2">{resetMsg}</p>}
        </form>
      )}

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant/10">
              <tr>
                {['Name','Username','Email','Role','Status','Created','Actions'].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-label-md text-on-surface-variant font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {loading ? <tr><td colSpan={7} className="text-center py-8"><Spinner/></td></tr> :
                data.users.map(u => (
                  <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-4 py-3 font-semibold text-primary">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-on-surface-variant">{u.username}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.role==='ADMIN'?'bg-purple-100 text-purple-700':'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${u.isActive?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
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
        <div className="px-4 py-3 border-t border-outline-variant/10 text-label-md text-on-surface-variant">Total: {data.total} users</div>
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
function LogTable({ endpoint, columns, rowFn }) {
  const [data, setData] = useState({ logs: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [inputPage, setInputPage] = useState('1');

  useEffect(() => {
    setLoading(true);
    fetch(`${endpoint}?page=${page}&limit=20`, { credentials: 'include' })
      .then(r=>r.json()).then(setData).catch(()=>{}).finally(()=>setLoading(false));
  }, [endpoint, page]);

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

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-low border-b border-outline-variant/10">
            <tr>{columns.map(c=><th key={c} className="text-left px-4 py-3 text-label-md text-on-surface-variant font-semibold">{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {loading ? <tr><td colSpan={columns.length} className="text-center py-8"><Spinner/></td></tr>
              : data.logs.map((log, i) => <tr key={log.id||i} className="hover:bg-surface-container-low transition-colors">{rowFn(log)}</tr>)
            }
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-outline-variant/10 flex flex-wrap gap-4 items-center justify-between">
        <span className="text-label-md text-on-surface-variant">Page {data.page} of {data.pages} ({data.total} total)</span>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1 || loading}
              className="p-2 rounded-xl border border-outline-variant text-label-md disabled:opacity-40 hover:bg-surface-container-low transition-all active:scale-95 disabled:scale-100 flex items-center justify-center"
              title="Previous Page">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {data.pages > 5 && page > 3 && (
              <>
                <button onClick={()=>setPage(1)} className="w-9 h-9 rounded-xl border border-outline-variant text-label-md hover:bg-surface-container-low transition-all active:scale-95 flex items-center justify-center">1</button>
                {page > 4 && <span className="text-on-surface-variant/40 px-0.5">...</span>}
              </>
            )}

            {pageRange.map(p => (
              <button key={p} onClick={()=>setPage(p)} disabled={loading}
                className={`w-9 h-9 rounded-xl text-label-md font-semibold transition-all active:scale-95 flex items-center justify-center ${page===p?'bg-primary text-on-primary shadow-sm':'border border-outline-variant hover:bg-surface-container-low'}`}>
                {p}
              </button>
            ))}

            {data.pages > 5 && page < data.pages - 2 && (
              <>
                {page < data.pages - 3 && <span className="text-on-surface-variant/40 px-0.5">...</span>}
                <button onClick={()=>setPage(data.pages)} className="w-9 h-9 rounded-xl border border-outline-variant text-label-md hover:bg-surface-container-low transition-all active:scale-95 flex items-center justify-center">{data.pages}</button>
              </>
            )}

            <button onClick={()=>setPage(p=>Math.min(data.pages,p+1))} disabled={page>=data.pages || loading}
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
                onChange={e=>setInputPage(e.target.value)}
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
            columns={['Time', 'Locker ID', 'Zone', 'User', 'Action', 'Method']}
            rowFn={l => (
              <>
                <td className="px-4 py-3 text-on-surface-variant text-xs">{new Date(l.timestamp).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono font-semibold text-primary">{formatLockerId(l.locker || l.lockerId)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{l.locker?.zone || '—'}</td>
                <td className="px-4 py-3 text-on-surface-variant">{l.user?.name || 'Unknown'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${l.action==='unlock'?'bg-green-100 text-green-700':'bg-blue-100 text-blue-700'}`}>{l.action}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">{l.method}</span>
                </td>
              </>
            )}
          />
        )}
        {activeTab === 'system-logs' && (
          <LogTable
            endpoint="/api/admin/logs/system"
            columns={['Time', 'User', 'Action', 'Details', 'IP']}
            rowFn={l => (
              <>
                <td className="px-4 py-3 text-on-surface-variant text-xs">{new Date(l.timestamp).toLocaleString()}</td>
                <td className="px-4 py-3 text-on-surface-variant">{l.user?.username || 'System'}</td>
                <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container-high text-on-surface-variant">{l.action}</span></td>
                <td className="px-4 py-3 text-on-surface-variant text-xs max-w-xs truncate">{l.details || '—'}</td>
                <td className="px-4 py-3 font-mono text-on-surface-variant text-xs">{l.ipAddress || '—'}</td>
              </>
            )}
          />
        )}
      </main>
    </div>
  );
}
