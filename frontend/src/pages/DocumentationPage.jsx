import { useState } from 'react';
import TopNavBar from '../components/TopNavBar';
import Footer from '../components/Footer';

const DOCS_SECTIONS = [
  {
    id: 'overview',
    title: 'System Overview',
    icon: 'info',
    content: (
      <>
        <p>
          LockerSystem is an end-to-end, IoT-powered smart storage solution designed to simplify physical personal asset storage.
          The ecosystem consists of physical micro-controller integrated cabinets (ESP32), a lightweight secure Node.js backend
          powered by Prisma and SQLite/MySQL, and an elegant Apple Human Interface Guidelines-compliant React web client.
        </p>
        <p>
          Communication between physical smart hardware and the server is handled via MQTT protocols, offering secure, instant, 
          real-time locking and unlocking operations with offline fallback support using dynamic OTP verification.
        </p>
      </>
    ),
  },
  {
    id: 'user-guide',
    title: 'User Guide',
    icon: 'person',
    content: (
      <>
        <p>As a regular user, you can easily control and monitor your assigned compartments:</p>
        <div className="space-y-4 my-6">
          <div className="flex gap-4 items-start">
            <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <div>
              <strong className="text-primary block mb-0.5">Access the Locker App</strong>
              <span className="text-body-md">Log in to your LockerSystem portal on your mobile phone or desktop computer.</span>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <div>
              <strong className="text-primary block mb-0.5">Scan to Unlock</strong>
              <span className="text-body-md">Navigate to the QR Scanner menu, grant camera permissions, and point your camera at the cabinet compartment's QR code. The compartment door will pop open instantly.</span>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <div>
              <strong className="text-primary block mb-0.5">Manage Your Assets</strong>
              <span className="text-body-md">Close the cabinet door securely after placing or extracting your belongings. Locker logs will log the transaction.</span>
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'admin-guide',
    title: 'Admin Guide',
    icon: 'admin_panel_settings',
    content: (
      <>
        <p>Administrators have elevated control over the entire system network:</p>
        <ul className="list-disc pl-6 space-y-3 my-6">
          <li>
            <strong>Overview Dashboard:</strong> View stats including Total Lockers, Lockers In-Use, Available units, and maintenance requirements.
          </li>
          <li>
            <strong>Locker Management:</strong> Inspect real-time status of locker compartments. Locks or Unlocks doors remotely, or flags compartments for Maintenance. Lockers can be filtered by Cabinet or status.
          </li>
          <li>
            <strong>Cabinet Approvals:</strong> Approve or Reject new physical ESP32 cabinet devices trying to register with the secure system gateway. Lock or Unlock entire cabinets simultaneously.
          </li>
          <li>
            <strong>User Auditing & Logs:</strong> Monitor active users and review detailed audit trials (locker unlock timestamps, IP logging, backend commands history) for complete system transparency.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: 'build',
    content: (
      <>
        <p>If you encounter unexpected errors or hardware lockouts:</p>
        <div className="space-y-4 my-6">
          <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
            <h4 className="text-body-lg font-bold text-primary mb-2">Cabinet Offline Status</h4>
            <p className="text-body-md text-on-surface-variant">
              If the physical smart cabinet has lost Wi-Fi connection, you can generate a secure One-Time PIN (OTP) 
              offline in the Locker portal. Type the 6-digit pin directly into the cabinet physical numeric pad to gain access.
            </p>
          </div>
          <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10">
            <h4 className="text-body-lg font-bold text-primary mb-2">QR Code Parsing Errors</h4>
            <p className="text-body-md text-on-surface-variant">
              Ensure that your camera has enough lighting when scanning the locker's physical QR label. If the scan fails, 
              double-check your internet connection or log in using another browser/device.
            </p>
          </div>
        </div>
      </>
    ),
  },
];

export default function DocumentationPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col">
      <TopNavBar />
      
      <main className="flex-grow pt-36 pb-section-padding px-margin-mobile md:px-margin-desktop md:pt-24 max-w-5xl mx-auto w-full">
        <header className="mb-12">
          <h1 className="text-display-lg text-primary font-bold mb-3">Documentation</h1>
          <p className="text-body-lg text-on-surface-variant">
            Learn how to use, configure, and manage LockerSystem smart cabinets.
          </p>
        </header>

        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Sidebar Menu */}
          <aside className="w-full md:w-64 bg-surface-container-lowest border border-outline-variant/10 rounded-2xl p-3 flex flex-col gap-1.5 flex-shrink-0">
            {DOCS_SECTIONS.map((sec) => {
              const isSelected = activeTab === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveTab(sec.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-label-md font-semibold transition-all duration-200 text-left ${
                    isSelected
                      ? 'bg-primary text-on-primary shadow-sm'
                      : 'text-on-surface-variant hover:text-primary hover:bg-surface-container-low'
                  }`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {sec.icon}
                  </span>
                  {sec.title}
                </button>
              );
            })}
          </aside>

          {/* Docs Content */}
          <section className="flex-1 bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-8 md:p-10 shadow-card">
            {DOCS_SECTIONS.map((sec) => {
              if (activeTab !== sec.id) return null;
              return (
                <article key={sec.id} className="space-y-6 text-body-md text-on-surface-variant leading-relaxed">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="material-symbols-outlined text-primary text-3xl">{sec.icon}</span>
                    <h2 className="text-headline-xl text-primary font-bold">{sec.title}</h2>
                  </div>
                  {sec.content}
                </article>
              );
            })}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
