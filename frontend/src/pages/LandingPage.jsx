import { Link } from 'react-router-dom';
import TopNavBar from '../components/TopNavBar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: 'shield_lock',
    title: 'Multi-Layer Security',
    description:
      'Biometric authentication and one-time PIN system. Your data is encrypted at military-grade level, ensuring absolute safety for all personal belongings.',
    colSpan: 'md:col-span-2',
  },
  {
    icon: 'smartphone',
    title: 'App Control',
    description:
      'Unlock, grant access, and track usage history directly from your smartphone.',
    colSpan: '',
  },
  {
    icon: 'qr_code_scanner',
    title: 'Maximum Convenience',
    description:
      'Contactless parcel delivery. Integrated QR code scanning for fast courier service.',
    colSpan: '',
  },
  {
    icon: 'domain',
    title: 'Unlimited Scalability',
    description:
      'From small offices to large residential complexes, VaultSmart\'s modular system is easily customized and scaled to real-world needs.',
    colSpan: 'md:col-span-2',
  },
];

function FeatureCard({ icon, title, description, colSpan }) {
  return (
    <div
      className={`bg-surface-white rounded-3xl p-8 md:p-12 shadow-card hover:shadow-card-hover transition-shadow duration-300 ${colSpan}`}
    >
      <span
        className="material-symbols-outlined text-4xl text-secondary mb-6 block"
        style={{ fontVariationSettings: "'FILL' 1", fontSize: '36px' }}
      >
        {icon}
      </span>
      <h3 className="text-headline-md text-primary mb-4">{title}</h3>
      <p className="text-body-md text-on-surface-variant">{description}</p>
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const primaryAction = user?.role === 'ADMIN'
    ? { to: '/dashboard', label: 'Open Dashboard' }
    : user
      ? { to: '/scan', label: 'Scan QR Code' }
      : { to: '/login', label: 'Login' };

  return (
    <div className="bg-background text-on-surface antialiased">
      <TopNavBar />

      {/* Hero Section */}
      <section className="pt-40 pb-section-padding px-margin-mobile md:px-margin-desktop md:pt-32 max-w-container-max mx-auto text-center">
        <h1 className="font-bold text-primary mb-6 text-display-lg-mobile md:text-display-lg leading-[1.1] tracking-tight">
          Personal storage,<br />redefined.
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-10">
          VaultSmart delivers a smart storage experience with absolute security and elegant design.
          Perfect for every modern space.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
          <Link to={primaryAction.to}>
            <button className="bg-primary text-on-primary text-body-md font-semibold px-8 py-4 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-cta w-full sm:w-auto">
              {primaryAction.label}
            </button>
          </Link>
          {user?.role !== 'ADMIN' && (
            <Link to="/scan">
              <button className="text-secondary text-body-md font-semibold px-8 py-4 rounded-full hover:bg-surface-variant transition-colors active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto">
                Scan QR Code
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                  arrow_forward
                </span>
              </button>
            </Link>
          )}
        </div>

        {/* Hero Image */}
        <div className="relative w-full max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl bg-white border border-outline-variant/10 aspect-video flex items-center justify-center">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjHdMUSFoRFAyGvylf8PRPHAhi4nK2mVj31oZ0av_76Dcx_O5wOst-HIRMrr8dXvrVISQKgOIAzqzhd4tfn4Tj_N4BV3Vkaz0v1SoTgiraeJVRQN6SiFKcf0FT8Cf3vQoSnvkSb9pLpxTR_kXTSwweK0ssdfSFpo1fs5sffeEqMEhJcpHcPK-EhrI5N0h3DeTNthjxT4G7XFPNuM3a1u9Ycdnzh0UTe1R8n5QEK7ARSLFFFlEKnkZN78zv6LFpZ5ZVd0ECc15E75Bc"
            alt="VaultSmart Smart Locker System"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="py-section-padding px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-headline-xl text-primary mb-4">The Pinnacle of Storage Technology</h2>
          <p className="text-body-lg text-on-surface-variant">
            Smart Design. Maximum Security. Effortless Management.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
