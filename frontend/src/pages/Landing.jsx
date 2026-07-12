import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Landing.css';

export default function Landing() {
  const { user, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const [openFaq, setOpenFaq] = useState({});

  useEffect(() => {
    if (searchParams.get('error')) {
      setError('GitHub sign-in failed. Please try again.');
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const toggleFaq = (index) => {
    setOpenFaq((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const asciiLogoText = `
 ___  ____ _  _ _  _ ____ ____ ___ 
 |  \\ |___ |  | |--| |___ |__|  |  
 |__/ |___  \\/  |  | |___ |  |  |  
  `;

  return (
    <section className="landing">
      <h1>One link for all your coding activity</h1>
      <p className="landing-sub">
        Sign in with GitHub, add your Codeforces and LeetCode handles, and get a shareable heatmap of
        everything you've built and solved.
      </p>

      {error && <p className="landing-error">{error}</p>}

      {!loading &&
        (user ? (
          <Link className="btn-primary" to={`/u/${user.githubUsername}`}>
            View my profile
          </Link>
        ) : (
          <a className="btn-primary" href={`${import.meta.env.VITE_API_URL}/api/auth/github`}>
            Sign in with GitHub
          </a>
        ))}

      <hr className="section-divider" />

      {/* Features Grid */}
      <div className="marketing-section" style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
        <h2>Core Features</h2>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            </div>
            <h3>Unified Heatmap</h3>
            <p>Combines commits, issues, pull requests, and competitive programming solutions into a single grid.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h3l3 -9l5 18l3 -9h5"/></svg>
            </div>
            <h3>Background Sync</h3>
            <p>Serves cached profiles instantly, pulling fresh data asynchronously behind the scenes.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <h3>Privacy First</h3>
            <p>Doesn't require write access scope to your repositories. Read-only user data is encrypted at rest.</p>
          </div>
        </div>
      </div>

      <hr className="section-divider" />

      {/* FAQ Section */}
      <div className="marketing-section">
        <h2>Frequently Asked Questions</h2>

        <div className="faq-row">
          <div className="faq-question" onClick={() => toggleFaq(0)}>
            <span>How does background sync work?</span>
            <span className="faq-toggle-icon">{openFaq[0] ? '−' : '+'}</span>
          </div>
          <div className={`faq-collapse ${openFaq[0] ? 'open' : ''}`}>
            <div className="faq-answer">
              DevHeat serves cached data instantly when someone views your page. If the data is older than 24 hours, it launches an asynchronous sync job in the background to fetch updates, updating it for the next visit without making you wait.
            </div>
          </div>
        </div>

        <div className="faq-row">
          <div className="faq-question" onClick={() => toggleFaq(1)}>
            <span>Which platforms are supported?</span>
            <span className="faq-toggle-icon">{openFaq[1] ? '−' : '+'}</span>
          </div>
          <div className={`faq-collapse ${openFaq[1] ? 'open' : ''}`}>
            <div className="faq-answer">
              Currently, we support GitHub, Codeforces status, and LeetCode calendars. More developer platforms (like GitLab and HackerRank) are planned.
            </div>
          </div>
        </div>

        <div className="faq-row">
          <div className="faq-question" onClick={() => toggleFaq(2)}>
            <span>Is my personal data safe?</span>
            <span className="faq-toggle-icon">{openFaq[2] ? '−' : '+'}</span>
          </div>
          <div className={`faq-collapse ${openFaq[2] ? 'open' : ''}`}>
            <div className="faq-answer">
              Yes. We encrypt all access tokens at rest using AES-256-GCM, and we only ask for the minimum required read-only profile access (`read:user`) so we can read your public contribution calendar. We never request write permissions.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
