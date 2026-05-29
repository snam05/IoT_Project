import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Lockers', to: '/lockers' },
  { label: 'Users', to: '/users' },
];

export default function TopNavBar() {
  const location = useLocation();

  return (
    <nav className="fixed top-0 w-full z-50 glass border-b border-outline-variant/10 shadow-sm">
      <div className="flex justify-between items-center h-16 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">

        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 no-underline">
          <span
            className="material-symbols-outlined text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            lock
          </span>
          <span className="font-bold tracking-tight text-primary text-headline-md leading-none">
            LockerSystem
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center space-x-8">
          {navLinks.map(({ label, to }) => {
            const isActive = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`h-16 flex items-center text-body-md font-semibold transition-all duration-200 hover:opacity-80 active:scale-95
                  ${isActive
                    ? 'text-secondary border-b-2 border-secondary'
                    : 'text-on-surface-variant hover:text-primary'
                  }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Trailing Icons */}
        <div className="flex items-center gap-4">
          <Link to="/scan" title="Scan QR">
            <button className="text-on-surface-variant hover:text-primary transition-colors hover:opacity-80 active:scale-95 duration-200">
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </button>
          </Link>
          <button className="text-on-surface-variant hover:text-primary transition-colors hover:opacity-80 active:scale-95 duration-200">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <Link to="/profile">
            <button className="text-on-surface-variant hover:text-primary transition-colors hover:opacity-80 active:scale-95 duration-200">
              <span className="material-symbols-outlined">account_circle</span>
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
