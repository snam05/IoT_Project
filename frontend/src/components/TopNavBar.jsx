import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function NavLink({ label, icon, to, active }) {
  return (
    <Link
      to={to}
      className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-label-md font-semibold transition-all active:scale-95 md:h-16 md:flex-none md:rounded-none md:border-b-2 md:px-0 ${
        active
          ? 'bg-primary text-on-primary md:border-secondary md:bg-transparent md:text-secondary'
          : 'text-on-surface-variant hover:text-primary md:border-transparent'
      }`}
    >
      <span className="material-symbols-outlined md:hidden" style={{ fontSize: '18px' }}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function TopNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { label: 'Home', icon: 'home', to: '/' },
    ...(user?.role === 'ADMIN' ? [{ label: 'Dashboard', icon: 'dashboard', to: '/dashboard' }] : []),
    ...(user && user.role !== 'ADMIN' ? [{ label: 'Scan QR', icon: 'qr_code_scanner', to: '/scan' }] : []),
  ];

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-outline-variant/10 shadow-sm glass">
      <div className="mx-auto flex h-16 max-w-container-max items-center justify-between gap-4 px-margin-mobile md:px-margin-desktop">
        <Link to="/" className="flex min-w-0 items-center gap-2 no-underline">
          <span
            className="material-symbols-outlined flex-shrink-0 text-primary"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            lock
          </span>
          <span className="truncate text-headline-md font-bold leading-none tracking-tight text-primary">
            LockerSystem
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map(({ label, icon, to }) => (
            <NavLink
              key={to}
              label={label}
              icon={icon}
              to={to}
              active={location.pathname === to}
            />
          ))}
        </div>

        <div className="relative flex items-center gap-2" ref={dropdownRef}>
          {user ? (
            <>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className={`flex h-10 min-w-0 items-center gap-2 rounded-full px-2 transition-all active:scale-95 sm:px-3 ${
                  dropdownOpen
                    ? 'bg-surface-container text-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
                }`}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <span className="material-symbols-outlined select-none text-2xl">account_circle</span>
                <span className="max-w-32 truncate text-label-md font-semibold sm:inline select-none">
                  {user.name || user.username}
                </span>
                <span className="material-symbols-outlined text-body-sm transition-transform select-none hidden sm:inline" style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', fontSize: '18px' }}>
                  expand_more
                </span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 origin-top-right rounded-2xl border border-outline-variant/20 bg-surface-white p-2 shadow-card-hover ring-1 ring-black/5 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                  <div className="px-3 py-2 border-b border-outline-variant/10">
                    <p className="truncate text-body-md font-bold text-primary">
                      {user.name || user.username}
                    </p>
                    <p className="truncate text-label-md text-on-surface-variant font-normal">
                      {user.email || user.username}
                    </p>
                  </div>
                  
                  <div className="py-1">
                    <Link
                      to="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-body-md font-medium text-on-surface transition-colors hover:bg-surface-container-low hover:text-primary"
                    >
                      <span className="material-symbols-outlined text-on-surface-variant text-xl">account_circle</span>
                      <span>Profile</span>
                    </Link>

                    <button
                      onClick={async () => {
                        setDropdownOpen(false);
                        try {
                          await logout();
                          navigate('/login', { replace: true });
                        } catch (err) {
                          console.error('Logout failed:', err);
                        }
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-body-md font-semibold text-error transition-colors hover:bg-error-container/10 hover:text-error"
                    >
                      <span className="material-symbols-outlined text-xl">logout</span>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-primary px-4 py-2 text-label-md font-semibold text-on-primary transition-all hover:opacity-90 active:scale-95"
            >
              Login
            </Link>
          )}
        </div>
      </div>

      <div className="border-t border-outline-variant/10 bg-surface-white/90 px-margin-mobile py-2 md:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          {navLinks.map(({ label, icon, to }) => (
            <NavLink
              key={to}
              label={label}
              icon={icon}
              to={to}
              active={location.pathname === to}
            />
          ))}
        </div>
      </div>
    </nav>
  );
}
