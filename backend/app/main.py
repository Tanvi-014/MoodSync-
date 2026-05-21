from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
from urllib.parse import quote
import requests
import random
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ENV_PATH = Path(r"C:\Users\Administrator\Desktop\Projects and stuff\API endpoint project\backend\.env")
load_dotenv(dotenv_path=ENV_PATH)

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
if not OPENWEATHER_API_KEY:
    raise ValueError("OpenWeather API key missing")


class UserInput(BaseModel):
    city: str
    mood: str
    energy: int
    language: str
    mode: str


MATCH_MODE = {
    "Happy":"happy","Sad":"sad","Stressed":"stressed","Focused":"focus",
    "Romantic":"romantic","Nostalgic":"nostalgic","Excited":"excited",
    "Calm":"calm","Angry":"angry","Heartbroken":"dreamy","Party":"party"
}
SHIFT_MODE = {
    "Happy":"calm","Sad":"uplifting","Stressed":"soothing","Focused":"chill",
    "Romantic":"energetic","Nostalgic":"fresh","Excited":"mellow","Calm":"upbeat",
    "Angry":"soothing","Heartbroken":"healing","Party":"calm"
}
ENERGY_MAP = {1:"soft",2:"mellow",3:"balanced",4:"energetic",5:"intense"}

WEATHER_VIBE_FIT = {
    "Rain":        {"nostalgic":1,"dreamy":1,"calm":1,"soothing":1,"romantic":1,"healing":1,"sad":1,"happy":-1,"party":-1,"uplifting":-1,"energetic":-1,"fresh":-1,"upbeat":-1,"excited":-1},
    "Clear":       {"happy":1,"party":1,"uplifting":1,"energetic":1,"fresh":1,"upbeat":1,"excited":1,"sad":-1,"dreamy":-1,"nostalgic":-1,"healing":-1},
    "Clouds":      {"calm":1,"dreamy":1,"nostalgic":1,"focus":1,"stressed":1,"party":-1,"excited":-1},
    "Thunderstorm":{"dreamy":1,"soothing":1,"healing":1,"angry":1,"party":-1,"happy":-1,"energetic":-1,"upbeat":-1},
    "Mist":        {"dreamy":1,"calm":1,"romantic":1,"nostalgic":1,"party":-1,"energetic":-1,"focus":-1},
    "Snow":        {"dreamy":1,"calm":1,"romantic":1,"nostalgic":1,"healing":1,"party":-1,"energetic":-1,"angry":-1},
    "Dust":        {"angry":1,"stressed":1,"romantic":-1,"dreamy":-1,"calm":-1}
}
WEATHER_SEARCH_KEYWORD = {
    "Rain":"rainy","Clear":"sunny","Clouds":"cloudy",
    "Thunderstorm":"storm","Mist":"misty","Snow":"winter","Dust":"desert"
}
ENERGY_SEARCH_KEYWORD = {
    1:"soft slow",2:"mellow gentle",3:"",4:"upbeat",5:"intense"
}

VIBE_QUERIES = {
    "happy":     ["happy","joyful","feel good"],
    "sad":       ["sad","emotional","heartbreak"],
    "stressed":  ["calm","soothing","stress relief"],
    "focus":     ["focus","concentration","study"],
    "romantic":  ["romantic","love","tender"],
    "nostalgic": ["nostalgic","memories","throwback"],
    "excited":   ["excited","hype","energy"],
    "calm":      ["calm","peaceful","relaxing"],
    "angry":     ["angry","intense","rage"],
    "dreamy":    ["dreamy","atmospheric","ethereal"],
    "party":     ["party","dance","celebration"],
    "uplifting": ["uplifting","motivational","inspiring"],
    "soothing":  ["soothing","gentle","peaceful"],
    "chill":     ["chill","laid back","easy"],
    "energetic": ["energetic","workout","power"],
    "fresh":     ["fresh","bright","new"],
    "mellow":    ["mellow","smooth","soft"],
    "upbeat":    ["upbeat","fun","happy"],
    "healing":   ["healing","comfort","recovery"],
}

