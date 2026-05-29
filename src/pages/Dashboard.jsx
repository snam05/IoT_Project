import { useState, useEffect } from 'react';
import TopNavBar from '../components/TopNavBar';

// Locker color mappings
const LOCKER_COLORS = {
  available: '#E8F5E9',   // Green tint
  in_use: '#0058bc',      // Secondary blue
  maintenance: '#ba1a1a', // Error red
};

// Sample locker grid data (6 cols x 3 rows)
const SAMPLE_LOCKER_GRID = [
  'in_use', 'in_use', 'available', 'in_use', 'in_use', 'maintenance',
  'available', 'available', 'in_use', 'in_use', 'in_use', 'in_use',
  'in_use', 'available', 'available', 'maintenance', 'in_use', 'in_use',
];

function StatCard({ label, icon, value, sub, iconColor = 'text-outline' }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-8 flex flex-col justify-between border border-outline-variant/10 relative overflow-hidden group">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-surface-container-low rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500" />
      <div className="flex items-center justify-between mb-8 relative z-10">
        <span className="text-label-md text-on-surface-variant">{label}</span>
        <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
      </div>
      <div className="relative z-10">
        <span className="text-display-lg text-primary block">{value}</span>
        <span className="text-body-md text-secondary mt-1 flex items-center gap-1">{sub}</span>
      </div>
    </div>
  );
}

function StatusCard({ color, iconName, statusLabel, count }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10 flex items-center justify-between hover:bg-surface-bright transition-colors cursor-pointer">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: color }}>
          <span
            className="material-symbols-outlined"
            style={{ fontVariationSettings: "'FILL' 1", fontSize: '20px' }}
          >
            {iconName}
          </span>
        </div>
        <div>
          <p className="text-label-md text-on-surface-variant mb-1">{statusLabel}</p>
          <p className="text-headline-xl text-primary">{count}</p>
        </div>
      </div>
      <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {
        // Fallback mock data when API not available
        setStats({
          total: 245,
          inUse: 182,
          maintenance: 3,
          available: 60,
          growth: '+12 this month',
          capacity: '74% capacity',
        });
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen">
      <TopNavBar />

      <main className="pt-32 pb-section-padding px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <h1 className="text-display-lg text-primary mb-2 hidden md:block">Dashboard</h1>
            <h1 className="text-display-lg-mobile text-primary mb-2 block md:hidden">Dashboard</h1>
            <p className="text-body-lg text-on-surface-variant">
              Smart locker system overview for today.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-surface-container-highest text-primary text-label-md font-semibold hover:bg-surface-dim transition-all active:scale-95 duration-200">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock_open</span>
              Unlock All
            </button>
            <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-on-primary text-label-md font-semibold hover:opacity-80 transition-all active:scale-95 duration-200 shadow-cta">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
              Lock All
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-12">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/10 animate-pulse h-48" />
            ))
          ) : (
            <>
              <StatCard
                label="Total Lockers"
                icon="grid_view"
                value={stats?.total ?? 245}
                sub={
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>trending_up</span>
                    {stats?.growth ?? '+12 this month'}
                  </>
                }
              />
              <StatCard
                label="In Use"
                icon="shopping_bag"
                value={stats?.inUse ?? 182}
                sub={<span className="text-on-surface-variant">{stats?.capacity ?? '74% capacity'}</span>}
              />
              <StatCard
                label="Needs Maintenance"
                icon="build"
                iconColor="text-error"
                value={<span className="text-error">{stats?.maintenance ?? 3}</span>}
                sub={<span className="text-on-surface-variant">Requires immediate action</span>}
              />
            </>
          )}
        </section>

        {/* Status + Visual Map */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          {/* Status Cards */}
          <div className="lg:col-span-1 flex flex-col gap-gutter">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-headline-md text-primary">Status</h2>
            </div>
            <StatusCard
              color="#E8F5E9"
              iconName="check_circle"
              statusLabel="AVAILABLE"
              count={stats?.available ?? 60}
            />
            <StatusCard
              color="#d8e2ff"
              iconName="lock_clock"
              statusLabel="IN USE"
              count={stats?.inUse ?? 182}
            />
            <StatusCard
              color="#ffdad6"
              iconName="warning"
              statusLabel="MAINTENANCE"
              count={stats?.maintenance ?? 3}
            />
          </div>

          {/* Locker Visual Map */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-headline-md text-primary">Zone A (Ground Floor)</h2>
              <button className="text-secondary text-label-md font-semibold hover:underline">
                View Full Map
              </button>
            </div>

            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-8 flex-grow flex items-center justify-center relative overflow-hidden min-h-[320px]">
              {/* Background image */}
              <div
                className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCgsvXKqBW39jfcN-nOvTCSll6GpN25b28X6l_iinwlPjjIoTYPA1QPUCRAGxz1_EVDMkXeZfYBAjVaeaVwj0Mjw2eMcLc7W8vKulIQ27NLELL7LfvfdqUxeDT0sD8juFWYIqJ-3Zv5xV2_oXPT9nmjqKCwv-0VsO6dBFBGvl3jGo-A0VQ1GqyHjGryU2UyAsZuvsWJWAVklPfH-VrmWgi53k_Vm5QlWWX7qfC1TSSH243isKy2w6fuvxPfu1Gg3caCmcAwGtsNq73_')",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent" />

              {/* Locker Grid */}
              <div className="relative z-10 grid grid-cols-6 gap-3 w-full max-w-lg p-6 bg-white/50 backdrop-blur-md rounded-xl border border-white shadow-sm">
                {SAMPLE_LOCKER_GRID.map((status, i) => (
                  <div
                    key={i}
                    title={status}
                    className="aspect-square rounded shadow-sm cursor-pointer transition-transform hover:scale-110 duration-200"
                    style={{ backgroundColor: LOCKER_COLORS[status] }}
                  />
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 px-1">
              {[
                { color: LOCKER_COLORS.available, label: 'Available' },
                { color: LOCKER_COLORS.in_use, label: 'In Use' },
                { color: LOCKER_COLORS.maintenance, label: 'Maintenance' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-label-md text-on-surface-variant">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
