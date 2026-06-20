const CLIENT_ID    = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || "http://127.0.0.1:5173";

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function generatePKCE() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(hash) };
}

export function buildAuthUrl(challenge) {
  const state = crypto.randomUUID();
  sessionStorage.setItem('sp_state', state);
  return 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         'code',
    redirect_uri:          REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
    state,
    scope: 'streaming user-read-email user-read-private',
  });
}

export async function exchangeCode(code, verifier) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
      client_id:     CLIENT_ID,
      code_verifier: verifier,
    }),
  });
  if (!r.ok) return {};
  return r.json();
}

export async function refreshAccessToken(refreshToken) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     CLIENT_ID,
    }),
  });
  if (!r.ok) return {};
  return r.json();
}

export async function searchTrack(token, song, artist, language = "English") {
  const market = language === "English" ? "US" : "IN";

  // Fire all three strategies in parallel — take best result in priority order
  const queries = [
    `track:"${song}" artist:"${artist}"`,
    `${song} ${artist}`,
    `${song}`,
  ];

  const results = await Promise.allSettled(
    queries.map(q =>
      fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=3&market=${market}`,
        { headers: { Authorization: `Bearer ${token}` } }
      ).then(r => r.ok ? r.json() : null)
    )
  );

  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const items = r.value?.tracks?.items ?? [];
    const pick = items.find(t => t.is_playable !== false) ?? items[0];
    if (pick?.uri) return pick.uri;
  }
  return null;
}

export async function playUri(token, deviceId, uri) {
  const r = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method:  'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ uris: [uri] }),
    }
  );
  return { ok: r.ok, status: r.status };
}

export function loadSpotifySDK() {
  if (document.getElementById('sp-sdk')) return;
  const s = document.createElement('script');
  s.id  = 'sp-sdk';
  s.src = 'https://sdk.scdn.co/spotify-player.js';
  document.head.appendChild(s);
}