# ─── language config ─────────────────────────────────────────────────────────
# Each language has:
#   primary_queries  — exact iTunes-friendly queries (most important)
#   artist_queries   — known artists, very reliable fallback
#   country          — iTunes storefront
#   banned_genres    — genres to hard-reject (prevent English pop bleeding in)
#   required_genre   — if set, ONLY accept tracks with this string in genre

LANGUAGE_CONFIG = {
    "English": {
        "primary_queries":  ["{vibe}", "{vibe} {energy}"],
        "artist_queries":   ["Taylor Swift","Ed Sheeran","Dua Lipa","The Weeknd"],
        "country":          "US",
        "banned_genres":    [],
        "required_genre":   None,
    },
    "Hindi": {
        "primary_queries":  ["bollywood {vibe}","hindi {vibe} songs","{vibe} bollywood hindi"],
        "artist_queries":   ["Arijit Singh","Shreya Ghoshal","Jubin Nautiyal","Neha Kakkar"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian"],
        "required_genre":   "bollywood",
    },
    "Tamil": {
        "primary_queries":  ["tamil {vibe} songs","kollywood {vibe}","AR Rahman {vibe}"],
        "artist_queries":   ["AR Rahman","Anirudh Ravichander","Sid Sriram","Harris Jayaraj"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   "tamil",
    },
    "Telugu": {
        "primary_queries":  ["telugu {vibe} songs","tollywood {vibe}","SS Thaman {vibe}"],
        "artist_queries":   ["SS Thaman","Devi Sri Prasad","Manisharma","Sid Sriram"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   "telugu",
    },
    "Kannada": {
        "primary_queries":  ["kannada {vibe} songs","sandalwood {vibe}","V Harikrishna {vibe}"],
        "artist_queries":   ["V Harikrishna","Arjun Janya","Rajesh Krishnan","Sonu Nigam Kannada"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   "kannada",
    },
    "Malayalam": {
        "primary_queries":  ["malayalam {vibe} songs","mollywood {vibe}","kerala film {vibe}"],
        "artist_queries":   ["KS Chithra","Vineeth Sreenivasan","Shreya Ghoshal Malayalam","M Jayachandran"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   "malayalam",
    },
    "Punjabi": {
        "primary_queries":  ["punjabi {vibe} songs","punjabi pop {vibe}","bhangra {vibe}"],
        "artist_queries":   ["Diljit Dosanjh","AP Dhillon","Sidhu Moosewala","Guru Randhawa"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian"],
        "required_genre":   "punjabi",
    },
    "Bengali": {
        "primary_queries":  ["bengali {vibe} songs","bangla {vibe} music","rabindra sangeet {vibe}"],
        "artist_queries":   ["Anupam Roy","Nachiketa Chakraborty","Rupankar Bagchi","Usha Uthup"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   "bengali",
    },
    "Marathi": {
        "primary_queries":  ["marathi {vibe} songs","marathi pop {vibe}","Ajay-Atul {vibe}"],
        "artist_queries":   ["Ajay-Atul","Shankar Mahadevan","Vaibhav Joshi","Hrishikesh Ranade"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   "marathi",
    },
    "Gujarati": {
        "primary_queries":  ["gujarati {vibe} songs","gujarati garba {vibe}","gujarati folk {vibe}"],
        "artist_queries":   ["Kirtidan Gadhvi","Osman Mir","Aishwarya Majmudar","Parthiv Gohil"],
        "country":          "IN",
        "banned_genres":    ["children","christian","hindi","bollywood"],
        "required_genre":   "gujarati",
    },
    "Odia": {
        "primary_queries":  ["odia songs {vibe}","ollywood {vibe}","Human Sagar {vibe}"],
        "artist_queries":   ["Human Sagar","Ira Mohanty","Tapu Mishra","Nibedita"],
        "country":          "IN",
        "banned_genres":    ["children","christian","hindi","bollywood","tamil","telugu"],
        "required_genre":   "regional indian",   # iTunes tags Odia as "Regional Indian"
    },
    "Bhojpuri": {
        "primary_queries":  ["bhojpuri {vibe} songs","bhojpuri hit {vibe}","bhojpuri music"],
        "artist_queries":   ["Pawan Singh","Khesari Lal Yadav","Neelkamal Singh","Ritesh Pandey"],
        "country":          "IN",
        "banned_genres":    ["children","christian","tamil","telugu","kannada"],
        "required_genre":   "bhojpuri",
    },
}


def get_weather_data(city: str) -> dict:
    url = (
        "https://api.openweathermap.org/data/2.5/weather"
        f"?q={quote(city)}&appid={OPENWEATHER_API_KEY}&units=metric"
    )
    try:
        r = requests.get(url, timeout=10)
        if r.status_code != 200:
            return {}
        d = r.json()
        return {
            "condition":    d["weather"][0]["main"],
            "description":  d["weather"][0]["description"],
            "temp_c":       round(d["main"]["temp"], 1),
            "feels_like_c": round(d["main"]["feels_like"], 1),
            "humidity":     d["main"]["humidity"],
            "city_name":    d.get("name", city),
            "country":      d.get("sys", {}).get("country", "")
        }
    except Exception:
        return {}


def normalize_weather(raw: str) -> str:
    m = {
        "Rain":"Rain","Drizzle":"Rain","Thunderstorm":"Thunderstorm",
        "Squall":"Thunderstorm","Tornado":"Thunderstorm","Snow":"Snow",
        "Clear":"Clear","Clouds":"Clouds","Mist":"Mist","Haze":"Mist",
        "Fog":"Mist","Smoke":"Mist","Dust":"Dust","Sand":"Dust","Ash":"Dust"
    }
    return m.get(raw, "Clear")


def search_itunes(query: str, country: str = "IN", limit: int = 15) -> list:
    try:
        r = requests.get(
            "https://itunes.apple.com/search",
            params={"term":query,"media":"music","entity":"song",
                    "limit":limit,"country":country,"explicit":"No"},
            timeout=10
        )
        if r.status_code != 200:
            return []
        return r.json().get("results", [])
    except Exception:
        return []


def format_track(item: dict) -> dict | None:
    try:
        art = item.get("artworkUrl100", "")
        return {
            "song":        item["trackName"],
            "artists":     [item.get("artistName", "Unknown")],
            "album":       item.get("collectionName", ""),
            "itunes_link": item.get("trackViewUrl"),
            "preview_url": item.get("previewUrl"),
            "album_art":   art.replace("100x100", "600x600") if art else None,
            "genre":       item.get("primaryGenreName", "")
        }
    except Exception:
        return None


def passes_genre_filter(item: dict, cfg: dict) -> bool:
    genre = (item.get("primaryGenreName") or "").lower().strip()
    # hard ban
    for banned in cfg["banned_genres"]:
        if banned in genre:
            return False
    # required genre check (partial match)
    if cfg["required_genre"]:
        return cfg["required_genre"].lower() in genre
    return True


def build_query(template: str, vibe: str, energy_kw: str) -> str:
    return template.replace("{vibe}", vibe).replace("{energy}", energy_kw).strip()


def get_recommendations(base_vibe: str, adjusted_energy: int, language: str, weather: str) -> list:
    vibe_terms = VIBE_QUERIES.get(base_vibe, VIBE_QUERIES["calm"])
    energy_kw  = ENERGY_SEARCH_KEYWORD.get(adjusted_energy, "")
    cfg        = LANGUAGE_CONFIG.get(language, LANGUAGE_CONFIG["English"])
    country    = cfg["country"]

    # Build all queries
    all_queries = []
    for tmpl in cfg["primary_queries"]:
        for vibe in vibe_terms[:2]:
            all_queries.append(build_query(tmpl, vibe, energy_kw))
    for artist in cfg["artist_queries"]:
        all_queries.append(artist)

    seen_ids = set()
    tracks   = []

    for query in all_queries:
        if len(tracks) >= 5:
            break
        items = search_itunes(query, country=country, limit=15)
        random.shuffle(items)
        for item in items:
            track_id = item.get("trackId")
            if not track_id or track_id in seen_ids:
                continue
            if not passes_genre_filter(item, cfg):
                continue
            seen_ids.add(track_id)
            t = format_track(item)
            if t:
                tracks.append(t)
            if len(tracks) >= 5:
                break

    # If still short, relax required_genre and retry artist queries only
    if len(tracks) < 3:
        relaxed_cfg = {**cfg, "required_genre": None}
        for artist in cfg["artist_queries"]:
            if len(tracks) >= 5:
                break
            items = search_itunes(artist, country=country, limit=10)
            for item in items:
                track_id = item.get("trackId")
                if not track_id or track_id in seen_ids:
                    continue
                genre = (item.get("primaryGenreName") or "").lower()
                # still ban the hard-banned genres
                if any(b in genre for b in cfg["banned_genres"]):
                    continue
                seen_ids.add(track_id)
                t = format_track(item)
                if t:
                    tracks.append(t)
                if len(tracks) >= 5:
                    break

    return tracks


@app.get("/")
def home():
    return {"message": "MoodSync backend alive"}


@app.post("/recommend")
def recommend(user: UserInput):
    if user.mode not in {"match", "shift"}:
        raise HTTPException(status_code=400, detail="mode must be 'match' or 'shift'")
    if user.mood not in MATCH_MODE:
        raise HTTPException(status_code=400, detail=f"unsupported mood: {user.mood}")
    if user.energy not in ENERGY_MAP:
        raise HTTPException(status_code=400, detail="energy must be 1–5")
    if user.language not in LANGUAGE_CONFIG:
        raise HTTPException(status_code=400, detail=f"unsupported language: {user.language}")

    base_vibe       = MATCH_MODE[user.mood] if user.mode == "match" else SHIFT_MODE[user.mood]
    weather_data    = get_weather_data(user.city)
    current_weather = normalize_weather(weather_data.get("condition", "Clear"))
    fit             = WEATHER_VIBE_FIT.get(current_weather, {}).get(base_vibe, 0)
    adjusted_energy = max(1, min(5, user.energy + fit))
    intensity       = ENERGY_MAP[adjusted_energy]
    results         = get_recommendations(base_vibe, adjusted_energy, user.language, current_weather)

    weather_context = ""
    if weather_data:
        weather_context = (
            f"{weather_data.get('description','').title()} in "
            f"{weather_data.get('city_name', user.city)}, "
            f"{weather_data.get('country','')} — "
            f"{weather_data.get('temp_c','?')}°C "
            f"(feels like {weather_data.get('feels_like_c','?')}°C)"
        )

    return {
        "city":            user.city,
        "weather":         current_weather,
        "weather_detail":  weather_context,
        "humidity":        weather_data.get("humidity"),
        "base_vibe":       base_vibe,
        "original_energy": user.energy,
        "adjusted_energy": adjusted_energy,
        "intensity":       intensity,
        "results":         results
    }


@app.get("/debug/language/{language}")
def debug_language(language: str):
    cfg = LANGUAGE_CONFIG.get(language)
    if not cfg:
        raise HTTPException(status_code=404, detail="language not found")
    out = []
    for tmpl in cfg["primary_queries"][:2]:
        q = build_query(tmpl, "happy", "")
        items = search_itunes(q, country=cfg["country"], limit=5)
        out.append({
            "query": q,
            "results": [
                {"song": t.get("trackName"), "artist": t.get("artistName"), "genre": t.get("primaryGenreName")}
                for t in items[:3]
            ]
        })
    return {"language": language, "tests": out}