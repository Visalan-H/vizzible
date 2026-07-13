// Purely static marketing content - no props, no state. Split out of
// Landing.jsx so that file stays focused on composing sections rather than
// holding hundreds of lines of markup inline.
export default function FeaturesSection() {
  return (
    <div className="marketing-section features-section">
      <h2>Core Features</h2>

      <div className="features-list">
        <div className="feature-row">
          <div className="feature-text">
            <span className="feature-label">01 / INTEGRATION</span>
            <h3>Unified Coding Heatmap</h3>
            <p>
              No more clicking through multiple profiles to check activity. We query, aggregate, and normalize
              contribution data from GitHub, LeetCode, and Codeforces into a single high-intensity activity calendar.
            </p>
          </div>

          <div className="feature-visual pipeline-mock">
            <div className="pipeline-header">
              <span className="pipeline-title">Unified Sync Pipeline</span>
            </div>
            <div className="pipeline-body">
              <div className="pipeline-sources">
                <div className="pipeline-source github">
                  <span className="source-dot"></span>
                  <span className="source-name font-mono">github/gitstar</span>
                  <span className="source-status font-mono">+12</span>
                </div>
                <div className="pipeline-source leetcode">
                  <span className="source-dot"></span>
                  <span className="source-name font-mono">leetcode/star</span>
                  <span className="source-status font-mono">+3</span>
                </div>
                <div className="pipeline-source codeforces">
                  <span className="source-dot"></span>
                  <span className="source-name font-mono">codeforces/star_cf</span>
                  <span className="source-status font-mono">+8</span>
                </div>
              </div>

              <div className="pipeline-arrow font-mono">──►</div>

              <div className="pipeline-destination">
                <div className="destination-card">
                  <div className="destination-title font-mono">Combined</div>
                  <div className="destination-value font-mono">+23</div>
                  <div className="destination-dots">
                    <span className="active-cell l3"></span>
                    <span className="active-cell l1"></span>
                    <span className="active-cell l4"></span>
                    <span className="active-cell l2"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="feature-row">
          <div className="feature-text">
            <span className="feature-label">02 / ARCHITECTURE</span>
            <h3>Zero-Wait Background Sync</h3>
            <p>
              Speed is a feature. Visitors see your developer profile instantly with cached data. If the cached state
              is older than 24 hours, Vizzible triggers an asynchronous sync process in the background to update the
              data for subsequent visits.
            </p>
          </div>

          <div className="feature-visual flow-mock">
            <div className="flow-step">
              <div className="flow-step-icon">👤</div>
              <div className="flow-step-title">Visitor Views Profile</div>
            </div>
            <div className="flow-line active">
              <div className="flow-line-label">Served Cache (0.01s)</div>
            </div>
            <div className="flow-step active">
              <div className="flow-step-icon">⚡</div>
              <div className="flow-step-title">Page Fully Rendered</div>
            </div>
            <div className="flow-line-down"></div>
            <div className="flow-step secondary">
              <div className="flow-step-icon">🔄</div>
              <div className="flow-step-title">Async Background Sync</div>
            </div>
          </div>
        </div>

        <div className="feature-row">
          <div className="feature-text">
            <span className="feature-label">03 / SECURITY</span>
            <h3>Safe & Encrypted Keys</h3>
            <p>
              We only ask for read-only credentials (`read:user`) to fetch your public GitHub calendar. We encrypt
              all access tokens at rest using industry-grade AES-256-GCM. We never request repository write access.
            </p>
          </div>

          <div className="feature-visual code-mock">
            <div className="code-header">
              <span className="code-dot red"></span>
              <span className="code-dot yellow"></span>
              <span className="code-dot green"></span>
              <span className="code-title">security.json</span>
            </div>
            <div className="code-body font-mono">
              <pre>
                {`{
  "username": "gitstar",
  "scopes": ["read:user"],
  "encryption": "aes-256-gcm",
  "githubToken": "`}
                <span className="code-encrypted">iv:tag:cipher:48b2...a89c</span>
                {`"
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
