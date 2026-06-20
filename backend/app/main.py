from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
import requests
import random
import re
import os

# Always load backend/.env relative to this file, regardless of where uvicorn is started from
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI()

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")
if not OPENWEATHER_API_KEY:
    raise ValueError("OpenWeather API key missing")


class UserInput(BaseModel):
    lat: float | None = None
    lon: float | None = None
    mood: str
    energy: int = 3
    language: str
    mode: str


MATCH_MODE = {
    "Happy":      "happy",
    "Sad":        "sad",
    "Stressed":   "energetic",
    "Focused":    "focus",
    "Romantic":   "romantic",
    "Nostalgic":  "nostalgic",
    "Excited":    "excited",
    "Calm":       "calm",
    "Angry":      "angry",
    "Heartbroken":"sad",       # heartbreak ballads, emotional — was wrongly "dreamy"
    "Party":      "party",
}
SHIFT_MODE = {
    "Happy":      "sad",        # opposite of happy
    "Sad":        "uplifting", # lift out of sadness
    "Stressed":   "soothing",  # calm the stress
    "Focused":    "chill",     # ease off the grind
    "Romantic":   "upbeat",    # shift to fun energy (was "energetic" which felt off)
    "Nostalgic":  "fresh",     # pull out of the past
    "Excited":    "mellow",    # bring it down
    "Calm":       "upbeat",    # add some energy
    "Angry":      "soothing",  # defuse
    "Heartbroken":"healing",   # comfort and recovery
    "Party":      "calm",      # wind down
}
ENERGY_MAP = {1:"soft",2:"mellow",3:"balanced",4:"energetic",5:"intense"}

WEATHER_VIBE_FIT = {
    "Rain":        {"nostalgic":1,"dreamy":1,"calm":1,"soothing":1,"romantic":1,"healing":1,"sad":1,"happy":-1,"party":-1,"uplifting":-1,"energetic":-1,"fresh":-1,"upbeat":-1,"excited":-1},
    "Clear":       {"happy":1,"party":1,"uplifting":1,"energetic":1,"fresh":1,"upbeat":1,"excited":1,"sad":-1,"dreamy":-1,"nostalgic":-1,"healing":-1},
    "Clouds":      {"calm":1,"dreamy":1,"nostalgic":1,"focus":1,"stressed":-1,"party":-1,"excited":-1},
    "Thunderstorm":{"dreamy":1,"soothing":1,"healing":1,"angry":1,"party":-1,"happy":-1,"energetic":-1,"upbeat":-1},
    "Mist":        {"dreamy":1,"calm":1,"romantic":1,"nostalgic":1,"party":-1,"energetic":-1,"focus":-1},
    "Snow":        {"dreamy":1,"calm":1,"romantic":1,"nostalgic":1,"healing":1,"party":-1,"energetic":-1,"angry":-1},
    "Dust":        {"angry":1,"stressed":1,"romantic":-1,"dreamy":-1,"calm":-1}
}
WEATHER_SEARCH_KEYWORD = {
    "Rain":"rainy","Clear":"sunny","Clouds":"cloudy",
    "Thunderstorm":"storm","Mist":"misty","Snow":"winter","Dust":"desert"
}
# Per-language rain/weather keywords that work naturally in regional iTunes searches
# Only include languages/conditions where the local term genuinely improves signal
WEATHER_SEARCH_KEYWORD_INDIAN = {
    "Hindi":     {"Rain": "baarish",  "Thunderstorm": "baarish",  "Mist": "baarish",  "Snow": "romantic"},
    "Punjabi":   {"Rain": "baarish",  "Thunderstorm": "baarish",  "Mist": "baarish",  "Snow": "romantic"},
    "Bhojpuri":  {"Rain": "baarish",  "Thunderstorm": "baarish",  "Mist": "baarish"},
    "Bengali":   {"Rain": "brishti",  "Thunderstorm": "brishti",  "Mist": "brishti",  "Snow": "romantic"},
    "Marathi":   {"Rain": "paus",     "Thunderstorm": "paus",     "Mist": "paus"},
    "Gujarati":  {"Rain": "varsa",    "Thunderstorm": "varsa",    "Mist": "varsa"},
    "Tamil":     {"Rain": "mazhai",   "Thunderstorm": "mazhai",   "Mist": "mazhai"},
    "Telugu":    {"Rain": "vana",     "Thunderstorm": "vana"},
    "Kannada":   {"Rain": "male",     "Thunderstorm": "male"},
    "Malayalam": {"Rain": "mazha",    "Thunderstorm": "mazha",    "Mist": "mazha"},
    "Odia":      {"Rain": "barkha",   "Thunderstorm": "barkha"},
}
ENERGY_SEARCH_KEYWORD = {
    1:"soft slow",2:"mellow gentle",3:"",4:"upbeat",5:"intense"
}

