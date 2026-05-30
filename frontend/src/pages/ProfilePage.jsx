import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const emptyPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-2 border-b border-outline-variant/10 px-4 py-4 last:border-b-0 sm:grid sm:grid-cols-[150px_1fr] sm:items-center sm:gap-4">
      <span className="text-label-md font-semibold text-on-surface">{label}</span>
      {children}
    </label>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { logout, updateUser } = useAuth();
  const [profile, setProfile] = useState({
    username: '',
    email: '',
    name: '',
    role: '',
    createdAt: '',
  });
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const initials = useMemo(() => {
    const source = profile.name || profile.username || 'User';
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }, [profile.name, profile.username]);

  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).getFullYear()
    : '—';

  useEffect(() => {
    let ignore = false;
    fetch('/api/profile', { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load profile');
        return data;
      })
      .then((data) => {
        if (!ignore) {
          setProfile({
            username: data.username || '',
            email: data.email || '',
            name: data.name || '',
            role: data.role || '',
            createdAt: data.createdAt || '',
          });
        }
      })
      .catch((err) => {
        if (!ignore) setMessage({ type: 'error', text: err.message });
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleSave = async () => {
    setMessage(null);

    const trimmedName = profile.name.trim();
    if (!trimmedName) {
      setMessage({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }

    const wantsPasswordChange = passwordForm.currentPassword || passwordForm.newPassword || passwordForm.confirmPassword;
    if (wantsPasswordChange) {
      if (!passwordForm.currentPassword || !passwordForm.newPassword) {
        setMessage({ type: 'error', text: 'Enter current password and new password.' });
        return;
      }
      if (passwordForm.newPassword.length < 8) {
        setMessage({ type: 'error', text: 'New password must be at least 8 characters.' });
        return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setMessage({ type: 'error', text: 'Password confirmation does not match.' });
        return;
      }
    }

    setSaving(true);
    try {
      const body = {
        name: trimmedName,
        ...(wantsPasswordChange
          ? {
              currentPassword: passwordForm.currentPassword,
              newPassword: passwordForm.newPassword,
            }
          : {}),
      };

      const res = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save profile');

      setProfile((current) => ({ ...current, ...data.user }));
      updateUser(data.user);
      setPasswordForm(emptyPasswordForm);
      setMessage({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-low text-on-surface">
      <header className="fixed top-0 z-50 flex h-14 w-full items-center justify-between border-b border-outline-variant/10 px-margin-mobile shadow-sm glass">
        <button onClick={() => navigate(-1)} className="flex min-w-20 items-center text-secondary transition-opacity hover:opacity-80">
          <span className="material-symbols-outlined mr-1" style={{ fontSize: '20px' }}>arrow_back_ios</span>
          <span className="text-body-md font-semibold">Back</span>
        </button>
        <div className="text-headline-md font-bold text-primary">Profile</div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="min-w-20 text-right text-body-md font-semibold text-secondary transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-margin-mobile pb-10 pt-24">
        <section className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-primary text-display-lg-mobile font-bold text-on-primary shadow-card">
            {initials}
          </div>
          <h1 className="mb-1 max-w-full truncate text-headline-md font-bold text-primary">{profile.name || profile.username || 'User'}</h1>
          <p className="text-body-md text-on-surface-variant">
            {profile.role || 'USER'} · Member since {memberSince}
          </p>
        </section>

        {message && (
          <div className={`mb-4 rounded-xl border px-4 py-3 text-body-md ${
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-700'
              : 'border-red-500/30 bg-red-500/10 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <section className="mb-6 overflow-hidden rounded-xl bg-surface-white shadow-card">
          <Field label="Full name">
            <input
              className="min-h-11 w-full rounded-lg border border-outline-variant/20 bg-white px-3 text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
              type="text"
              value={profile.name}
              onChange={(e) => setProfile((current) => ({ ...current, name: e.target.value }))}
              disabled={loading || saving}
              autoComplete="name"
            />
          </Field>
          <Field label="Username">
            <input
              className="min-h-11 w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 text-body-md text-on-surface-variant outline-none"
              type="text"
              value={profile.username}
              readOnly
              disabled
            />
          </Field>
          <Field label="Email">
            <input
              className="min-h-11 w-full rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 text-body-md text-on-surface-variant outline-none"
              type="email"
              value={profile.email}
              readOnly
              disabled
            />
          </Field>
        </section>

        <section className="mb-6 overflow-hidden rounded-xl bg-surface-white shadow-card">
          <Field label="Current password">
            <input
              className="min-h-11 w-full rounded-lg border border-outline-variant/20 bg-white px-3 text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((current) => ({ ...current, currentPassword: e.target.value }))}
              disabled={loading || saving}
              autoComplete="current-password"
            />
          </Field>
          <Field label="New password">
            <input
              className="min-h-11 w-full rounded-lg border border-outline-variant/20 bg-white px-3 text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((current) => ({ ...current, newPassword: e.target.value }))}
              disabled={loading || saving}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Confirm password">
            <input
              className="min-h-11 w-full rounded-lg border border-outline-variant/20 bg-white px-3 text-body-md text-on-surface outline-none transition-colors focus:border-secondary"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((current) => ({ ...current, confirmPassword: e.target.value }))}
              disabled={loading || saving}
              autoComplete="new-password"
            />
          </Field>
        </section>

        <button
          onClick={async () => {
            try {
              await logout();
              navigate('/login', { replace: true });
            } catch (err) {
              setMessage({ type: 'error', text: err.message || 'Logout failed.' });
            }
          }}
          className="w-full rounded-xl bg-surface-white px-4 py-4 text-body-md font-semibold text-error shadow-card transition-all hover:bg-surface-container-lowest active:scale-[0.98]"
        >
          Sign Out
        </button>
      </main>
    </div>
  );
}
