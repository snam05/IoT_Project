import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState({
    name: 'John Smith',
    email: 'john.smith@example.com',
    password: '••••••••',
    memberSince: '2024',
    twoFa: false,
  });

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((data) => setProfile((p) => ({ ...p, ...data })))
      .catch(() => {}); // Use defaults on error
  }, []);

  const handleSave = () => {
    alert('Changes saved!');
  };

  return (
    <div className="font-body-md text-on-surface bg-surface-container-low min-h-screen">
      {/* iOS-style Header */}
      <header className="fixed top-0 w-full z-50 glass border-b border-outline-variant/10 shadow-sm h-14 flex items-center justify-between px-margin-mobile">
        <div className="flex-1">
          <button onClick={() => navigate(-1)} className="flex items-center text-secondary hover:opacity-80 transition-opacity">
            <span className="material-symbols-outlined mr-1" style={{ fontSize: '20px' }}>arrow_back_ios</span>
            <span className="text-body-md text-secondary">Settings</span>
          </button>
        </div>
        <div className="flex-1 text-center font-bold text-primary text-headline-md">Profile</div>
        <div className="flex-1 text-right">
          <button onClick={handleSave} className="text-body-md text-secondary font-semibold hover:opacity-80 transition-opacity">
            Save
          </button>
        </div>
      </header>

      <main className="pt-24 pb-8 px-margin-mobile max-w-lg mx-auto">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative w-24 h-24 mb-4">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC8GN29eeQeF0_fNqmyviyNnHgC3ZiS5iWYTCkxx_XRIf9rDY7ZR57u2Th3G_c5D0dqcweYHafWaFeq-dMg7-h9ceoicCJEmJ7VtzicRtg2gTsZT7fDa5XUn2yZOriZm9BLwBcPqx1wgZeNqJCqVlcRt9cBYpFGV7If4Ctc3aiVlUH5hKoo9hzVQQ1VnFYyz4ZbhxEcwXh0PWMDEqPuq-mMbiA8Zt3UGSuYSkqfhqR3Rydaz31qVg4ye-DG0jn1apzSr6znkZKE8nxv"
              alt="Profile"
              className="w-full h-full rounded-full object-cover border-2 border-white shadow-sm"
            />
            <button className="absolute bottom-0 right-0 bg-surface-container-highest rounded-full p-1 border border-outline-variant/20 shadow-sm flex items-center justify-center hover:opacity-80 transition-opacity active:scale-95">
              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: '16px' }}>edit</span>
            </button>
          </div>
          <h2 className="text-headline-md text-primary mb-1">{profile.name}</h2>
          <p className="text-body-md text-system-gray">Member since {profile.memberSince}</p>
        </div>

        {/* Form Fields */}
        <div className="ios-list-group mb-6">
          <div className="ios-list-item">
            <label className="text-body-md text-on-surface whitespace-nowrap">Full Name</label>
            <input
              className="ios-input text-body-md"
              type="text"
              value={profile.name}
              onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="ios-list-item">
            <label className="text-body-md text-on-surface whitespace-nowrap">Email</label>
            <input
              className="ios-input text-body-md"
              type="email"
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div className="ios-list-item">
            <label className="text-body-md text-on-surface whitespace-nowrap">Password</label>
            <input className="ios-input text-body-md" type="password" value={profile.password} readOnly />
          </div>
        </div>

        {/* Settings */}
        <div className="ios-list-group mb-8">
          <button className="ios-list-item w-full text-left hover:bg-surface-container-lowest transition-colors active:scale-[0.98] duration-200">
            <span className="text-body-md text-on-surface">Two-Factor Authentication (2FA)</span>
            <div className="flex items-center">
              <span className="text-body-md text-system-gray mr-2">{profile.twoFa ? 'On' : 'Off'}</span>
              <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: '20px' }}>chevron_right</span>
            </div>
          </button>
          <button className="ios-list-item w-full text-left hover:bg-surface-container-lowest transition-colors active:scale-[0.98] duration-200">
            <span className="text-body-md text-on-surface">Manage Active Sessions</span>
            <span className="material-symbols-outlined text-outline-variant" style={{ fontSize: '20px' }}>chevron_right</span>
          </button>
        </div>

        {/* Logout */}
        <div className="ios-list-group">
          <button className="ios-list-item w-full justify-center hover:bg-surface-container-lowest transition-colors active:scale-[0.98] duration-200">
            <span className="text-body-md text-error font-semibold">Sign Out</span>
          </button>
        </div>
      </main>
    </div>
  );
}