VIBE_QUERIES = {
    "happy":     ["Anne-Marie","Justin Bieber","Selena Gomez","feel good pop","upbeat summer pop"],
    "sad":       ["Olivia Rodrigo","LAUV","Sasha Alex Sloan","heartbreak pop","sad indie pop"],
    "stressed":  ["Ed Sheeran","Shawn Mendes","Charlie Puth","calming soft songs","gentle acoustic pop"],
    "focus":     ["study focus music","concentration work beats","productive instrumental"],
    "romantic":  ["Ed Sheeran","Charlie Puth","Shawn Mendes","Taylor Swift","James Arthur","Ellie Goulding","romantic love songs","sweet love ballads"],
    "nostalgic": ["Taylor Swift","Maroon 5","The Cranberries","2010s pop hits","throwback indie pop"],
    "excited":   ["Bruno Mars","Justin Bieber","Shawn Mendes","Charlie Puth","Ed Sheeran","hype upbeat pop","exciting dance pop"],
    "calm":      ["Ed Sheeran","Shawn Mendes","Charlie Puth","soft acoustic songs","slow gentle ballads"],
    "angry":     ["Paramore","Twenty One Pilots","Avril Lavigne","punk pop anthems","alternative rock"],
    "dreamy":    ["LAUV","Madison Beer","Alan Walker","dreamy indie pop","ethereal pop"],
    "party":     ["Bruno Mars","Justin Bieber","Maroon 5","dance pop hits","upbeat party pop"],
    "uplifting": ["Selena Gomez","Taylor Swift","Maroon 5","inspirational pop","feel good anthems"],
    "soothing":  ["Ed Sheeran","Shawn Mendes","Charlie Puth","soft soothing pop","gentle vocal ballads"],
    "chill":     ["Ed Sheeran","Charlie Puth","Alan Walker","chill indie pop","easy listening pop"],
    "energetic": ["Alan Walker","Bruno Mars","Justin Bieber","high energy pop","workout pop bops"],
    "fresh":     ["Olivia Rodrigo","Selena Gomez","Anne-Marie","trending pop songs","new pop hits"],
    "mellow":    ["Ed Sheeran","Shawn Mendes","Charlie Puth","mellow acoustic","soft easy listening"],
    "upbeat":    ["Bruno Mars","Taylor Swift","Maroon 5","upbeat dance pop","fun pop bops"],
    "healing":   ["LAUV","Sasha Alex Sloan","Madison Beer","emotional healing songs","comfort pop"],
}

