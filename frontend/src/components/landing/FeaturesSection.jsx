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
              One heatmap for all your coding. We combine your activity from GitHub, LeetCode, and Codeforces into a single profile.
            </p>
          </div>

          <div className="feature-visual pipeline-mock">
            <div className="pipeline-header">
              <span className="pipeline-title">Sync Pipeline</span>
            </div>
            <div className="pipeline-body">
              <div className="pipeline-sources">
                <div className="pipeline-source github">
                  <span className="source-dot"></span>
                  <span className="source-name font-mono">github</span>
                  <span className="source-status font-mono">+12</span>
                </div>
                <div className="pipeline-source leetcode">
                  <span className="source-dot"></span>
                  <span className="source-name font-mono">leetcode</span>
                  <span className="source-status font-mono">+3</span>
                </div>
                <div className="pipeline-source codeforces">
                  <span className="source-dot"></span>
                  <span className="source-name font-mono">codeforces</span>
                  <span className="source-status font-mono">+8</span>
                </div>
              </div>

              <div className="pipeline-arrow font-mono">──►</div>

              <div className="pipeline-destination">
                <div className="destination-card">
                  <div className="destination-title font-mono">Total</div>
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
              Lightning fast profiles. We serve cached data instantly, and sync in the background so visitors never wait.
            </p>
          </div>

          <div className="feature-visual flow-mock">
            <div className="flow-step">
              <div className="flow-step-icon">👤</div>
              <div className="flow-step-title">Visitor Views</div>
            </div>
            <div className="flow-line active">
              <div className="flow-line-label">Cached (0.01s)</div>
            </div>
            <div className="flow-step active">
              <div className="flow-step-icon">⚡</div>
              <div className="flow-step-title">Page Ready</div>
            </div>
            <div className="flow-line-down"></div>
            <div className="flow-step secondary">
              <div className="flow-step-icon">🔄</div>
              <div className="flow-step-title">Background Sync</div>
            </div>
          </div>
        </div>

        <div className="feature-row">
          <div className="feature-text">
            <span className="feature-label">03 / SECURITY</span>
            <h3>Safe & Encrypted Keys</h3>
            <p>
              Secure by design. We only ask for read-only access and encrypt your tokens with AES-256-GCM. No write permissions required.
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
  "access": "read-only",
  "encryption": "aes-256-gcm",
  "token": "`}
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
