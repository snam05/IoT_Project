import TopNavBar from '../components/TopNavBar';
import Footer from '../components/Footer';

export default function TermsPage() {
  return (
    <div className="bg-background text-on-surface antialiased min-h-screen flex flex-col">
      <TopNavBar />
      
      <main className="flex-grow pt-36 pb-section-padding px-margin-mobile md:px-margin-desktop md:pt-24 max-w-3xl mx-auto">
        <header className="mb-12">
          <h1 className="text-display-lg text-primary font-bold mb-3">Terms of Service</h1>
          <p className="text-body-lg text-on-surface-variant">Last updated: May 30, 2026</p>
        </header>

        <article className="prose prose-slate max-w-none text-body-md text-on-surface-variant space-y-8">
          <section className="space-y-4">
            <h2 className="text-headline-md text-primary font-bold">1. Agreement to Terms</h2>
            <p>
              These Terms of Service constitute a legally binding agreement made between you, whether personally or on behalf 
              of an entity, and LockerSystem Inc., concerning your access to and use of our smart locker network.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-headline-md text-primary font-bold">2. User Representations</h2>
            <p>
              By using the Services, you represent and warrant that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>All registration information you submit will be true, accurate, current, and complete.</li>
              <li>You will maintain the accuracy of such information and promptly update it as necessary.</li>
              <li>You have the legal capacity and agree to comply with these Terms of Service.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-headline-md text-primary font-bold">3. Locker Usage Rules</h2>
            <p>
              You agree to use the physical locker compartments only for lawful personal storage. Storing hazardous, 
              illegal, flammable, or perishable items in the compartments is strictly prohibited. We reserve the 
              right to open, audit, or restrict access to any compartment at our sole discretion.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-headline-md text-primary font-bold">4. Limitation of Liability</h2>
            <p>
              In no event will LockerSystem, our directors, employees, or agents be liable to you or any third party for 
              any direct, indirect, consequential, exemplary, incidental, special, or punitive damages, including lost 
              belongings, data, or profits, arising from your use of the physical compartments or virtual services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-headline-md text-primary font-bold">5. Modifications and Interruptions</h2>
            <p>
              We reserve the right to change, modify, or remove the contents of the Services at any time or for any 
              reason at our sole discretion without notice. We will not be liable to you or any third party for any 
              modification, suspension, or discontinuance of the Services.
            </p>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}
