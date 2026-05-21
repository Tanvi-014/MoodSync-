import { useState, useEffect, useRef } from "react";
import "./App.css";

const MOODS = [
  "Happy", "Sad", "Stressed", "Focused", "Romantic",
  "Nostalgic", "Excited", "Calm", "Angry", "Heartbroken", "Party"
];

const LANGUAGES = [
  { label: "English", flag: "🇬🇧" },
  { label: "Hindi", flag: "🇮🇳" },
  { label: "Tamil", flag: "🇮🇳" },
  { label: "Telugu", flag: "🇮🇳" },
  { label: "Kannada", flag: "🇮🇳" },
  { label: "Malayalam", flag: "🇮🇳" },
  { label: "Punjabi", flag: "🇮🇳" },
  { label: "Bengali", flag: "🇮🇳" },
  { label: "Marathi", flag: "🇮🇳" },
  { label: "Gujarati", flag: "🇮🇳" },
  { label: "Odia", flag: "🇮🇳" },
  { label: "Bhojpuri", flag: "🇮🇳" },
];

const ENERGY_LABELS = ["", "soft", "mellow", "balanced", "energetic", "intense"];

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function App() {
  const [dark, setDark] = useState(false);

  // form state
  const [city, setCity] = useState("");
  const [mood, setMood] = useState("");
  const [energy, setEnergy] = useState(3);
  const [language, setLanguage] = useState("Hindi");
  const [mode, setMode] = useState("match");

  // app state
  const [screen, setScreen] = useState("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // player state
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [baseVibe, setBaseVibe] = useState("");
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(30);

  const audioRef = useRef(null);
  const intervalRef = useRef(null);

  // theme persistence
  useEffect(() => {
    const saved = localStorage.getItem("ms-theme");
    if (saved === "dark") setDark(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("ms-theme", dark ? "dark" : "light");
  }, [dark]);

  const currentTrack = queue[currentIndex];

  function cleanupAudio() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setPlaying(false);
    setProgress(0);
    setDuration(30);
  }

  function startProgressTracking(audio) {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setProgress(audio.currentTime || 0);
      setDuration(audio.duration || 30);
    }, 200);
  }

  function playTrack(index) {
    const track = queue[index];
    if (!track?.preview_url) {
      cleanupAudio();
      setCurrentIndex(index);
      return;
    }

    cleanupAudio();

    const audio = new Audio(track.preview_url);
    audioRef.current = audio;
    setCurrentIndex(index);

    audio.onloadedmetadata = () => {
      setDuration(audio.duration || 30);
    };

    audio.onended = () => {
      if (index < queue.length - 1) {
        playTrack(index + 1);
      } else {
        cleanupAudio();
      }
    };

    audio.play();
    setPlaying(true);
    startProgressTracking(audio);
  }

  function togglePlayPause() {
    if (!audioRef.current && currentTrack?.preview_url) {
      playTrack(currentIndex);
      return;
    }

    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  function nextTrack() {
    if (currentIndex < queue.length - 1) {
      playTrack(currentIndex + 1);
    }
  }

  function prevTrack() {
    if (currentIndex > 0) {
      playTrack(currentIndex - 1);
    }
  }

  function goBack() {
    cleanupAudio();
    setScreen("form");
  }

  async function handleSubmit() {
    if (!city.trim()) {
      setError("enter a city first");
      return;
    }

    if (!mood) {
      setError("pick a mood");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/recommend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          city,
          mood,
          energy,
          language,
          mode
        })
      });

      if (!res.ok) {
        throw new Error("something went wrong");
      }

      const data = await res.json();

      if (!data.results?.length) {
        setError("no music found, try another vibe");
        return;
      }

      setQueue(data.results);
      setBaseVibe(data.base_vibe);
      setScreen("player");

      setTimeout(() => {
        playTrack(0);
      }, 100);

    } catch (e) {
      if (e.message === "Failed to fetch") {
        setError("backend not running on port 8000");
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => cleanupAudio();
  }, []);

  // PLAYER SCREEN
  if (screen === "player" && currentTrack) {
    const progressPercent = duration ? (progress / duration) * 100 : 0;

    return (
      <div className="ms-root">
        <div className="ms-player">

          <div className="ms-player-topbar">
            <button className="ms-back-btn" onClick={goBack}>
              ← Back
            </button>

            <div className="ms-player-meta">
              <span className="ms-vibe-chip">{baseVibe}</span>
              <span className="ms-lang-chip">{language}</span>
            </div>
          </div>

          <div className="ms-art-wrap">
            {currentTrack.album_art ? (
              <img
                src={currentTrack.album_art}
                alt={currentTrack.album}
                className="ms-art-img"
              />
            ) : (
              <div className="ms-art-placeholder">♪</div>
            )}
          </div>

          <div className="ms-track-info-block">
            <h2 className="ms-player-title">{currentTrack.song}</h2>
            <p className="ms-player-artist">
              {currentTrack.artists.join(", ")}
            </p>
            {currentTrack.genre && (
              <p className="ms-player-genre">{currentTrack.genre}</p>
            )}
          </div>

          {currentTrack.preview_url ? (
            <>
              <div className="ms-progress-wrap">
                <div className="ms-progress-bar">
                  <div
                    className="ms-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="ms-progress-times">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="ms-controls">
                <button
                  className="ms-ctrl-btn secondary"
                  onClick={prevTrack}
                  disabled={currentIndex === 0}
                >
                  ⏮
                </button>

                <button
                  className="ms-ctrl-btn primary"
                  onClick={togglePlayPause}
                >
                  {playing ? "⏸" : "▶"}
                </button>

                <button
                  className="ms-ctrl-btn secondary"
                  onClick={nextTrack}
                  disabled={currentIndex === queue.length - 1}
                >
                  ⏭
                </button>
              </div>
            </>
          ) : (
            <p className="ms-no-preview">No preview available for this track</p>
          )}

          {currentTrack.itunes_link && (
            <a
              className="ms-itunes-full"
              href={currentTrack.itunes_link}
              target="_blank"
              rel="noreferrer"
            >
              Open full track ↗
            </a>
          )}

          <div className="ms-queue">
            <div className="ms-queue-label">Up Next</div>

            {queue.map((track, index) => (
              <div
                key={index}
                className={`ms-queue-item ${index === currentIndex ? "active" : ""}`}
                onClick={() => playTrack(index)}
              >
                <div className="ms-queue-art">
                  {track.album_art ? (
                    <img src={track.album_art} alt={track.album} />
                  ) : (
                    "♪"
                  )}
                </div>

                <div className="ms-queue-info">
                  <div className="ms-queue-name">{track.song}</div>
                  <div className="ms-queue-artist">
                    {track.artists.join(", ")}
                  </div>
                </div>

                {index === currentIndex && playing && (
                  <div className="ms-queue-playing">PLAYING</div>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    );
  }

  // FORM SCREEN
  return (
    <div className="ms-root">
      <div className="ms-container">

        <header className="ms-header">
          <div className="ms-header-row">
            <div className="ms-logo">
              <span className="ms-logo-wave">∿</span>
              MoodSync
            </div>

            <button
              className="ms-theme-toggle"
              onClick={() => setDark(d => !d)}
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>

          <p className="ms-tagline">music that reads the room</p>
        </header>

        <div className="ms-card">

          <div className="ms-field">
            <label className="ms-label">your city</label>
            <div className="ms-input-wrap">
              <span className="ms-input-icon">📍</span>
              <input
                className="ms-input"
                type="text"
                placeholder="Mumbai, Chennai, Bangalore..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
          </div>

          <div className="ms-field">
            <label className="ms-label">language</label>
            <div className="ms-lang-grid">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.label}
                  className={`ms-lang-btn ${language === lang.label ? "active" : ""}`}
                  onClick={() => setLanguage(lang.label)}
                >
                  <span className="ms-lang-flag">{lang.flag}</span>
                  <span className="ms-lang-name">{lang.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ms-field">
            <label className="ms-label">mood</label>
            <div className="ms-mood-grid">
              {MOODS.map((m) => (
                <button
                  key={m}
                  className={`ms-mood-pill ${mood === m ? "active" : ""}`}
                  onClick={() => setMood(m)}
                >
                  {m.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="ms-field">
            <label className="ms-label">
              energy
              <span className="ms-energy-tag">{ENERGY_LABELS[energy]}</span>
            </label>

            <input
              className="ms-slider"
              type="range"
              min="1"
              max="5"
              value={energy}
              onChange={(e) => setEnergy(Number(e.target.value))}
            />

            <div className="ms-slider-ticks">
              {ENERGY_LABELS.slice(1).map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>

          <div className="ms-field">
            <label className="ms-label">mode</label>

            <div className="ms-mode-seg">
              <button
                className={`ms-mode-btn ${mode === "match" ? "active" : ""}`}
                onClick={() => setMode("match")}
              >
                match my mood
              </button>

              <button
                className={`ms-mode-btn ${mode === "shift" ? "active" : ""}`}
                onClick={() => setMode("shift")}
              >
                shift my mood
              </button>
            </div>
          </div>

          {error && <p className="ms-error">⚠️ {error}</p>}

          <button
            className="ms-submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? <span className="ms-spinner" /> : "find my music →"}
          </button>

        </div>
      </div>
    </div>
  );
}