import { useState } from 'react';
import './ShareButton.css';

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="check-icon animate-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Native share sheet where supported (mostly mobile browsers), falling
// back to copy-to-clipboard everywhere else - most desktop browsers still
// don't implement navigator.share. Either way, one click hands off this
// exact profile URL - useful for the owner sharing their own profile, but
// left unconditional (not isOwnProfile-gated) since any visitor looking at
// a profile might want to pass it along too.
export default function ShareButton({ url, title, text }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        // AbortError just means the person closed the native share sheet
        // without picking anything - not a real failure, nothing to show.
        if (err.name !== 'AbortError') console.error('[ShareButton] share failed:', err);
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[ShareButton] clipboard write failed:', err);
    }
  }

  return (
    <button 
      type="button" 
      className={`btn-secondary share-profile-btn ${copied ? 'copied' : ''}`} 
      onClick={handleClick}
    >
      {copied ? <CheckIcon /> : <ShareIcon />}
      <span>{copied ? 'Copied!' : 'Share'}</span>
    </button>
  );
}
