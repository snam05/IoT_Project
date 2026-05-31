import TopNavBar from '../components/TopNavBar';
import Footer from '../components/Footer';

export default function PrivacyPage() {
  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col">
      <TopNavBar />
      
      <main className="flex-grow pt-36 pb-section-padding px-margin-mobile md:px-margin-desktop md:pt-24 max-w-3xl mx-auto">
        <header className="mb-12">
          <h1 className="text-display-lg text-primary font-bold mb-3">Privacy Policy</h1>
          <p className="text-body-lg text-on-surface-variant">Last updated: May 30, 2026</p>
        </header>

        <article className="prose prose-slate max-w-none text-body-md text-on-surface-variant space-y-8">
          <section className="space-y-4">
            <h2 className="text-headline-md text-primary font-bold">1. Introduction</h2>
            <p>
              Welcome to LockerSystem. We are committed to protecting your personal information and your right to privacy. 
              If you have any questions or concerns about our policy, or our practices with regards to your personal info, 
              please contact us.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-headline-md text-primary font-bold">2. Information We Collect</h2>
            <p>
              We collect information that you voluntarily provide to us when registering at the services, expressing 
              an interest in obtaining information about us or our products, or otherwise contacting us.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Personal Data:</strong> Name, email address, username, and hashed credentials.</li>
              <li><strong>Device Logs:</strong> IP addresses, locker compartment usage history, and lock/unlock timestamps.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-headline-md text-primary font-bold">3. How We Use Your Information</h2>
            <p>
              We use personal information collected via our services for a variety of business purposes described below. 
              We process your personal information for these purposes in reliance on our legitimate business interests.
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>To facilitate account creation and logon process.</li>
              <li>To operate physical IoT smart cabinet locks securely.</li>
              <li>To record locker logs for security auditing.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-headline-md text-primary font-bold">4. Data Security</h2>
            <p>
              We have implemented appropriate technical and organizational security measures designed to protect the security 
              of any personal information we process. All password details are hashed securely using industry-standard hashing 
              algorithms (bcryptjs), and authentication is conducted over secure cookies.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-headline-md text-primary font-bold">5. Contact Us</h2>
            <p>
              If you have questions or comments about this policy, you may email us at 
              <span className="text-primary font-semibold"> nampham.name@gmail.com </span>.
            </p>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}
