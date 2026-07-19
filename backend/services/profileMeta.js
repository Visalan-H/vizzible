function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// Renders the tiny server-side HTML page served at
// /api/profiles/:username/meta. Its only job is carrying OG/Twitter meta
// tags for link-preview crawlers (which don't execute the SPA's JS), then
// redirecting real browsers on to the actual profile page client-side.
function renderProfileMetaHTML(user, req) {
  if (!user) {
    return `
      <!DOCTYPE html>
      <html>
      <head><title>Profile Not Found</title></head>
      <body>Profile Not Found</body>
      </html>
    `;
  }

  const username = escapeXml(user.githubUsername);
  const tagline = escapeXml(user.tagline || 'Combine your heatmaps from GitHub, LeetCode, and Codeforces.');
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  const host = req.get('host');
  const protocol = req.protocol;
  const backendUrl = `${protocol}://${host}`;

  const ogImageUrl = `${backendUrl}/api/profiles/${user.githubUsername}/og-image`;
  const profileUrl = `${clientUrl}/${user.githubUsername}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${username} — Vizzible</title>
  <meta name="description" content="${tagline}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${profileUrl}">
  <meta property="og:title" content="${username} — Vizzible Profile">
  <meta property="og:description" content="${tagline}">
  <meta property="og:image" content="${ogImageUrl}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${profileUrl}">
  <meta name="twitter:title" content="${username} — Vizzible Profile">
  <meta name="twitter:description" content="${tagline}">
  <meta name="twitter:image" content="${ogImageUrl}">
  
  <!-- Client-side Redirect for humans -->
  <script>
    window.location.replace("${profileUrl}");
  </script>
</head>
<body>
  <p>Redirecting to ${username}'s profile on Vizzible...</p>
</body>
</html>`;
}

module.exports = { renderProfileMetaHTML };
