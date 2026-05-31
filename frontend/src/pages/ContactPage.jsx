import { useState } from 'react';
import TopNavBar from '../components/TopNavBar';
import Footer from '../components/Footer';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate API delay
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    }, 1200);
  };

  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col">
      <TopNavBar />

      <main className="flex-grow pt-36 pb-section-padding px-margin-mobile md:px-margin-desktop md:pt-24 max-w-5xl mx-auto w-full">
        <header className="mb-12 text-center md:text-left">
          <h1 className="text-display-lg text-primary font-bold mb-3">Contact Us</h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl">
            Have questions about LockerSystem? Reach out to us, and our team will get back to you as soon as possible.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
          {/* Contact Info Column */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6 sm:p-8 shadow-card space-y-6">
              <h2 className="text-headline-md font-bold text-primary">Get in Touch</h2>
              <p className="text-body-md text-on-surface-variant leading-relaxed">
                Whether you are a developer configuring ESP32 cabinets or an administrator managing lockers, we are here to support you.
              </p>

              <div className="space-y-4">
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">mail</span>
                  </div>
                  <div>
                    <span className="text-label-sm text-on-surface-variant block">Email Address</span>
                    <a
                      href="mailto:nampham.name@gmail.com"
                      className="text-body-md font-semibold text-primary hover:underline"
                    >
                      nampham.name@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">location_on</span>
                  </div>
                  <div>
                    <span className="text-label-sm text-on-surface-variant block">Location</span>
                    <span className="text-body-md font-semibold text-on-surface">
                      Hanoi, Vietnam
                    </span>
                  </div>
                </div>

                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 rounded-2xl bg-tertiary/10 text-tertiary flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined">schedule</span>
                  </div>
                  <div>
                    <span className="text-label-sm text-on-surface-variant block">Support Hours</span>
                    <span className="text-body-md font-semibold text-on-surface">
                      Monday - Friday: 9 AM - 6 PM (ICT)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-tr from-primary/10 to-secondary/10 rounded-3xl p-6 sm:p-8 border border-outline-variant/10">
              <h3 className="text-title-lg font-bold text-primary mb-2">Looking for Documentation?</h3>
              <p className="text-body-sm text-on-surface-variant mb-4">
                Explore our detailed ESP32 C++ client source guides and admin workflows to resolve configurations quickly.
              </p>
              <a
                href="/documentation"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm"
              >
                <span>Browse Docs</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>arrow_forward</span>
              </a>
            </div>
          </div>

          {/* Contact Form Column */}
          <div className="md:col-span-3 bg-surface-container-lowest border border-outline-variant/10 rounded-3xl p-6 sm:p-8 shadow-card">
            {submitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 mx-auto flex items-center justify-center animate-bounce">
                  <span className="material-symbols-outlined text-3xl font-bold">check</span>
                </div>
                <h3 className="text-headline-md font-bold text-primary">Message Sent!</h3>
                <p className="text-body-md text-on-surface-variant max-w-sm mx-auto">
                  Thank you for reaching out. We have received your message and will respond to you at your email address shortly.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-2.5 rounded-xl border border-outline-variant text-on-surface text-label-md hover:bg-surface-container-low transition-all font-semibold"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h2 className="text-headline-md font-bold text-primary mb-2">Send a Message</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-label-md text-on-surface-variant mb-1.5 block">Your Name</label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="John Doe"
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-label-md text-on-surface-variant mb-1.5 block">Email Address</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="john@example.com"
                      className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-label-md text-on-surface-variant mb-1.5 block">Subject</label>
                  <input
                    type="text"
                    required
                    value={form.subject}
                    onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                    placeholder="How can we help you?"
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                  />
                </div>

                <div>
                  <label className="text-label-md text-on-surface-variant mb-1.5 block">Message</label>
                  <textarea
                    required
                    rows="5"
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    placeholder="Type your message details here..."
                    className="w-full px-4 py-3 rounded-xl border border-outline-variant bg-background text-body-md focus:outline-none focus:ring-2 focus:ring-secondary transition-all resize-none"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-primary text-on-primary text-label-md font-semibold hover:opacity-90 active:scale-95 transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
                    {submitting ? 'sync' : 'send'}
                  </span>
                  <span>{submitting ? 'Sending Message...' : 'Send Message'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
