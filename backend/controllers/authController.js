const crypto = require('crypto');
const axios = require('axios');
const User = require('../models/User');
const { signSession } = require('../utils/jwt');
const { encrypt } = require('../utils/crypto');

const STATE_COOKIE = 'oauth_state';

// Shared by every place that sets/clears the session or state cookie, so
// the httpOnly/secure/sameSite trio can't drift out of sync between them -
// a clearCookie() call with different options than the original set()
// silently fails to actually clear the cookie.
function cookieOptions(maxAge) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    ...(maxAge != null && { maxAge }),
  };
}

function redirectToGithub(req, res) {
  // Random per-attempt state, stored in a short-lived httpOnly cookie and
  // checked against what GitHub echoes back on callback. Without this, an
  // attacker can start their own OAuth flow, hand the resulting callback
  // URL to a victim, and get the victim's session bound to the attacker's
  // GitHub account (login CSRF).
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, cookieOptions(5 * 60 * 1000));

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: process.env.GITHUB_OAUTH_CALLBACK_URL,
    scope: 'read:user',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
}

async function handleGithubCallback(req, res) {
  const { code, state } = req.query;
  const expectedState = req.cookies[STATE_COOKIE];
  res.clearCookie(STATE_COOKIE, cookieOptions());

  if (!state || !expectedState || state !== expectedState) {
    return res.redirect(`${process.env.CLIENT_URL}/?error=github_oauth_failed`);
  }

  let user;
  try {
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) {
      return res.redirect(`${process.env.CLIENT_URL}/?error=github_oauth_failed`);
    }

    const { data: githubUser } = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    user = await User.findOneAndUpdate(
      { githubId: githubUser.id },
      { githubId: githubUser.id, githubUsername: githubUser.login, githubAccessToken: encrypt(accessToken) },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Covers the GitHub API calls, encrypt() (e.g. a missing/malformed
    // TOKEN_ENCRYPTION_KEY), and the Mongo upsert - any of these failing
    // mid-login should redirect back to the app, not surface a raw 500.
    console.error('[oauth] GitHub sign-in failed:', err.message);
    return res.redirect(`${process.env.CLIENT_URL}/?error=github_oauth_failed`);
  }

  const session = signSession(user._id.toString());
  res.cookie('session', session, cookieOptions(30 * 24 * 60 * 60 * 1000));

  res.redirect(`${process.env.CLIENT_URL}/${user.githubUsername}`);
}

async function getCurrentUser(req, res) {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    githubUsername: user.githubUsername,
    codeforcesHandle: user.codeforcesHandle,
    leetcodeUsername: user.leetcodeUsername,
  });
}

function logout(req, res) {
  res.clearCookie('session', cookieOptions());
  res.status(204).end();
}

module.exports = { redirectToGithub, handleGithubCallback, getCurrentUser, logout };
