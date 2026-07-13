import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Hero from '../components/landing/Hero';
import MockDashboard from '../components/landing/MockDashboard';
import FeaturesSection from '../components/landing/FeaturesSection';
import FaqSection from '../components/landing/FaqSection';
import CursorTrail from '../components/landing/CursorTrail';
import SideDecorations from '../components/landing/SideDecorations';
import './Profile.css';
import './Landing.css';

export default function Landing() {
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState(null);

  useEffect(() => {
    if (searchParams.get('error')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('GitHub sign-in failed. Please try again.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <section className="landing">
      <CursorTrail />
      <SideDecorations />
      <Hero user={user} loading={loading} error={error} />

      {/* Real-profile styled Mock Dashboard (Hero Asset) */}
      <MockDashboard />

      <hr className="section-divider" />
      <FeaturesSection />

      <hr className="section-divider" />
      <FaqSection />
    </section>
  );
}
