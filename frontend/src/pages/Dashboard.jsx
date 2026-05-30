import { useState, useEffect, useCallback } from 'react';
import TopNavBar from '../components/TopNavBar';
import AdminCabinetsTab from './AdminCabinetsTab';

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

// ── Overview Tab ──────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [lockers, setLockers] = useState([]);

  useEffect(() => {
    fetch('/api/stats', { credentials: 'include' }).then(r => r.json()).then(setStats).catch(() => {});
    fetch('/api/lockers?limit=18', { credentials: 'include' }).then(r => r.json()).then(d => setLockers(d.lockers || [])).catch(() => {});
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
      <div>
        <h2 className="text-headline-md text-primary mb-4">Locker Map</h2>
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-6">
          <div className="grid grid-cols-6 gap-2 max-w-md">
            {lockers.map(l => (
              <div key={l.lockerId} title={`${l.lockerId} — ${l.status}`}
                className="aspect-square rounded-lg cursor-pointer hover:scale-110 transition-transform duration-200 flex items-center justify-center"
                style={{ backgroundColor: STATUS_COLOR[l.status] || '#f0f0f0' }}>
                <span className="text-xs font-bold opacity-60">{l.col}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-6 mt-4">
            {Object.entries(STATUS_COLOR).map(([s, c]) => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{backgroundColor:c}}/>
                <span className="text-label-md text-on-surface-variant">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lockers Tab ───────────────────────────────────────────────
function LockersTab() {
  const [data, setData] = useState({ lockers: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', zone: '' });
  const [actionLoading, setActionLoading] = useState(null);

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
          <option>A</option><option>B</option><option>C</option>
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
                  <td className="px-4 py-3 font-mono font-semibold text-primary">{l.lockerId}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{l.zone}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{l.floor}</td>
                  <td className="px-4 py-3"><Badge status={l.status}/></td>
                  <td className="px-4 py-3 text-on-surface-variant">{l.user?.name || '—'}</td>
                  <td className="px-4 py-3 text-on-surface-variant text-xs">{l.lockedAt ? new Date(l.lockedAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {l.status !== 'AVAILABLE' && (
                        <button onClick={() => updateStatus(l.lockerId, 'AVAILABLE', 'unlock')}
                          disabled={actionLoading===l.lockerId}
                          className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-semibold hover:bg-green-200 active:scale-95 transition-all disabled:opacity-50">
                          Unlock
                        </button>
                      )}
                      {l.status === 'AVAILABLE' && (
                        <button onClick={() => updateStatus(l.lockerId, 'MAINTENANCE', null)}
                          disabled={actionLoading===l.lockerId}
                          className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 active:scale-95 transition-all disabled:opacity-50">
                          Maintenance
                        </button>
                      )}
                      {l.status === 'MAINTENANCE' && (
                        <button onClick={() => updateStatus(l.lockerId, 'AVAILABLE', null)}
                          disabled={actionLoading===l.lockerId}
                          className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200 active:scale-95 transition-all disabled:opacity-50">
                          Restore
                        </button>
                      )}
                      <button onClick={() => updateStatus(l.lockerId, l.status, 'unlock')}
                        disabled={actionLoading===l.lockerId}
                        className="px-3 py-1 rounded-lg border border-teal-200 text-teal-700 text-xs font-semibold hover:bg-teal-50 active:scale-95 transition-all disabled:opacity-50">
                        Mở
                      </button>
                      <button onClick={() => updateStatus(l.lockerId, l.status, 'lock')}
                        disabled={actionLoading===l.lockerId}
                        className="px-3 py-1 rounded-lg border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-50 active:scale-95 transition-all disabled:opacity-50">
                        Khóa
                      </button>
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
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────
function UsersTab() {
  const [data, setData] = useState({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username:'', email:'', name:'', password:'', role:'USER' });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

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

  const deleteUser = async (id, name) => {
    if (!confirm(`Delete user "${name}"?`)) return;
    await fetch(`/api/admin/users/${id}`, { method:'DELETE', credentials:'include' });
    load();
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
                          className={`px-3 py-1 rounded-lg text-xs font-semibold active:scale-95 transition-all ${u.isActive?'bg-yellow-100 text-yellow-700 hover:bg-yellow-200':'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={()=>deleteUser(u.id, u.name)}
                          className="px-3 py-1 rounded-lg bg-red-100 text-red-700 text-xs font-semibold hover:bg-red-200 active:scale-95 transition-all">
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
    </div>
  );
}

// ── Generic Log Table ─────────────────────────────────────────
function LogTable({ endpoint, columns, rowFn }) {
  const [data, setData] = useState({ logs: [], total: 0, page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${endpoint}?page=${page}&limit=20`, { credentials: 'include' })
      .then(r=>r.json()).then(setData).catch(()=>{}).finally(()=>setLoading(false));
  }, [endpoint, page]);

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
      <div className="px-4 py-3 border-t border-outline-variant/10 flex items-center justify-between">
        <span className="text-label-md text-on-surface-variant">Page {data.page} of {data.pages} ({data.total} total)</span>
        <div className="flex gap-2">
          <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1 || loading}
            className="px-3 py-1.5 rounded-lg border border-outline-variant text-label-md disabled:opacity-40 hover:bg-surface-container-low transition-all">Prev</button>
          <button onClick={()=>setPage(p=>Math.min(data.pages,p+1))} disabled={page>=data.pages || loading}
            className="px-3 py-1.5 rounded-lg border border-outline-variant text-label-md disabled:opacity-40 hover:bg-surface-container-low transition-all">Next</button>
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
      <main className="pt-24 pb-section-padding px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <header className="mb-8">
          <h1 className="text-display-lg text-primary font-bold mb-1">Admin Dashboard</h1>
          <p className="text-body-lg text-on-surface-variant">Manage lockers, users, and monitor system activity</p>
        </header>

        {/* Tab Bar */}
        <div className="flex gap-1 mb-8 bg-surface-container-lowest rounded-2xl p-1.5 border border-outline-variant/10 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={()=>setActiveTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-label-md font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab===t.key ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
              }`}>
              <span className="material-symbols-outlined" style={{fontSize:'18px'}}>{t.icon}</span>
              {t.label}
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
            columns={['Time', 'Locker', 'Zone', 'User', 'Action', 'Method']}
            rowFn={l => (
              <>
                <td className="px-4 py-3 text-on-surface-variant text-xs">{new Date(l.timestamp).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono font-semibold text-primary">{l.lockerId}</td>
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