# Short 1-3 word vibe terms that combine cleanly with non-English templates
# e.g. "bollywood {vibe}" needs single-phrase modifiers, not long English descriptions
VIBE_QUERIES_INDIAN = {
    "focus":     ["soft instrumental","calm melodious","background melody"],
    "stressed":  ["Lucky Ali","Mohit Chauhan","soothing calm songs","soft relaxing"],
    "nostalgic": ["Atif Aslam","KK","Mohit Chauhan","Pritam","2000s hindi songs"],
    "dreamy":    ["soft dreamy","gentle dreamy","dreamy melody"],
    "uplifting": ["Sukhwinder Singh","motivational songs","feel good inspirational"],
    "healing":   ["Jubin Nautiyal","Arijit Singh","healing songs","emotional comfort"],
    "excited":   ["pump up","hype energy","exciting upbeat"],
    "energetic": ["Shankar Mahadevan","Guru Randhawa","Vishal-Shekhar","Sunidhi Chauhan","dance pop","high energy dance"],
    "angry":     ["intense powerful","angry energy","rage intense"],
    "fresh":     ["trending songs","new songs","latest hits","top chart songs"],
    "chill":     ["Lucky Ali","Mohit Chauhan","chill relaxed","easy chill"],
    "soothing":  ["Shreya Ghoshal","Armaan Malik","Monali Thakur","soothing songs","gentle songs"],
    "mellow":    ["mellow soft","gentle smooth","soft mellow"],
    "upbeat":    ["upbeat dance","party upbeat","high energy dance"],
    "calm":      ["Shreya Ghoshal","Monali Thakur","Kavita Seth","soft slow","mellow gentle"],
    "happy":     ["Iqlipse Nova","Aditya Rikhari","Akshath"],
    "sad":       ["Arijit Singh sad","Atif Aslam","Anuv Jain","dil dard","emotional breakup"],
    "romantic":  ["Armaan Malik","Darshan Raval","Shreya Ghoshal","Pritam","Anuv Jain","Arijit Singh romantic","romantic love","pyaar songs"],
    "party":     ["Badshah","Diljit Dosanjh","Yo Yo Honey Singh","bhangra party","dance hits"],
}

# Specific song title searches for Hindi — injected as direct iTunes queries,
# bypassing the bollywood/hindi template so the exact song always gets a shot.
HINDI_SONG_PINS = {
    "sad":      ["Tum Hi Ho", "Kabhi Jo Badal", "Husn Anuv Jain"],
    "romantic": ["Anuv Jain romantic", "Humdard Arijit Singh"],
    "calm":     ["Agar Tum Saath Ho", "Sukoon Mila"],
    "party":    ["Tareefan"],
    "happy":    ["Malang Sajna", "Pal Pal Dil Ke Paas"],
}

# Same concept for English — direct song title searches added to vibe queries.
ENGLISH_SONG_PINS = {
    "romantic":  ["Love Story Taylor Swift", "Perfect Ed Sheeran", "Blue"],
    "nostalgic": ["Friends Marshmello Anne-Marie", "2002 Anne-Marie", "That's So True Gracie Abrams", "Drag Me Down One Direction"],
    "excited":   ["Metro Boomin Spider-Man", "Calling Metro Boomin"],
}

