import WeatherParticles from "./WeatherParticles";

const CONDITIONS = [
  { id: "Clear",        emoji: "☀️",  label: "Clear (Day)"  },
  { id: "Night",        emoji: "🌙",  label: "Clear (Night)"},
  { id: "Rain",         emoji: "🌧️", label: "Rain"         },
  { id: "Thunderstorm", emoji: "⛈️", label: "Thunderstorm" },
  { id: "Snow",         emoji: "❄️",  label: "Snow"         },
  { id: "Clouds",       emoji: "☁️",  label: "Clouds"       },
  { id: "Mist",         emoji: "🌫️", label: "Mist"         },
  { id: "Dust",         emoji: "🌪️", label: "Dust"         },
];

export default function WeatherPreview() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#03050f",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "2rem",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      gap: "1.5rem",
    }}>
      <h1 style={{ color: "#ECF0FF", fontSize: 22, fontWeight: 700, letterSpacing: "-0.3px" }}>
        Weather Animations Preview
      </h1>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "1rem",
        width: "100%",
        maxWidth: 900,
      }}>
        {CONDITIONS.map(({ id, emoji, label }) => (
          <div key={id} style={{
            position: "relative",
            height: 200,
            borderRadius: 20,
            overflow: "hidden",
            background: "#080b1a",
            border: "1px solid rgba(255,255,255,0.07)",
            flexShrink: 0,
          }}>
            <WeatherParticles condition={id} />
            <div style={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              pointerEvents: "none",
            }}>
              <span style={{ fontSize: 40 }}>{emoji}</span>
              <span style={{ color: "#ECF0FF", fontWeight: 600, fontSize: 15 }}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <p style={{ color: "#3D4A6B", fontSize: 13 }}>
        remove <code style={{ color: "#5B7FFF" }}>?preview</code> from the URL to go back to the app
      </p>
    </div>
  );
}
