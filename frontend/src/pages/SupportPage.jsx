import { useState } from 'react';
import TopNavBar from '../components/TopNavBar';
import Footer from '../components/Footer';

const FAQS = [
  {
    q: 'How do I open my assigned locker?',
    a: 'Simply scan the QR code located on the front of the smart locker cabinet using your camera or log in and navigate to the QR Scanner page. Once the code is scanned and verified, the cabinet door will unlock automatically.',
  },
  {
    q: 'What happens if I forget my password?',
    a: 'If you are unable to log in, please reach out to your administrator to reset your credentials. If you are already logged in, you can update your password directly inside your profile settings.',
  },
  {
    q: 'Who do I contact for physical hardware malfunctions?',
    a: 'For any issues with cabinet door latches, physical damages, or power loss, please submit a support ticket via the contact form on this page or contact the building\'s system administrator.',
  },
];

export default function SupportPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [activeFaq, setActiveFaq] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setForm({ name: '', email: '', subject: '', message: '' });
  };

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col">
      <TopNavBar />
      
      <main className="flex-grow pt-36 pb-section-padding px-margin-mobile md:px-margin-desktop md:pt-24 max-w-5xl mx-auto w-full">
        <header className="mb-16 text-center max-w-2xl mx-auto">
          <h1 className="text-display-lg text-primary font-bold mb-4">Support Center</h1>
          <p className="text-body-lg text-on-surface-variant">
            How can we help you today? Send us a ticket or browse our frequently asked questions.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start mb-16">
          {/* Contact Support Form */}
          <div className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/10 shadow-card">
            <h2 className="text-headline-md text-primary font-bold mb-6">Submit a Ticket</h2>
            
            {submitted ? (
              <div className="py-8 text-center space-y-4">
                <span className="material-symbols-outlined text-green-500 text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check_circle
                </span>
                <h3 className="text-headline-sm text-primary font-bold">Ticket Submitted!</h3>
                <p className="text-body-md text-on-surface-variant">
                  We have received your message. Our technical support team will contact you via email shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 rounded-full bg-primary text-on-primary text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all mt-4"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-label-md text-on-surface-variant mb-1.5 block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="text-label-md text-on-surface-variant mb-1.5 block">Email Address</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                    placeholder="Enter your email"
                  />
                </div>
                <div>
                  <label className="text-label-md text-on-surface-variant mb-1.5 block">Subject</label>
                  <input
                    type="text"
                    required
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                    placeholder="Brief summary of the issue"
                  />
                </div>
                <div>
                  <label className="text-label-md text-on-surface-variant mb-1.5 block">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary transition-all resize-none"
                    placeholder="Describe your request in detail..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-4.5 rounded-full bg-primary text-on-primary text-body-md font-semibold hover:opacity-90 active:scale-95 transition-all shadow-cta"
                >
                  Submit Support Ticket
                </button>
              </form>
            )}
          </div>

          {/* FAQ Accordion */}
          <div className="space-y-6">
            <h2 className="text-headline-md text-primary font-bold mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {FAQS.map((faq, idx) => {
                const isOpen = activeFaq === idx;
                return (
                  <div
                    key={idx}
                    className="bg-surface-container-lowest border border-outline-variant/10 rounded-2xl overflow-hidden hover:shadow-card transition-shadow"
                  >
                    <button
                      onClick={() => setActiveFaq(isOpen ? null : idx)}
                      className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                    >
                      <span className="text-body-lg font-bold text-primary">{faq.q}</span>
                      <span
                        className={`material-symbols-outlined text-outline transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                      >
                        expand_more
                      </span>
                    </button>
                    
                    <div
                      className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-48 border-t border-outline-variant/10 opacity-100 py-5 px-6' : 'max-h-0 opacity-0 overflow-hidden'}`}
                    >
                      <p className="text-body-md text-on-surface-variant leading-relaxed">{faq.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
