import { useState } from 'react';

const FAQS = [
  {
    question: 'How does background sync work?',
    answer:
      "Vizzible serves cached activity instantly when someone views your page, so visitors never wait on external APIs. If the profile's cached data is older than 24 hours, Vizzible triggers an asynchronous sync job in the background to fetch fresh updates, refreshing it for subsequent visits.",
  },
  {
    question: 'Which platforms are currently supported?',
    answer:
      'Currently, we support GitHub contribution calendars, Codeforces submission status, and LeetCode activity calendars. More developer platforms (like GitLab and HackerRank) are on our roadmap.',
  },
  {
    question: 'Is my developer data and access token safe?',
    answer:
      'Yes. We encrypt all access tokens at rest using AES-256-GCM, and we only ask for the minimum required read-only profile access (`read:user`) so we can read your public contribution calendar. We never request write permissions.',
  },
  {
    question: 'What happens when I share my profile link?',
    answer:
      "Vizzible generates a live preview card for your profile - your avatar, tagline, active platform handles, and a 16-week combined heatmap - so it renders as a rich preview on Twitter, Discord, Slack, LinkedIn, and WhatsApp instead of a bare link. It updates automatically as your activity does.",
  },
];

// Defined at module scope (not inside FaqSection) so it's a stable component
// type across renders - defining it inside the parent would make React
// remount every FAQ item (losing open/closed state) on every toggle.
function FaqItem({ question, answer, open, onToggle }) {
  return (
    <div className={`faq-card ${open ? 'open' : ''}`} onClick={onToggle}>
      <div className="faq-question">
        <span>{question}</span>
        <span className="faq-icon-wrapper">
          <svg
            className="faq-chevron"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
      <div className="faq-collapse" onClick={(e) => e.stopPropagation()}>
        <div className="faq-answer">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default function FaqSection() {
  const [openFaq, setOpenFaq] = useState({});

  function toggleFaq(index) {
    setOpenFaq((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  return (
    <div className="marketing-section faq-section">
      <div className="faq-header">
        <h2>Frequently Asked Questions</h2>
        <p className="faq-subtitle">Everything you need to know about Vizzible profiles and sync mechanics.</p>
      </div>

      <div className="faq-list">
        {FAQS.map((faq, index) => (
          <FaqItem
            key={faq.question}
            question={faq.question}
            answer={faq.answer}
            open={!!openFaq[index]}
            onToggle={() => toggleFaq(index)}
          />
        ))}
      </div>
    </div>
  );
}