# For Hindi/Indian, shift vibes map to abstract terms (e.g. "uplifting") that don't
# search well on iTunes. Remap them to the closest practical match-mode vibe.
SHIFT_VIBE_REMAP_INDIAN = {
    "uplifting": "happy",
    "soothing":  "calm",
    "fresh":     "happy",
    "mellow":    "calm",
    "upbeat":    "party",
    "chill":     "calm",
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
        "primary_queries":  ["{vibe}", "{vibe} {energy} music"],
        "artist_queries":   ["Sabrina Carpenter","Katy Perry","Taylor Swift","Dua Lipa"],
        "country":          "US",
        "banned_genres":    [
            "thai", "k-pop", "j-pop", "j-rock", "anime",
            "bollywood", "hindi", "regional indian",
            "punjabi", "bengali", "tamil", "telugu",
            "kannada", "malayalam", "marathi", "gujarati", "odia", "bhojpuri",
            "mandopop", "cantopop", "cpop",
            "world music", "latin", "country", "folk",
        ],
        "required_genre":   None,
    },
    "Hindi": {
        "primary_queries":  ["bollywood {vibe}","hindi {vibe} songs","{vibe} bollywood hindi"],
        "artist_queries":   ["Darshan Raval","Armaan Malik","Shreya Ghoshal","Shankar-Ehsaan-Loy"],
        "indie_artists":    ["Anuv Jain","Aditya Bhardwaj","Vismay Patel","Anushka Baduwal"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","country","rock","metal"],
        "required_genre":   ["bollywood","hindi","indian pop","indie pop"],
        "indian_vibes":     True,
    },
    "Tamil": {
        "primary_queries":  ["tamil {vibe} songs","kollywood {vibe}","AR Rahman {vibe}"],
        "artist_queries":   ["AR Rahman","Anirudh Ravichander","Sid Sriram","Harris Jayaraj"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   ["tamil","kollywood"],
        "indian_vibes":     True,
    },
    "Telugu": {
        "primary_queries":  ["telugu {vibe} songs","tollywood {vibe}","SS Thaman {vibe}"],
        "artist_queries":   ["SS Thaman","Devi Sri Prasad","Manisharma","Sid Sriram"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   ["telugu","tollywood"],
        "indian_vibes":     True,
    },
    "Kannada": {
        "primary_queries":  ["kannada {vibe} songs","sandalwood {vibe}","V Harikrishna {vibe}"],
        "artist_queries":   ["V Harikrishna","Arjun Janya","Rajesh Krishnan","Sonu Nigam"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   ["kannada","sandalwood"],
        "indian_vibes":     True,
    },
    "Malayalam": {
        "primary_queries":  ["malayalam {vibe} songs","mollywood {vibe}","kerala film {vibe}"],
        "artist_queries":   ["KS Chithra","Vineeth Sreenivasan","Shreya Ghoshal Malayalam","M Jayachandran"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   ["malayalam","mollywood"],
        "indian_vibes":     True,
    },
    "Punjabi": {
        "primary_queries":  ["punjabi {vibe} songs","punjabi pop {vibe}","bhangra {vibe}"],
        "artist_queries":   ["Diljit Dosanjh","AP Dhillon","Sidhu Moosewala","Guru Randhawa"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian"],
        "required_genre":   ["punjabi","bhangra"],
        "indian_vibes":     True,
    },
    "Bengali": {
        "primary_queries":  ["bengali {vibe} songs","bangla {vibe} music","rabindra sangeet {vibe}"],
        "artist_queries":   ["Anupam Roy","Nachiketa Chakraborty","Rupankar Bagchi","Usha Uthup"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   ["bengali","bangla"],
        "indian_vibes":     True,
    },
    "Marathi": {
        "primary_queries":  ["marathi {vibe} songs","marathi pop {vibe}","Ajay-Atul {vibe}"],
        "artist_queries":   ["Ajay-Atul","Shankar Mahadevan","Vaibhav Joshi","Hrishikesh Ranade"],
        "country":          "IN",
        "banned_genres":    ["children","classical","devotional","christian","hindi","bollywood"],
        "required_genre":   ["marathi"],
        "indian_vibes":     True,
    },
    "Gujarati": {
        "primary_queries":  ["gujarati {vibe} songs","gujarati garba {vibe}","gujarati folk {vibe}"],
        "artist_queries":   ["Kirtidan Gadhvi","Osman Mir","Aishwarya Majmudar","Parthiv Gohil"],
        "country":          "IN",
        "banned_genres":    ["children","christian","hindi","bollywood"],
        "required_genre":   ["gujarati"],
        "indian_vibes":     True,
    },
    "Odia": {
        "primary_queries":  ["odia songs {vibe}","ollywood {vibe}","Human Sagar {vibe}"],
        "artist_queries":   ["Human Sagar","Ira Mohanty","Tapu Mishra","Nibedita"],
        "country":          "IN",
        "banned_genres":    ["children","christian","hindi","bollywood","tamil","telugu"],
        "required_genre":   ["regional indian","odia","oriya"],
        "indian_vibes":     True,
    },
    "Bhojpuri": {
        "primary_queries":  ["bhojpuri {vibe} songs","bhojpuri hit {vibe}","bhojpuri music"],
        "artist_queries":   ["Pawan Singh","Khesari Lal Yadav","Neelkamal Singh","Ritesh Pandey"],
        "country":          "IN",
        "banned_genres":    ["children","christian","tamil","telugu","kannada"],
        "required_genre":   ["bhojpuri"],
        "indian_vibes":     True,
    },
}


def get_weather_data(lat: float | None, lon: float | None) -> dict:
    if lat is None or lon is None:
        # Can't determine local time without coordinates — default to day
        return {"condition": "Clear", "is_night": False}

    url = (
        "https://api.openweathermap.org/data/2.5/weather"
        f"?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
    )
    try:
        r = requests.get(url, timeout=10)
        if r.status_code != 200:
            return {}
        d = r.json()
        dt      = d.get("dt", 0)
        sunrise = d.get("sys", {}).get("sunrise", 0)
        sunset  = d.get("sys", {}).get("sunset", 0)
        is_night = bool(sunrise and sunset and (dt < sunrise or dt > sunset))
        return {
            "condition":       d["weather"][0]["main"],
            "description":     d["weather"][0]["description"],
            "temp_c":          round(d["main"]["temp"], 1),
            "feels_like_c":    round(d["main"]["feels_like"], 1),
            "humidity":        d["main"]["humidity"],
            "city_name":       d.get("name", ""),
            "country":         d.get("sys", {}).get("country", ""),
            "timezone_offset": d.get("timezone"),
            "is_night":        is_night,
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
    for banned in cfg["banned_genres"]:
        if banned in genre:
            return False
    if cfg["required_genre"]:
        required = cfg["required_genre"]
        if isinstance(required, list):
            return any(r.lower() in genre for r in required)
        return required.lower() in genre
    return True


def build_query(template: str, vibe: str, energy_kw: str) -> str:
    return template.replace("{vibe}", vibe).replace("{energy}", energy_kw).strip()


def _title_key(item: dict) -> str:
    """Dedup key: base title (no version/remix/subtitle) — catches both (LoFi Mix) and - LoFi Mix."""
    base = item.get('trackName', '')
    base = re.sub(r'\s*[\(\[].*', '', base)       # strip (LoFi Flip) / [Remix]
    base = re.sub(r'\s+[-–]\s+.*', '', base)       # strip - LoFi Mix / - From "Movie"
    return base.strip().lower()


def get_recommendations(base_vibe: str, adjusted_energy: int, language: str, weather: str) -> list:
    cfg       = LANGUAGE_CONFIG.get(language, LANGUAGE_CONFIG["English"])
    # Indian languages need short modifier terms; English uses full descriptive phrases
    vibe_pool = VIBE_QUERIES_INDIAN if cfg.get("indian_vibes") else VIBE_QUERIES
    # Remap abstract shift vibes (e.g. "uplifting") to concrete iTunes-friendly equivalents
    if cfg.get("indian_vibes") and base_vibe in SHIFT_VIBE_REMAP_INDIAN:
        base_vibe = SHIFT_VIBE_REMAP_INDIAN[base_vibe]
    vibe_terms = vibe_pool.get(base_vibe) or VIBE_QUERIES.get(base_vibe, VIBE_QUERIES["calm"])
    energy_kw  = ENERGY_SEARCH_KEYWORD.get(adjusted_energy, "")
    weather_kw = WEATHER_SEARCH_KEYWORD.get(weather, "")
    country    = cfg["country"]

    # For happy vibe with Indian languages, tighten genre to indie pop only so
    # "bollywood Iqlipse Nova" doesn't pull in sad mainstream Bollywood alongside it
    if base_vibe == "happy" and cfg.get("indian_vibes"):
        cfg = {**cfg, "required_genre": ["indian pop","indie pop","pop"]}
    seen_ids     = set()
    seen_titles  = set()
    seen_artists = {}      # artist -> count, cap at MAX_PER_ARTIST across all phases
    MAX_PER_ARTIST = 2
    tracks       = []

    # Phase 1 — vibe queries with full genre filter
    vibe_queries = []
    for tmpl in cfg["primary_queries"]:
        for vibe in vibe_terms[:2]:
            vibe_queries.append(build_query(tmpl, vibe, energy_kw))

    # Insert a weather-contextual query first so weather influences which songs
    # surface, not just energy level. English and Indian use different keywords.
    if vibe_terms:
        if cfg.get("indian_vibes"):
            indian_wx_kw = WEATHER_SEARCH_KEYWORD_INDIAN.get(language, {}).get(weather)
            if indian_wx_kw:
                # e.g. "bollywood baarish romantic" — language template + weather + vibe
                lang_prefix = cfg["primary_queries"][0].split("{")[0].strip()
                vibe_queries.insert(0, f"{lang_prefix} {indian_wx_kw} {vibe_terms[0]}".strip())
            elif weather_kw:
                # no regional keyword for this condition — fall back to English weather term
                vibe_queries.insert(0, f"{weather_kw} {vibe_terms[0]}")
        elif weather_kw:
            vibe_queries.insert(0, f"{weather_kw} {vibe_terms[0]}")

    # Phase 0 — pinned songs: searched first, placed at front of result so they
    # are never shuffled out of the top 7. Genre filter relaxed so specific titles
    # (e.g. Husn tagged "Singer/Songwriter") aren't blocked by language filters.
    pin_list   = HINDI_SONG_PINS.get(base_vibe, []) if cfg.get("indian_vibes") else ENGLISH_SONG_PINS.get(base_vibe, [])
    pin_cfg    = {**cfg, "required_genre": None}
    pin_tracks = []

    for song in pin_list:
        items = search_itunes(song, country=country, limit=5)
        for item in items:
            track_id = item.get("trackId")
            if not track_id or track_id in seen_ids:
                continue
            if not passes_genre_filter(item, pin_cfg):
                continue
            title_key = _title_key(item)
            if title_key in seen_titles:
                continue
            artist_key = item.get("artistName", "").strip().lower()
            if seen_artists.get(artist_key, 0) >= MAX_PER_ARTIST:
                continue
            seen_ids.add(track_id)
            seen_titles.add(title_key)
            seen_artists[artist_key] = seen_artists.get(artist_key, 0) + 1
            t = format_track(item)
            if t:
                pin_tracks.append(t)
                break  # one track per pin query is enough

    pool = []

    for query in vibe_queries:
        items = search_itunes(query, country=country, limit=25)
        for item in items:
            track_id = item.get("trackId")
            if not track_id or track_id in seen_ids:
                continue
            if not passes_genre_filter(item, cfg):
                continue
            title_key = _title_key(item)
            if title_key in seen_titles:
                continue
            artist_key = item.get("artistName", "").strip().lower()
            if seen_artists.get(artist_key, 0) >= MAX_PER_ARTIST:
                continue
            seen_ids.add(track_id)
            seen_titles.add(title_key)
            seen_artists[artist_key] = seen_artists.get(artist_key, 0) + 1
            t = format_track(item)
            if t:
                pool.append(t)

    # Phase 2 — artist fallback; only when Phase 1 didn't yield enough
    if len(pool) + len(pin_tracks) < 7:
        artist_cfg = {**cfg, "required_genre": None}
        mood_hint = "" if cfg.get("indian_vibes") else (vibe_terms[0] if vibe_terms else "")
        for artist in cfg["artist_queries"]:
            query = f"{artist} {mood_hint}".strip() if mood_hint else artist
            items = search_itunes(query, country=country, limit=20)
            for item in items:
                track_id = item.get("trackId")
                if not track_id or track_id in seen_ids:
                    continue
                if not passes_genre_filter(item, artist_cfg):
                    continue
                title_key = _title_key(item)
                if title_key in seen_titles:
                    continue
                artist_key = item.get("artistName", "").strip().lower()
                if seen_artists.get(artist_key, 0) >= MAX_PER_ARTIST:
                    continue
                seen_ids.add(track_id)
                seen_titles.add(title_key)
                seen_artists[artist_key] = seen_artists.get(artist_key, 0) + 1
                t = format_track(item)
                if t:
                    pool.append(t)

    # Indie boost — always inject a few tracks from indie artists who get filtered out by
    # genre in Phase 1 (e.g. Anuv Jain tagged "Pop" not "Bollywood"). Only for emotional vibes.
    if base_vibe in ("sad", "healing", "nostalgic", "romantic") and cfg.get("indie_artists"):
        indie_cfg = {**cfg, "required_genre": None}
        mood_hint = vibe_terms[0] if vibe_terms else ""
        for artist in cfg["indie_artists"]:
            query = f"{artist} {mood_hint}".strip() if mood_hint else artist
            items = search_itunes(query, country=country, limit=10)
            for item in items:
                track_id = item.get("trackId")
                if not track_id or track_id in seen_ids:
                    continue
                if not passes_genre_filter(item, indie_cfg):
                    continue
                title_key = _title_key(item)
                if title_key in seen_titles:
                    continue
                artist_key = item.get("artistName", "").strip().lower()
                if seen_artists.get(artist_key, 0) >= MAX_PER_ARTIST:
                    continue
                seen_ids.add(track_id)
                seen_titles.add(title_key)
                seen_artists[artist_key] = seen_artists.get(artist_key, 0) + 1
                t = format_track(item)
                if t:
                    pool.append(t)

    random.shuffle(pool)
    return (pin_tracks + pool)[:7]


@app.get("/full-url")
def get_full_url(song: str, artist: str):
    try:
        r = requests.get(
            "https://saavn.dev/api/search/songs",
            params={"query": f"{song} {artist}", "limit": 3},
            timeout=4
        )
        if r.status_code != 200:
            return {"url": None}
        results = r.json().get("data", {}).get("results", [])
        if not results:
            return {"url": None}
        urls = results[0].get("downloadUrl", [])
        best = next((u["url"] for u in reversed(urls) if u.get("url")), None)
        return {"url": best}
    except Exception:
        return {"url": None}


@app.get("/")
def home():
    return {"message": "MoodSync backend alive"}


@app.get("/weather/preview")
def weather_preview(lat: float, lon: float):
    data = get_weather_data(lat, lon)
    if not data:
        return {"condition": "Clear", "is_night": False, "temp_c": None, "city_name": ""}
    return {
        "condition": normalize_weather(data.get("condition", "Clear")),
        "is_night":  data.get("is_night", False),
        "temp_c":    data.get("temp_c"),
        "city_name": data.get("city_name", ""),
    }


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
    weather_data    = get_weather_data(user.lat, user.lon)
    current_weather = normalize_weather(weather_data.get("condition", "Clear"))
    fit             = WEATHER_VIBE_FIT.get(current_weather, {}).get(base_vibe, 0)
    adjusted_energy = max(1, min(5, user.energy + fit))
    intensity       = ENERGY_MAP[adjusted_energy]
    results         = get_recommendations(base_vibe, adjusted_energy, user.language, current_weather)

    weather_context = ""
    if weather_data.get("description"):
        city_part = weather_data.get("city_name", "")
        country_part = weather_data.get("country", "")
        location = ", ".join(p for p in [city_part, country_part] if p)
        weather_context = (
            f"{weather_data['description'].title()}"
            + (f" in {location}" if location else "")
            + f" — {weather_data.get('temp_c','?')}°C"
            + f" (feels like {weather_data.get('feels_like_c','?')}°C)"
        )

    return {
        "weather":         current_weather,
        "weather_detail":  weather_context,
        "humidity":        weather_data.get("humidity"),
        "temp_c":          weather_data.get("temp_c"),
        "city_name":       weather_data.get("city_name", ""),
        "timezone_offset": weather_data.get("timezone_offset"),
        "is_night":        weather_data.get("is_night", False),
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