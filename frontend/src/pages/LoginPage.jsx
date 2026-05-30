import { useState } from 'react';
import { useLocation, useNavigate, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from;
  const fallbackPath = user?.role === 'ADMIN' ? '/dashboard' : '/scan';
  const redirectTo = from ? `${from.pathname || '/scan'}${from.search || ''}` : fallbackPath;

  // Already logged in → redirect
  if (user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(form.username.trim(), form.password);
      const defaultPath = u.role === 'ADMIN' ? '/dashboard' : '/scan';
      const targetPath = from ? `${from.pathname || '/scan'}${from.search || ''}` : defaultPath;
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl shadow-cta mb-4">
            <span
              className="material-symbols-outlined text-on-primary"
              style={{ fontSize: '32px', fontVariationSettings: "'FILL' 1" }}
            >
              lock
            </span>
          </div>
          <h1 className="text-headline-xl text-primary font-bold">LockerSystem</h1>
          <p className="text-body-md text-on-surface-variant mt-1">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-surface-white rounded-3xl shadow-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-label-md text-on-surface font-medium" htmlFor="username">
                Username
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
                  style={{ fontSize: '20px' }}
                >
                  person
                </span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                  placeholder="Enter your username"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-label-md text-on-surface font-medium" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
                  style={{ fontSize: '20px' }}
                >
                  key
                </span>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl border border-outline-variant bg-surface-container-lowest text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 bg-error/10 text-error text-body-md rounded-xl px-4 py-3 border border-error/20">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  error
                </span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary text-body-md font-semibold py-4 rounded-xl hover:opacity-90 transition-all active:scale-[0.98] shadow-cta disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-label-md text-on-surface-variant mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-secondary font-semibold hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
