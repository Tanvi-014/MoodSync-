import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
import {
  generatePKCE, buildAuthUrl, exchangeCode, refreshAccessToken,
  searchTrack, playUri, loadSpotifySDK,
} from "./spotify";
import WeatherParticles from "./WeatherParticles";
import WeatherPreview from "./WeatherPreview";

const MOODS = [
  "Happy", "Sad", "Stressed", "Focused", "Romantic",
  "Nostalgic", "Excited", "Calm", "Angry", "Heartbroken", "Party",
];

const MOOD_EMOJIS = {
  Happy: "🎵", Sad: "🎵", Stressed: "🎵", Focused: "🎵",
  Romantic: "🎵", Nostalgic: "🎵", Excited: "🎵", Calm: "🎵",
  Angry: "🎵", Heartbroken: "🎵", Party: "🎵",
};

const MOOD_COLORS = {
  Happy:       { text: "#86EFAC", bg: "rgba(134,239,172,0.1)",  border: "rgba(134,239,172,0.4)",  glow: "rgba(134,239,172,0.18)"  },
  Sad:         { text: "#93C5FD", bg: "rgba(147,197,253,0.1)",  border: "rgba(147,197,253,0.4)",  glow: "rgba(147,197,253,0.18)"  },
  Stressed:    { text: "#A78BFA", bg: "rgba(167,139,250,0.1)",  border: "rgba(167,139,250,0.4)",  glow: "rgba(167,139,250,0.18)"  },
  Focused:     { text: "#A5B4FC", bg: "rgba(165,180,252,0.1)",  border: "rgba(165,180,252,0.4)",  glow: "rgba(165,180,252,0.18)"  },
  Romantic:    { text: "#F9A8D4", bg: "rgba(249,168,212,0.1)",  border: "rgba(249,168,212,0.4)",  glow: "rgba(249,168,212,0.18)"  },
  Nostalgic:   { text: "#C4B5FD", bg: "rgba(196,181,253,0.1)",  border: "rgba(196,181,253,0.4)",  glow: "rgba(196,181,253,0.18)"  },
  Excited:     { text: "#38BDF8", bg: "rgba(56,189,248,0.1)",   border: "rgba(56,189,248,0.4)",   glow: "rgba(56,189,248,0.18)"   },
  Calm:        { text: "#6EE7B7", bg: "rgba(110,231,183,0.1)",  border: "rgba(110,231,183,0.4)",  glow: "rgba(110,231,183,0.18)"  },
  Angry:       { text: "#FCA5A5", bg: "rgba(252,165,165,0.1)",  border: "rgba(239,68,68,0.45)",   glow: "rgba(239,68,68,0.18)"    },
  Heartbroken: { text: "#94A3B8", bg: "rgba(148,163,184,0.1)",  border: "rgba(148,163,184,0.4)",  glow: "rgba(148,163,184,0.18)"  },
  Party:       { text: "#E879F9", bg: "rgba(232,121,249,0.1)",  border: "rgba(232,121,249,0.4)",  glow: "rgba(232,121,249,0.18)"  },
};

const LANGUAGES = [
  { label: "English",   flag: "🇬🇧" },
  { label: "Hindi",     flag: "🇮🇳" },
  { label: "Tamil",     flag: "🇮🇳" },
  { label: "Telugu",    flag: "🇮🇳" },
  { label: "Kannada",   flag: "🇮🇳" },
  { label: "Malayalam", flag: "🇮🇳" },
  { label: "Punjabi",   flag: "🇮🇳" },
  { label: "Bengali",   flag: "🇮🇳" },
  { label: "Marathi",   flag: "🇮🇳" },
  { label: "Gujarati",  flag: "🇮🇳" },
  { label: "Odia",      flag: "🇮🇳" },
  { label: "Bhojpuri",  flag: "🇮🇳" },
];

const WEATHER_ICONS = {
  Clear:        { emoji: "☀️", cls: "wx-sunny" },
  Night:        { emoji: "🌙", cls: "wx-night" },
  Rain:         { emoji: "🌧️", cls: "wx-rain"  },
  Clouds:       { emoji: "☁️", cls: "wx-cloud" },
  Thunderstorm: { emoji: "⛈️", cls: "wx-storm" },
  Mist:         { emoji: "🌫️", cls: "wx-mist"  },
  Snow:         { emoji: "❄️", cls: "wx-snow"  },
  Dust:         { emoji: "🌪️", cls: "wx-dust"  },
};

