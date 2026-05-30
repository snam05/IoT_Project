import { Link } from 'react-router-dom';

const legalLinks = [
  { label: 'Privacy Policy', to: '#' },
  { label: 'Terms of Service', to: '#' },
];

const supportLinks = [
  { label: 'Support', to: '#' },
  { label: 'Documentation', to: '#' },
  { label: 'API Reference', to: '#' },
];

const companyLinks = [
  { label: 'About Us', to: '#' },
  { label: 'Careers', to: '#' },
  { label: 'Press', to: '#' },
];

function FooterLinkList({ links }) {
  return (
    <div className="flex flex-col gap-3">
      {links.map(({ label, to }) => (
        <Link
          key={label}
          to={to}
          className="text-label-md text-on-surface-variant hover:underline transition-all cursor-pointer"
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="bg-surface-bright text-on-surface w-full pt-section-padding pb-8 border-t border-outline-variant/20">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-gutter max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mb-16">
        {/* Brand */}
        <div className="col-span-2 md:col-span-1 mb-8 md:mb-0">
          <div className="font-bold text-primary text-headline-md mb-4">LockerSystem</div>
          <p className="text-label-md text-on-surface-variant">
            Smart storage solutions for the future.
          </p>
        </div>

        <FooterLinkList links={legalLinks} />
        <FooterLinkList links={supportLinks} />
        <FooterLinkList links={companyLinks} />
      </div>

      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop text-center md:text-left border-t border-outline-variant/10 pt-8">
        <p className="text-label-md text-on-surface-variant">
          © {new Date().getFullYear()} LockerSystem Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
