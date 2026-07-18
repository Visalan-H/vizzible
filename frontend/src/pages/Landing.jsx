import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import useReveal from '../hooks/useReveal';
import Hero from '../components/landing/Hero';
import MockDashboard from '../components/landing/MockDashboard';
import FeaturesSection from '../components/landing/FeaturesSection';
import FaqSection from '../components/landing/FaqSection';
import SideDecorations from '../components/landing/SideDecorations';
import './Profile.css';
import './Landing.css';

export default function Landing() {
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState(null);

  const [featuresRef, featuresActive] = useReveal({ triggerOnce: true, threshold: 0.1 });
  const [faqRef, faqActive] = useReveal({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (searchParams.get('error')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('GitHub sign-in failed. Please try again.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <section className="landing">
      <SideDecorations />
      <Hero user={user} loading={loading} error={error} />

      {/* Real-profile styled Mock Dashboard (Hero Asset) */}
      <MockDashboard />

      <hr className="section-divider" />
      <div ref={featuresRef} className={`reveal-on-scroll ${featuresActive ? 'active' : ''}`} style={{ width: '100%' }}>
        <FeaturesSection />
      </div>

      <hr className="section-divider" />
      <div ref={faqRef} className={`reveal-on-scroll ${faqActive ? 'active' : ''}`} style={{ width: '100%' }}>
        <FaqSection />
      </div>
    </section>
  );
}