function WeatherIcon({ condition }) {
  const wx = WEATHER_ICONS[condition];
  if (!wx) return null;
  return <span className={`ms-wx-icon ${wx.cls}`}>{wx.emoji}</span>;
}

function formatTime(s) {
  if (!s || isNaN(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export default function App() {
  const [dark, setDark]       = useState(false);
  const [screen, setScreen]   = useState("onboard");

  // ── theme ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("ms-theme");
    if (saved) setDark(saved === "dark");
  }, []);
  useLayoutEffect(() => {
    if (screen === "player") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
      localStorage.setItem("ms-theme", dark ? "dark" : "light");
    }
  }, [dark, screen]);

  // form state
  const [mood, setMood]         = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [mode, setMode]         = useState("match");

  // app state
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [cursorNotes, setCursorNotes] = useState([]);

  // player state
  const [queue, setQueue]                   = useState([]);
  const [currentIndex, setCurrentIndex]     = useState(0);
  const [baseVibe, setBaseVibe]             = useState("");
  const [weatherCondition, setWeatherCondition] = useState("");
  const [weatherIsNight, setWeatherIsNight]     = useState(false);
  const [weatherTemp, setWeatherTemp]           = useState(null);
  const [weatherCity, setWeatherCity]           = useState("");
  const [playing, setPlaying]               = useState(false);
  const [progress, setProgress]             = useState(0);
  const [duration, setDuration]             = useState(0);

  // Spotify state
  const [spToken, setSpToken]   = useState(() => localStorage.getItem("sp_access") || "");
  const [spReady, setSpReady]   = useState(false);
  const [spActive, setSpActive] = useState(false); // true when Spotify is driving playback

  // refs
  const audioRef        = useRef(null);
  const intervalRef     = useRef(null);
  const playRequestRef  = useRef(0);
  const spPlayerRef     = useRef(null);
  const spDeviceRef     = useRef(null);
  const spTokenRef      = useRef(spToken);
  const queueRef        = useRef([]);
  const currentIdxRef   = useRef(0);
  const userPausedRef   = useRef(false);
  const spActiveRef     = useRef(false);
  const spReadyRef      = useRef(false);
  const hasProgressedRef = useRef(false);
  const sdkInitRef      = useRef(false); // prevents re-init on token refresh
  const [autoAdvanceTo, setAutoAdvanceTo] = useState(null);
  const consecutiveFailRef  = useRef(0);
  const spPremiumBlockedRef = useRef(false);
  const spCurrentUriRef    = useRef(null); // URI of the track we last asked Spotify to play
  const urlCacheRef         = useRef({});  // track key -> full audio URL
  const formBodyRef        = useRef(null);
  const noteCooldownRef    = useRef(0);

  // audio-reactive beat simulation
  const bassRef      = useRef(0);   // 0–1 float, read every frame by WeatherParticles
  const beatTimeRef  = useRef(0);
  const playerDivRef = useRef(null);

  // keep refs in sync
  useEffect(() => { spTokenRef.current    = spToken;  }, [spToken]);
  useEffect(() => { queueRef.current      = queue;    }, [queue]);
  useEffect(() => { currentIdxRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { spActiveRef.current   = spActive; }, [spActive]);
  useEffect(() => { spReadyRef.current    = spReady;  }, [spReady]);

  // ── Spotify: handle OAuth callback ────────────────────────────────────────
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const code     = params.get("code");
    const retState = params.get("state");
    const spError  = params.get("error");
    const verifier = sessionStorage.getItem("sp_verifier");
    const saved    = sessionStorage.getItem("sp_state");

    // User denied Spotify permission — remember so we don't auto-redirect again
    if (spError) {
      window.history.replaceState({}, "", "/");
      sessionStorage.removeItem("sp_state");
      sessionStorage.removeItem("sp_verifier");
      localStorage.setItem("sp_denied", "1");
      return;
    }

    if (code && retState && retState === saved && verifier) {
      window.history.replaceState({}, "", "/");
      sessionStorage.removeItem("sp_state");
      sessionStorage.removeItem("sp_verifier");

      exchangeCode(code, verifier).then(data => {
        if (data.access_token) {
          localStorage.setItem("sp_access",  data.access_token);
          localStorage.setItem("sp_refresh", data.refresh_token);
          localStorage.setItem("sp_expires", Date.now() + data.expires_in * 1000);
          setSpToken(data.access_token);
        }
      });
    }
  }, []);

  // ── Spotify: auto-connect on first load ──────────────────────────────────
  useEffect(() => {
    const alreadyHasToken = !!localStorage.getItem("sp_access");
    const denied          = !!localStorage.getItem("sp_denied");
    const inOAuthFlow     = !!new URLSearchParams(window.location.search).get("code")
                         || !!new URLSearchParams(window.location.search).get("error");

    if (!alreadyHasToken && !denied && !inOAuthFlow && import.meta.env.VITE_SPOTIFY_CLIENT_ID) {
      generatePKCE().then(({ verifier, challenge }) => {
        sessionStorage.setItem("sp_verifier", verifier);
        window.location.href = buildAuthUrl(challenge);
      });
    }
  }, []);

  // ── Spotify: init SDK when token is available ─────────────────────────────
  useEffect(() => {
    if (!spToken) return;
    if (sdkInitRef.current) return; // token refresh — getOAuthToken handles it, no re-init needed
    sdkInitRef.current = true;

    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: "MoodSync",
        getOAuthToken: async (cb) => {
          // proactively refresh if expiring soon
          const expires = parseInt(localStorage.getItem("sp_expires") || "0");
          if (Date.now() > expires - 60_000) {
            const refresh = localStorage.getItem("sp_refresh");
            if (refresh) {
              const data = await refreshAccessToken(refresh).catch(() => ({}));
              if (data.access_token) {
                localStorage.setItem("sp_access",  data.access_token);
                localStorage.setItem("sp_expires", Date.now() + data.expires_in * 1000);
                if (data.refresh_token) localStorage.setItem("sp_refresh", data.refresh_token);
                // Only update ref + storage — calling setSpToken would re-run the SDK init
                // effect and disconnect the player mid-playback
                spTokenRef.current = data.access_token;
                cb(data.access_token);
                return;
              }
            }
          }
          cb(spTokenRef.current);
        },
        volume: 0.8,
      });

      player.addListener("ready", ({ device_id }) => {
        spDeviceRef.current = device_id;
        setSpReady(true);
      });

      player.addListener("not_ready", () => {
        setSpReady(false);
        spReadyRef.current = false;
        // Immediately clear active state so we don't issue commands to a dead device
        if (spActiveRef.current) {
          setSpActive(false);
          spActiveRef.current = false;
          setPlaying(false);
        }
      });

      player.addListener("player_state_changed", (state) => {
        if (!state || !spActiveRef.current) return;

        setProgress(state.position / 1000);
        setDuration((state.duration || 0) / 1000);

        const sdkUri    = state.track_window?.current_track?.uri;
        const isOurTrack = !spCurrentUriRef.current || sdkUri === spCurrentUriRef.current;

        // Don't set playing=false during initial buffering (position=0, hasn't progressed yet)
        if (state.position > 0 || hasProgressedRef.current) {
          setPlaying(!state.paused);
        }

        // Only count as "progressed" when actively playing our track past 1s.
        // Spotify's transition events can fire with a stale non-zero position from the
        // previous track context — guarding on !paused + isOurTrack blocks that false positive
        // which was causing auto-advance to fire before the new track even started.
        if (!state.paused && state.position > 1000 && isOurTrack) {
          hasProgressedRef.current = true;
        }

        // Natural end: paused at position 0 with a known duration, user didn't pause,
        // track actually played >1s, AND SDK is reporting the track we started
        if (
          state.paused && state.position === 0 && (state.duration || 0) > 0 &&
          !userPausedRef.current && hasProgressedRef.current && isOurTrack
        ) {
          const next = currentIdxRef.current + 1;
          if (next < queueRef.current.length) {
            setAutoAdvanceTo(next);
          } else {
            setSpActive(false);
            spActiveRef.current = false;
            setPlaying(false);
          }
        }
      });

      player.connect();
      spPlayerRef.current = player;
    };

    loadSpotifySDK();

    // If SDK already loaded (hot reload), trigger manually
    if (window.Spotify) window.onSpotifyWebPlaybackSDKReady();

    return () => { spPlayerRef.current?.disconnect(); sdkInitRef.current = false; };
  }, [spToken]);

  // auto-advance triggered by Spotify track-end
  useEffect(() => {
    if (autoAdvanceTo === null) return;
    const idx = autoAdvanceTo;
    const q   = queueRef.current;
    setAutoAdvanceTo(null);
    playTrack(idx, q);
  }, [autoAdvanceTo]);

  // when Spotify SDK becomes ready while player is open and nothing is playing, start it
  useEffect(() => {
    if (!spReady) return;
    if (screen === "player" && queueRef.current.length > 0 && !spActiveRef.current && !audioRef.current) {
      playTrack(currentIdxRef.current, queueRef.current);
    }
  }, [spReady]);

  // progress polling when Spotify is active (SDK fires ~1s; we poll for smoothness)
  useEffect(() => {
    if (!spActive || !playing) return;
    const id = setInterval(async () => {
      const state = await spPlayerRef.current?.getCurrentState();
      if (state) setProgress(state.position / 1000);
    }, 250);
    return () => clearInterval(id);
  }, [spActive, playing]);

  // ── audio helpers ─────────────────────────────────────────────────────────
  const currentTrack = queue[currentIndex];

  function cleanupAudio() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlaying(false);
    setProgress(0);
    setDuration(0);
  }

  function startProgressTracking(audio) {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setProgress(audio.currentTime || 0);
      setDuration(audio.duration   || 0);
    }, 250);
  }

  // ── playTrack ─────────────────────────────────────────────────────────────
  async function playTrack(index, trackQueue) {
    const tq    = trackQueue ?? queueRef.current;
    const track = tq[index];
    if (!track) return;

    const requestId = ++playRequestRef.current;

    // Cancel everything before any awaits — stop Spotify immediately so old track
    // doesn't keep playing while we search for the next one
    if (spPlayerRef.current && spActiveRef.current) spPlayerRef.current.pause();
    cleanupAudio();
    setSpActive(false);
    spActiveRef.current      = false;
    hasProgressedRef.current = false;
    spCurrentUriRef.current  = null;
    setCurrentIndex(index);
    currentIdxRef.current = index;
    userPausedRef.current = false;

    // Full-song URL: check prefetch cache first, else fetch with 1.5s timeout.
    // Runs in parallel with Spotify so fallback is ready with zero extra wait.
    const trackKey = `${track.song}|||${track.artists?.[0] || ""}`;
    const saavnPromise = (async () => {
      const cached = urlCacheRef.current[trackKey];
      if (cached) return cached;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      try {
        const params = new URLSearchParams({ song: track.song, artist: track.artists[0] || "" });
        const res = await fetch(`${API_BASE}/full-url?${params}`, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          const d = await res.json();
          if (d?.url) urlCacheRef.current[trackKey] = d.url;
          return d?.url || null;
        }
      } catch {}
      return null;
    })();

    // ── Try Spotify first ──
    if (!spPremiumBlockedRef.current && spReadyRef.current && spTokenRef.current && spDeviceRef.current) {
      try {
        const uri = await searchTrack(spTokenRef.current, track.song, track.artists[0] || "", language);
        if (requestId !== playRequestRef.current) return;
        if (uri) {
          const { ok, status } = await playUri(spTokenRef.current, spDeviceRef.current, uri);
          if (requestId !== playRequestRef.current) return;
          if (ok) {
            consecutiveFailRef.current  = 0;
            spCurrentUriRef.current     = uri;
            setSpActive(true);
            spActiveRef.current = true;
            setPlaying(true);
            return;
          }
          // 403 = Spotify Premium required — skip Spotify for the rest of this session
          if (status === 403) spPremiumBlockedRef.current = true;
        }
      } catch {}
    }

    if (requestId !== playRequestRef.current) return;

    // ── Fallback: JioSaavn (already running) → iTunes preview ──
    let audioUrl = await saavnPromise;

    if (!audioUrl && track.preview_url) audioUrl = track.preview_url;

    if (requestId !== playRequestRef.current) return;

    if (!audioUrl) {
      consecutiveFailRef.current += 1;
      // stop cascading after 3 consecutive failures — avoid rapid queue skip-through
      if (consecutiveFailRef.current <= 3 && index < tq.length - 1) {
        playTrack(index + 1, tq);
      } else {
        consecutiveFailRef.current = 0;
      }
      return;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (requestId !== playRequestRef.current) return;
      setDuration(audio.duration || 0);
    };
    audio.onended = () => {
      if (requestId !== playRequestRef.current) return;
      const q = queueRef.current;
      if (index < q.length - 1) playTrack(index + 1, q);
      else cleanupAudio();
    };

    try {
      await audio.play();
      if (requestId !== playRequestRef.current) { audio.pause(); return; }
      consecutiveFailRef.current = 0;
      setPlaying(true);
      startProgressTracking(audio);
    } catch {
      if (requestId !== playRequestRef.current) return;
      consecutiveFailRef.current += 1;
      if (consecutiveFailRef.current <= 3 && index < tq.length - 1) {
        playTrack(index + 1, tq);
      } else {
        consecutiveFailRef.current = 0;
      }
    }
  }

  // ── playback controls ─────────────────────────────────────────────────────
  async function togglePlayPause() {
    if (spActive && spPlayerRef.current) {
      userPausedRef.current = playing;
      await spPlayerRef.current.togglePlay();
      return;
    }
    if (!audioRef.current) {
      playTrack(currentIndex);
      return;
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  function nextTrack() {
    const idx = currentIdxRef.current;
    const q   = queueRef.current;
    if (idx < q.length - 1) playTrack(idx + 1, q);
  }

  function prevTrack() {
    if (spActiveRef.current && spPlayerRef.current) {
      if (progress > 3) { spPlayerRef.current.seek(0); setProgress(0); return; }
    } else if (audioRef.current && progress > 3) {
      audioRef.current.currentTime = 0; setProgress(0); return;
    }
    const idx = currentIdxRef.current;
    const q   = queueRef.current;
    if (idx > 0) playTrack(idx - 1, q);
  }

  function goBack() {
    playRequestRef.current++;
    if (spPlayerRef.current && spActive) spPlayerRef.current.pause();
    cleanupAudio();
    setSpActive(false);
    spActiveRef.current = false;
    consecutiveFailRef.current = 0;
    setScreen("onboard");
  }

  // ── Spotify connect ───────────────────────────────────────────────────────
  async function connectSpotify() {
    const { verifier, challenge } = await generatePKCE();
    sessionStorage.setItem("sp_verifier", verifier);
    window.location.href = buildAuthUrl(challenge);
  }

  function disconnectSpotify() {
    spPlayerRef.current?.disconnect();
    spPlayerRef.current  = null;
    spDeviceRef.current  = null;
    sdkInitRef.current   = false;
    spCurrentUriRef.current = null;
    setSpToken("");
    setSpReady(false);
    localStorage.removeItem("sp_access");
    localStorage.removeItem("sp_refresh");
    localStorage.removeItem("sp_expires");
    localStorage.removeItem("sp_denied");
  }

  // ── cursor note spawner ───────────────────────────────────────────────────
  function handleBgMouseMove(e) {
    if (formBodyRef.current?.contains(e.target)) return;
    const now = Date.now();
    if (now - noteCooldownRef.current < 420) return;
    noteCooldownRef.current = now;
    const id  = now + Math.random();
    const note = {
      id,
      x:        e.clientX,
      y:        e.clientY,
      glyph:    ["♩","♪","♫","♬"][Math.floor(Math.random() * 4)],
      size:     Math.floor(Math.random() * 10) + 18,
      rotate:   Math.random() * 30 - 15,
      sway:     Math.random() * 22 - 11,
      duration: Math.random() * 1.5 + 2.2,
    };
    setCursorNotes(p => [...p, note]);
    setTimeout(() => setCursorNotes(p => p.filter(n => n.id !== id)), (note.duration + 0.3) * 1000);
  }

  // ── submit ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!mood) { setError("pick a mood"); return; }

    setError("");
    setLoading(true);
    consecutiveFailRef.current = 0;
    spPremiumBlockedRef.current = false;

    let lat = null, lon = null;
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
      );
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } catch {
      // denied or unavailable — backend defaults to Clear weather
    }

    try {
      const res = await fetch(`${API_BASE}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon, mood, language, mode }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail;
        const msg = Array.isArray(detail)
          ? detail.map(d => d.msg || JSON.stringify(d)).join(", ")
          : (detail || "something went wrong");
        throw new Error(msg);
      }

      const data = await res.json();
      if (!data.results?.length) { setError("no music found, try another vibe"); return; }

      setQueue(data.results);
      setBaseVibe(data.base_vibe);
      setWeatherCondition(data.weather || "");
      setWeatherIsNight(data.is_night || false);
      setWeatherTemp(data.temp_c ?? null);
      setWeatherCity(data.city_name || "");

      // Prefetch full-song URLs for every track in the background so
      // tracks 2-7 are cache-hits by the time the user reaches them
      data.results.forEach((t, i) => {
        if (i === 0) return; // track 0 is fetched immediately in playTrack
        const key = `${t.song}|||${t.artists?.[0] || ""}`;
        if (urlCacheRef.current[key] !== undefined) return;
        urlCacheRef.current[key] = null; // mark in-flight
        const params = new URLSearchParams({ song: t.song, artist: t.artists?.[0] || "" });
        fetch(`${API_BASE}/full-url?${params}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if (d?.url) urlCacheRef.current[key] = d.url; })
          .catch(() => {});
      });

      setScreen("player");
      playTrack(0, data.results);

    } catch (e) {
      setError(e.message === "Failed to fetch" ? "backend not running on port 8000" : e.message);
    } finally {
      setLoading(false);
    }
  }

  // beat simulation: drives WeatherParticles + album art pulse via CSS custom prop
  useEffect(() => {
    if (!playing) {
      bassRef.current = 0;
      playerDivRef.current?.style.setProperty("--audio-bass", "0");
      return;
    }
    let rafId;
    let prev = performance.now();

    function tick(now) {
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      beatTimeRef.current += dt;
      const bt = beatTimeRef.current;

      // ~120 BPM kick + offset snare, each sharpened with ^6 for tight transients
      const kick  = Math.pow(Math.max(0, Math.sin(bt * Math.PI * 2.0)), 6);
      const snare = Math.pow(Math.max(0, Math.sin(bt * Math.PI * 2.0 + Math.PI)), 6);
      // slow undulation gives ambient breathing between beats
      const slow  = (Math.sin(bt * 0.7) + 1) / 2;
      const bass  = Math.min(1, kick * 0.60 + snare * 0.25 + slow * 0.15);

      bassRef.current = bass;
      playerDivRef.current?.style.setProperty("--audio-bass", bass.toFixed(3));
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing]);

  useEffect(() => { return () => cleanupAudio(); }, []);

  // ── Spotify corner badge (shown on all screens) ───────────────────────────
  const spotifyCorner = (
    <div className="ms-sp-corner">
      {spToken ? (
        <button
          className={`ms-sp-corner-btn ${spReady ? "on" : "loading"}`}
          onClick={disconnectSpotify}
          title="Spotify connected — click to disconnect"
        >
          {spReady ? "● Spotify" : "⏳ Spotify"}
        </button>
      ) : (
        <button className="ms-sp-corner-btn" onClick={connectSpotify} title="Connect Spotify for full songs">
          ♫ Spotify
        </button>
      )}
    </div>
  );

  // must be before any early returns — hooks cannot follow conditional returns
  const noteConfigs = useMemo(() =>
    Array.from({ length: 7 }, () => ({
      glyph:    ["♩","♪","♫","♬"][Math.floor(Math.random() * 4)],
      left:     Math.random() * 82 + 4,
      top:      Math.random() * 74 + 8,
      size:     Math.floor(Math.random() * 18) + 18,
      duration: Math.random() * 3  + 4,
      delay:    Math.random() * 1.8,
      sway:     Math.random() * 20 - 10,
      rotate:   Math.random() * 30 - 15,
    })),
  [mood]);

  // ── PLAYER SCREEN ─────────────────────────────────────────────────────────
  if (screen === "player" && currentTrack) {
    const pct = duration > 0 ? (progress / duration) * 100 : 0;

    return (
      <div className="ms-root">
        {spotifyCorner}
        <div ref={playerDivRef} className="ms-player" data-weather={weatherCondition === "Clear" && weatherIsNight ? "Night" : weatherCondition}>
          <WeatherParticles condition={weatherCondition === "Clear" && weatherIsNight ? "Night" : weatherCondition} energyRef={bassRef} />

          {/* weather icon pinned to top-left corner of the card */}
          {weatherCondition && (
            <div className="ms-wx-corner">
              <div className="ms-wx-badge">
                <WeatherIcon condition={weatherCondition === "Clear" && weatherIsNight ? "Night" : weatherCondition} />
              </div>
            </div>
          )}

          <div className="ms-player-content">
          <div className="ms-player-topbar">
            <button className="ms-back-btn" onClick={goBack}>← Back</button>

            {/* city + temp inline in topbar, no icon */}
            {weatherCondition && weatherTemp !== null && (
              <div className="ms-wx-info">
                {weatherCity && <span className="ms-wx-city">{weatherCity}</span>}
                <span className="ms-wx-temp">{Math.round(weatherTemp)}°C</span>
              </div>
            )}

            <div className="ms-player-meta">
              {spActive && <span className="ms-sp-chip">● Spotify</span>}
              <span className="ms-vibe-chip">{baseVibe}</span>
              <span className="ms-lang-chip">{language}</span>
            </div>
          </div>

          <div className="ms-art-wrap">
            {currentTrack.album_art
              ? <img src={currentTrack.album_art} alt={currentTrack.album} className="ms-art-img" />
              : <div className="ms-art-placeholder">♪</div>
            }
            <div className="ms-art-wx-overlay" />
          </div>

          <div className="ms-track-info-block">
            <h2 className="ms-player-title">{currentTrack.song}</h2>
            <p className="ms-player-artist">{currentTrack.artists.join(", ")}</p>
            {currentTrack.genre && <p className="ms-player-genre">{currentTrack.genre}</p>}
          </div>

          <div className="ms-progress-wrap">
            <div className="ms-progress-bar">
              <div className="ms-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="ms-progress-times">
              <span>{formatTime(progress)}</span>
              <span>{duration > 0 ? formatTime(duration) : "--:--"}</span>
            </div>
          </div>

          <div className="ms-controls">
            <button className="ms-ctrl-btn secondary" onClick={prevTrack} disabled={currentIndex === 0}>⏮</button>
            <button className="ms-ctrl-btn primary" onClick={togglePlayPause}>
              {playing ? "⏸" : "▶"}
            </button>
            <button className="ms-ctrl-btn secondary" onClick={nextTrack} disabled={currentIndex === queue.length - 1}>⏭</button>
          </div>

          {currentTrack.itunes_link && (
            <a className="ms-itunes-full" href={currentTrack.itunes_link} target="_blank" rel="noreferrer">
              Open in iTunes ↗
            </a>
          )}

          <div className="ms-queue">
            <div className="ms-queue-label">Up Next</div>
            {queue.map((track, i) => (
              <div
                key={i}
                className={`ms-queue-item ${i === currentIndex ? "active" : ""}`}
                onClick={() => playTrack(i)}
              >
                <div className="ms-queue-art">
                  {track.album_art ? <img src={track.album_art} alt={track.album} /> : "♪"}
                </div>
                <div className="ms-queue-info">
                  <div className="ms-queue-name">{track.song}</div>
                  <div className="ms-queue-artist">{track.artists.join(", ")}</div>
                </div>
                {i === currentIndex && playing && <div className="ms-queue-playing">PLAYING</div>}
              </div>
            ))}
          </div>

          </div>{/* ms-player-content */}
        </div>
      </div>
    );
  }

  // ── PREVIEW MODE ──────────────────────────────────────────────────────────
  if (new URLSearchParams(window.location.search).has("preview")) {
    return <WeatherPreview />;
  }

  // ── ONBOARD SCREEN ────────────────────────────────────────────────────────
  const moodColor = mood ? MOOD_COLORS[mood].text   : null;
  const moodBg    = mood ? MOOD_COLORS[mood].bg     : null;
  const moodBdr   = mood ? MOOD_COLORS[mood].border : null;
  const moodGlow  = mood ? MOOD_COLORS[mood].glow   : null;

  return (
    <div
      className="ms-root ms-onboard-root"
      onMouseMove={handleBgMouseMove}
      style={moodColor ? {
        "--mood-color": moodColor,
        "--ui-accent":  moodColor,
        "--ui-bg":      moodBg,
        "--ui-border":  moodBdr,
        "--ui-glow":    moodGlow,
      } : undefined}
    >
      {spotifyCorner}

      {/* Aurora drift blobs */}
      <div className="ms-aurora" aria-hidden="true">
        <div className="ms-aurora-blob ms-aurora-blob--1" />
        <div className="ms-aurora-blob ms-aurora-blob--2" />
        <div className="ms-aurora-blob ms-aurora-blob--3" />
      </div>

      {/* Floating music notes — key on mood re-randomizes on every selection */}
      <div key={mood || "idle"} className="ms-notes-bg" aria-hidden="true">
        {noteConfigs.map((cfg, i) => (
          <span
            key={i}
            className="ms-note"
            style={{
              left:              `${cfg.left}%`,
              top:               `${cfg.top}%`,
              fontSize:          `${cfg.size}px`,
              animationDuration: `${cfg.duration}s`,
              animationDelay:    `${cfg.delay}s`,
              "--sway":          `${cfg.sway}px`,
              "--rotate":        `${cfg.rotate}deg`,
            }}
          >
            {cfg.glyph}
          </span>
        ))}
      </div>

      {/* Cursor-triggered notes (outside the form) */}
      {cursorNotes.map(n => (
        <span
          key={n.id}
          className="ms-note ms-cursor-note"
          style={{
            left:              n.x,
            top:               n.y,
            fontSize:          `${n.size}px`,
            animationDuration: `${n.duration}s`,
            animationDelay:    "0s",
            "--sway":          `${n.sway}px`,
            "--rotate":        `${n.rotate}deg`,
          }}
        >
          {n.glyph}
        </span>
      ))}

      <div ref={formBodyRef} className="ms-onboard-body">

        {/* Brand header */}
        <header className="ms-ob-brand">
          <div className="ms-ob-logo">
            <span className="ms-ob-wave">∿</span>
            <span>MoodSync</span>
          </div>
          <p className="ms-ob-tagline">music that reads the room</p>
        </header>

        {/* Mood */}
        <div className="ms-ob-section">
          <div className="ms-ob-section-head">
            <span className="ms-ob-section-label">how are you feeling?</span>
            <span className="ms-ob-section-sub">pick what's closest right now</span>
          </div>
          <div className="ms-onboard-grid">
            {MOODS.map(label => {
              const mc = MOOD_COLORS[label];
              return (
                <button
                  key={label}
                  className={`ms-onboard-pill ${mood === label ? "active" : ""}`}
                  style={{ "--mc": mc.text, "--mb": mc.bg, "--mbd": mc.border, "--mg": mc.glow }}
                  onClick={() => setMood(label)}
                >
                  <span className="ms-onboard-pill-emoji">{MOOD_EMOJIS[label]}</span>
                  <span className="ms-onboard-pill-label">{label.toLowerCase()}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Language */}
        <div className="ms-ob-section">
          <span className="ms-ob-section-label">language</span>
          <div className="ms-lang-strip">
            {LANGUAGES.map(lang => (
              <button
                key={lang.label}
                className={`ms-lang-strip-btn ${language === lang.label ? "active" : ""}`}
                onClick={() => setLanguage(lang.label)}
              >
                <span className="ms-lang-flag">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode */}
        <div className="ms-ob-section">
          <span className="ms-ob-section-label">want music that</span>
          <div className="ms-mode-cards">
            <button
              className={`ms-mode-card ${mode === "match" ? "active" : ""}`}
              onClick={() => setMode("match")}
            >
              <div className="ms-mode-card-dot" />
              <div>
                <div className="ms-mode-card-name">match my mood</div>
                <div className="ms-mode-card-desc">songs that fit right now</div>
              </div>
            </button>
            <button
              className={`ms-mode-card ${mode === "shift" ? "active" : ""}`}
              onClick={() => setMode("shift")}
            >
              <div className="ms-mode-card-dot" />
              <div>
                <div className="ms-mode-card-name">shift my mood</div>
                <div className="ms-mode-card-desc">music to change your vibe</div>
              </div>
            </button>
          </div>
        </div>

        {error && <p className="ms-error">⚠️ {error}</p>}

        {/* Floating mood chip + CTA */}
        <div className="ms-ob-cta-area">
          {mood && (
            <div
              className="ms-ob-mood-chip"
              style={{
                "--mc":  MOOD_COLORS[mood].text,
                "--mb":  MOOD_COLORS[mood].bg,
                "--mbd": MOOD_COLORS[mood].border,
              }}
            >
              <span>{MOOD_EMOJIS[mood]}</span>
              <span>feeling {mood.toLowerCase()}</span>
            </div>
          )}
          <button
            className={`ms-onboard-cta ${mood ? "ready" : ""}`}
            onClick={handleSubmit}
            disabled={!mood || loading}
          >
            {loading ? <span className="ms-spinner" /> : "find my music →"}
          </button>
        </div>

      </div>
    </div>
  );
}
