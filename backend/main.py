import os
import re
import sys
import base64
import sqlite3
import tempfile
import requests
import urllib3
import concurrent.futures
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# --- path setup ---
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))

from bs4 import BeautifulSoup
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

# --- Model import ---
try:
    from model import DocGuardModel
    MODEL_AVAILABLE = True
except ImportError:
    MODEL_AVAILABLE = False

# --- QR module imports ---
from qr_module.qr_verifier import verify_qr_api
from qr_module.ocr_extractor import extract_certificate_data
from qr_module.json_matcher import match_json

app = FastAPI(title="DocGuard API", version="4.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# CONFIG
# ============================================================
_cnn_model = None
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

GROQ_API_URL      = "https://api.groq.com/openai/v1/chat/completions"
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
GROQ_TEXT_MODEL   = "llama-3.3-70b-versatile"

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

KNOWN_CERTIFICATE_DOMAINS = {
    "udemy.com", "coursera.org", "linkedin.com", "credly.com",
    "mygreatlearning.com", "simplilearn.com", "edx.org", "nptel.ac.in",
    "hackerrank.com", "kaggle.com", "aws.amazon.com", "microsoft.com",
    "google.com", "freecodecamp.org", "pluralsight.com", "skillshare.com",
    "alison.com", "futurelearn.com", "udacity.com", "codecademy.com",
    "infosys.com", "tcs.com", "nasscom.in",
}

CERTIFICATE_POSITIVE_SIGNALS = [
    "certificate", "congratulations", "completed", "awarded", "credential",
    "verification", "verified", "issued to", "successfully", "accomplished",
]

CERTIFICATE_NEGATIVE_SIGNALS = [
    "certificate not found", "invalid certificate", "no certificate",
    "page not found", "404", "does not exist", "not valid", "expired",
    "error", "oops", "something went wrong",
]

SCAM_PAGE_SIGNALS = [
    "enter your details", "sign up to view", "create an account to verify",
    "this certificate is for demonstration", "sample certificate",
    "template", "demo page", "lorem ipsum",
]


def make_session(verify_ssl: bool = True) -> requests.Session:
    s = requests.Session()
    s.verify = verify_ssl
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        )
    })
    return s


# ============================================================
# CNN MODEL
# ============================================================
def get_cnn_model():
    global _cnn_model
    if _cnn_model is None and MODEL_AVAILABLE:
        model_path = BASE_DIR / "efficientnet_b0_docguard.pth"
        if model_path.exists():
            try:
                _cnn_model = DocGuardModel(str(model_path))
            except Exception as e:
                print(f"CNN model load error: {e}")
    return _cnn_model


# ============================================================
# GROQ VISION — extract certificate fields
# ============================================================
def groq_headers() -> dict:
    return {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

def image_to_base64(img_path: str) -> str:
    with open(img_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def groq_vision_extract(img_path: str) -> dict:
    b64 = image_to_base64(img_path)
    payload = {
        "model": GROQ_VISION_MODEL,
        "max_tokens": 800,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                {
                    "type": "text",
                    "text": (
                        "You are a certificate parser. Extract information from this certificate image.\n"
                        "Return ONLY these lines, nothing else:\n"
                        "NAME: <recipient full name>\n"
                        "COURSE: <course or program name>\n"
                        "DATE: <completion or issue date>\n"
                        "CERT_ID: <certificate or credential ID, or NONE>\n"
                        "ISSUER: <issuing organization>\n"
                        "URLS: <all URLs visible on certificate separated by comma, or NONE>\n"
                    )
                }
            ]
        }]
    }
    session = make_session(verify_ssl=False)
    resp = session.post(GROQ_API_URL, headers=groq_headers(), json=payload, timeout=40)
    resp.raise_for_status()
    raw = resp.json()["choices"][0]["message"]["content"]

    result = {"name": "", "course": "", "date": "", "cert_id": "", "issuer": "", "urls": [], "raw_text": raw}
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("NAME:"):
            result["name"] = line.split(":", 1)[1].strip()
        elif line.startswith("COURSE:"):
            result["course"] = line.split(":", 1)[1].strip()
        elif line.startswith("DATE:"):
            result["date"] = line.split(":", 1)[1].strip()
        elif line.startswith("CERT_ID:"):
            result["cert_id"] = line.split(":", 1)[1].strip()
        elif line.startswith("ISSUER:"):
            result["issuer"] = line.split(":", 1)[1].strip()
        elif line.startswith("URLS:"):
            raw_urls = line.split(":", 1)[1].strip()
            if raw_urls.upper() != "NONE" and raw_urls:
                result["urls"] = [u.strip() for u in raw_urls.split(",") if u.strip()]
    return result


# ============================================================
# PERSON VERIFICATION via web search + Groq analysis
# Supports: Tavily (free tier) → DuckDuckGo (fallback, no key)
# ============================================================

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")   # optional — free at tavily.com


def web_search_tavily(query: str, max_results: int = 5) -> list:
    """Search via Tavily API (free tier: 1000 searches/month, no card needed)."""
    session = make_session(verify_ssl=False)
    resp = session.post(
        "https://api.tavily.com/search",
        json={"api_key": TAVILY_API_KEY, "query": query, "max_results": max_results, "search_depth": "basic"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return [
        {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("content", "")[:300]}
        for r in data.get("results", [])
    ]


def web_search_duckduckgo(query: str, max_results: int = 5) -> list:
    """Fallback: scrape DuckDuckGo HTML — no API key needed."""
    session = make_session(verify_ssl=False)
    resp = session.post(
        "https://html.duckduckgo.com/html/",
        data={"q": query, "b": "", "kl": ""},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    soup = BeautifulSoup(resp.text, "html.parser")
    results = []
    for result in soup.select(".result")[:max_results]:
        title_el   = result.select_one(".result__title")
        snippet_el = result.select_one(".result__snippet")
        url_el     = result.select_one(".result__url")
        title   = title_el.get_text(strip=True)   if title_el   else ""
        snippet = snippet_el.get_text(strip=True) if snippet_el else ""
        url     = url_el.get_text(strip=True)     if url_el     else ""
        if title or snippet:
            results.append({"title": title, "url": url, "snippet": snippet})
    return results


def web_search(query: str, max_results: int = 5) -> list:
    """Try Tavily first, fall back to DuckDuckGo, then return empty on failure."""
    if TAVILY_API_KEY:
        try:
            return web_search_tavily(query, max_results)
        except Exception:
            pass
    try:
        return web_search_duckduckgo(query, max_results)
    except Exception as e:
        return [{"title": "Search unavailable", "url": "", "snippet": str(e)[:120]}]


def groq_analyze_person(
    name: str, course: str, issuer: str,
    issuer_results: list, person_results: list, scam_results: list
) -> dict:
    """
    Send search snippets to Groq text model for analysis.
    Groq reads the evidence and gives a structured verdict.
    """
    def fmt_results(results):
        if not results:
            return "  (no results found)"
        lines = ["  - " + r["title"] + ": " + r["snippet"] for r in results]
        return "\n".join(lines)

    prompt = "\n".join([
        "You are a certificate fraud detection expert.",
        "A certificate claims:",
        f"  Person : {name}",
        f"  Course : {course}",
        f"  Issuer : {issuer}",
        "",
        "Here are real web search results to help you verify:",
        "",
        f"SEARCH 1 - Is '{issuer}' a legitimate issuer for '{course}'?",
        fmt_results(issuer_results),
        "",
        f"SEARCH 2 - Public records of '{name}' completing '{course}' from '{issuer}':",
        fmt_results(person_results),
        "",
        f"SEARCH 3 - Scam reports / fraud alerts for '{issuer}':",
        fmt_results(scam_results),
        "",
        "Based on the evidence above, reply STRICTLY in this format (no extra text):",
        "ISSUER_LEGIT: YES/NO/UNKNOWN",
        "COURSE_EXISTS: YES/NO/UNKNOWN",
        "PERSON_FOUND: YES/NO/UNKNOWN",
        "VERDICT: LIKELY_AUTHENTIC / SUSPICIOUS / UNVERIFIABLE",
        "REASON: <one concise paragraph summarising your finding>",
    ])

    payload = {
        "model": GROQ_TEXT_MODEL,
        "max_tokens": 600,
        "temperature": 0.1,
        "messages": [
            {"role": "system", "content": "You are a certificate fraud detection assistant. Respond only in the exact format requested."},
            {"role": "user", "content": prompt},
        ],
    }

    session = make_session(verify_ssl=False)
    resp = session.post(GROQ_API_URL, headers=groq_headers(), json=payload, timeout=30)
    resp.raise_for_status()
    raw = resp.json()["choices"][0]["message"]["content"].strip()

    result = {
        "issuer_legit": "UNKNOWN", "course_exists": "UNKNOWN",
        "person_found": "UNKNOWN", "verdict": "UNVERIFIABLE",
        "reason": raw,
    }
    for line in raw.splitlines():
        line = line.strip()
        if line.startswith("ISSUER_LEGIT:"):
            result["issuer_legit"] = line.split(":", 1)[1].strip()
        elif line.startswith("COURSE_EXISTS:"):
            result["course_exists"] = line.split(":", 1)[1].strip()
        elif line.startswith("PERSON_FOUND:"):
            result["person_found"] = line.split(":", 1)[1].strip()
        elif line.startswith("VERDICT:"):
            result["verdict"] = line.split(":", 1)[1].strip()
        elif line.startswith("REASON:"):
            result["reason"] = line.split(":", 1)[1].strip()
    return result


def groq_person_verify(name: str, course: str, issuer: str) -> dict:
    """
    Full person verification pipeline (no paid API needed):
      1. Run 3 targeted DuckDuckGo searches in parallel
      2. Feed snippets to Groq text model for structured analysis
    """
    if not name or not issuer:
        return {
            "issuer_legit": "UNKNOWN", "course_exists": "UNKNOWN",
            "person_found": "UNKNOWN", "verdict": "UNVERIFIABLE",
            "reason": "Name or issuer missing — skipped.",
        }

    q_issuer = f"{issuer} {course} certification official"
    q_person = f'"{name}" {course} {issuer} certificate completed'
    q_scam   = f"{issuer} certificate fake scam fraud"

    # Run all 3 searches in parallel (Tavily if key set, else DuckDuckGo)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
        f_issuer = ex.submit(web_search, q_issuer, 4)
        f_person = ex.submit(web_search, q_person, 4)
        f_scam   = ex.submit(web_search, q_scam,   3)
        issuer_results = f_issuer.result()
        person_results = f_person.result()
        scam_results   = f_scam.result()

    try:
        return groq_analyze_person(name, course, issuer, issuer_results, person_results, scam_results)
    except Exception as e:
        return {
            "issuer_legit": "UNKNOWN", "course_exists": "UNKNOWN",
            "person_found": "UNKNOWN", "verdict": "UNVERIFIABLE",
            "reason": f"Groq analysis failed: {str(e)}",
        }


# ============================================================
# URL VALIDATION + SCAM DETECTION
# ============================================================
def validate_url_format(url: str) -> dict:
    try:
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return {"valid": False, "reason": "Missing scheme or domain", "cleaned_url": url}
        if parsed.scheme not in ("http", "https"):
            return {"valid": False, "reason": f"Invalid scheme: {parsed.scheme}", "cleaned_url": url}
        if "." not in parsed.netloc:
            return {"valid": False, "reason": "Invalid domain (no TLD)", "cleaned_url": url}
        if " " in url:
            return {"valid": False, "reason": "URL contains spaces", "cleaned_url": url}
        import ipaddress
        host = parsed.hostname or ""
        try:
            ip = ipaddress.ip_address(host)
            if ip.is_private or ip.is_loopback:
                return {"valid": False, "reason": "Private/localhost IP not allowed", "cleaned_url": url}
        except ValueError:
            pass
        return {"valid": True, "reason": "Format OK", "cleaned_url": url}
    except Exception as e:
        return {"valid": False, "reason": str(e), "cleaned_url": url}


def transform_short_url(url: str) -> str:
    try:
        if "verify.mygreatlearning.com" in url:
            code = url.rstrip("/").split("/")[-1]
            return f"https://www.mygreatlearning.com/certificate/{code}"
        elif "coursera.org/verify" in url:
            code = url.split("/verify/")[-1].rstrip("/")
            return f"https://www.coursera.org/account/accomplishments/verify/{code}"
        elif "ude.my" in url:
            code = url.rstrip("/").split("/")[-1]
            return f"https://www.udemy.com/certificate/{code}/"
        return url
    except Exception:
        return url


def is_likely_scam_page(html_text: str, page_title: str, final_url: str,
                         expected_name: str = "", expected_issuer: str = "") -> dict:
    text_lower = html_text.lower()
    signals = []

    for phrase in SCAM_PAGE_SIGNALS:
        if phrase in text_lower:
            signals.append(f"SCAM_SIGNAL: '{phrase}'")

    try:
        domain = urlparse(final_url).netloc.lower().replace("www.", "")
        domain_trusted = any(
            domain == known or domain.endswith("." + known)
            for known in KNOWN_CERTIFICATE_DOMAINS
        )
        if not domain_trusted:
            signals.append(f"UNTRUSTED_DOMAIN: {domain}")
    except Exception:
        pass

    if expected_name and len(expected_name) > 3:
        name_parts = expected_name.lower().split()
        if not any(part in text_lower for part in name_parts if len(part) > 2):
            signals.append(f"NAME_NOT_ON_PAGE: '{expected_name}' not found in page")

    if expected_issuer and len(expected_issuer) > 3:
        if expected_issuer.lower() not in text_lower:
            signals.append(f"ISSUER_NOT_ON_PAGE: '{expected_issuer}' not found in page")

    positive_hits = [p for p in CERTIFICATE_POSITIVE_SIGNALS if p in text_lower]
    if not positive_hits:
        signals.append("NO_CERTIFICATE_KEYWORDS: page has no certificate-related text")

    scam_signal_count = sum(1 for s in signals if s.startswith("SCAM_SIGNAL"))
    untrusted = any(s.startswith("UNTRUSTED_DOMAIN") for s in signals)
    name_missing = any(s.startswith("NAME_NOT_ON_PAGE") for s in signals)

    if scam_signal_count >= 2 or (untrusted and name_missing):
        return {"is_scam": True, "confidence": "HIGH", "signals": signals}
    elif scam_signal_count == 1 or untrusted or name_missing:
        return {"is_scam": True, "confidence": "MEDIUM", "signals": signals}
    else:
        return {"is_scam": False, "confidence": "LOW", "signals": signals}



# ============================================================
# COURSERA CERTIFICATE SCRAPER (platform-specific)
# ============================================================

def verify_coursera_url(url: str, expected_name: str = "") -> dict:
    """
    Coursera-specific verification using ALT text scraping.
    Coursera embed a description like "Certificate earned by <NAME>" in an img alt attribute.
    Returns same shape as check_url_valid so it plugs into the pipeline directly.
    """
    from urllib.parse import urlparse as _urlparse

    base = {
        "url": url, "valid": False, "status_code": None,
        "redirected_to": None, "ssl_warning": None,
        "error": None, "scam_analysis": None,
        "platform_check": {"platform": "coursera", "method": None, "name_matched": None},
    }

    # Domain guard
    parsed = _urlparse(url)
    if parsed.netloc.lower().replace("www.", "") != "coursera.org":
        base["error"] = "Not a Coursera domain"
        return base

    # Must have a verify path with a cert ID
    cert_id_match = re.search(r"/verify/([A-Z0-9]+)", url, re.I)
    if not cert_id_match:
        base["error"] = "No certificate ID found in Coursera URL"
        return base

    # Fetch with retries
    session = make_session(verify_ssl=False)
    resp = None
    for attempt in range(3):
        try:
            resp = session.get(url, timeout=20, allow_redirects=True)
            if resp.status_code == 200:
                break
            resp = None
        except Exception:
            import time
            time.sleep(1)

    if resp is None or resp.status_code != 200:
        base["status_code"] = resp.status_code if resp else None
        base["error"] = f"Failed to fetch Coursera page (HTTP {resp.status_code if resp else 'timeout'})"
        return base

    base["status_code"] = 200
    base["redirected_to"] = resp.url if resp.url != url else None

    soup = BeautifulSoup(resp.content, "html.parser")

    # Method 1: ALT text on certificate image
    alt_text = ""
    for img in soup.find_all("img"):
        alt = img.get("alt", "")
        if "certificate" in alt.lower():
            alt_text = alt
            break

    if alt_text:
        base["platform_check"]["method"] = "alt_text"
        base["platform_check"]["alt_text"] = alt_text
        if expected_name:
            try:
                from fuzzywuzzy import fuzz
                matched = fuzz.partial_ratio(expected_name.lower(), alt_text.lower()) >= 80
            except ImportError:
                matched = expected_name.lower() in alt_text.lower()
            base["platform_check"]["name_matched"] = matched
            if matched:
                base["valid"] = True
                base["platform_check"]["verdict"] = "NAME_CONFIRMED"
            else:
                base["valid"] = False
                base["error"] = f"Name on certificate page does not match: expected '{expected_name}', page says '{alt_text[:100]}'"
                base["platform_check"]["verdict"] = "NAME_MISMATCH"
        else:
            # No name to check — just confirm the page loaded a real certificate
            base["valid"] = True
            base["platform_check"]["verdict"] = "PAGE_LOADED_NO_NAME_CHECK"
        return base

    # Method 2: Fallback — check page title / meta for certificate signals
    title = soup.title.string if soup.title else ""
    meta_desc = ""
    for m in soup.find_all("meta"):
        if m.get("name", "").lower() == "description":
            meta_desc = m.get("content", "")
            break

    page_text = (title + " " + meta_desc).lower()
    if "certificate" in page_text and "coursera" in page_text:
        base["valid"] = True
        base["platform_check"]["method"] = "meta_fallback"
        base["platform_check"]["verdict"] = "PAGE_LOOKS_VALID_NO_NAME_CHECK"
    else:
        base["valid"] = False
        base["error"] = "Coursera page did not contain a valid certificate (no alt text or meta description)"
        base["platform_check"]["method"] = "meta_fallback"
        base["platform_check"]["verdict"] = "NO_CERTIFICATE_FOUND"

    return base

def check_url_valid(url: str, expected_name: str = "", expected_issuer: str = "") -> dict:
    # Step 1: Format validation
    fmt = validate_url_format(url)
    if not fmt["valid"]:
        return {
            "url": url, "valid": False, "status_code": None,
            "redirected_to": None, "error": f"Invalid URL format: {fmt['reason']}",
            "scam_analysis": None,
        }
    url = fmt["cleaned_url"]

    # Step 2: Platform-specific handlers
    if "credly.com" in url:
        return {
            "url": url, "valid": None, "status_code": None, "redirected_to": None,
            "note": "Credly blocks automated access — verify manually at credly.com",
            "scam_analysis": None,
        }

    # Coursera has a reliable scrape-based verifier — use it instead of generic check
    if "coursera.org" in url and "/verify/" in url:
        return verify_coursera_url(url, expected_name=expected_name)

    # Step 3: Expand short URLs
    expanded = transform_short_url(url)

    # Step 4: Try with SSL, fallback without (actual separate sessions)
    resp = None
    ssl_warning = None
    for verify_ssl in (True, False):
        try:
            session = make_session(verify_ssl=verify_ssl)
            resp = session.get(expanded, timeout=15, allow_redirects=True)
            if not verify_ssl:
                ssl_warning = "SSL certificate issue — connected without strict verification"
            break
        except requests.exceptions.SSLError:
            if verify_ssl:
                continue
            return {
                "url": expanded, "valid": False, "status_code": None,
                "redirected_to": None, "error": "SSL error even with relaxed verification",
                "scam_analysis": None,
            }
        except Exception as e:
            return {
                "url": expanded, "valid": False, "status_code": None,
                "redirected_to": None, "error": str(e)[:200],
                "scam_analysis": None,
            }

    if resp is None:
        return {
            "url": expanded, "valid": False, "status_code": None,
            "redirected_to": None, "error": "No response received",
            "scam_analysis": None,
        }

    final_url = resp.url
    text_lower = resp.text.lower()
    has_not_found = any(phrase in text_lower for phrase in CERTIFICATE_NEGATIVE_SIGNALS)

    if resp.status_code != 200 or has_not_found:
        return {
            "url": expanded, "valid": False, "status_code": resp.status_code,
            "redirected_to": final_url if final_url != expanded else None,
            "error": "Page indicates certificate not found" if has_not_found else f"HTTP {resp.status_code}",
            "ssl_warning": ssl_warning, "scam_analysis": None,
        }

    # Step 5: Scam/dummy page analysis
    try:
        soup = BeautifulSoup(resp.text, "html.parser")
        page_title = soup.title.string if soup.title else ""
    except Exception:
        page_title = ""

    scam_analysis = is_likely_scam_page(
        html_text=resp.text, page_title=page_title, final_url=final_url,
        expected_name=expected_name, expected_issuer=expected_issuer,
    )

    return {
        "url": expanded,
        "valid": not scam_analysis["is_scam"],
        "status_code": resp.status_code,
        "redirected_to": final_url if final_url != expanded else None,
        "ssl_warning": ssl_warning,
        "error": (
            f"Possible dummy/scam page (confidence: {scam_analysis['confidence']})"
            if scam_analysis["is_scam"] else None
        ),
        "scam_analysis": scam_analysis,
    }


def check_all_urls_parallel(urls: list, expected_name: str = "", expected_issuer: str = "") -> list:
    if not urls:
        return []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        futures = [ex.submit(check_url_valid, url, expected_name, expected_issuer) for url in urls]
        return [f.result() for f in futures]


def extract_urls_from_groq_text(raw_text: str, groq_urls: list) -> list:
    urls = list(groq_urls)
    patterns = [
        r"https?://[^\s,\"'<>\)]+",
        r"ude\.my/UC-[\w-]+",
        r"coursera\.org/verify/[\w]+",
        r"verify\.mygreatlearning\.com/[\w]+",
        r"credly\.com/(?:go|badges)/[\w-]+",
    ]
    for pattern in patterns:
        for m in re.findall(pattern, raw_text):
            full = m if m.startswith("http") else f"https://{m}"
            urls.append(full)
    seen, unique = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            unique.append(u)
    return unique


# ============================================================
# UDEMY LOCAL DATABASE VERIFICATION
# ============================================================

UDEMY_DB_PATH = BASE_DIR / "udemy_certificates.db"

# Regex to pull a UC-xxxx style Udemy cert ID from any string
UDEMY_CERT_ID_RE = re.compile(r"UC-[0-9a-fA-F\-]{35,45}", re.IGNORECASE)

def is_udemy_certificate(cert_info: dict) -> bool:
    """Return True if the certificate is from Udemy."""
    issuer = (cert_info.get("issuer") or "").lower()
    raw    = (cert_info.get("raw_text") or "").lower()
    return "udemy" in issuer or "udemy" in raw or "ude.my" in raw


def extract_udemy_cert_id(cert_info: dict) -> str | None:
    """
    Pull the UC-xxxx certificate number. Priority order:
      1. URLs list — most reliable (e.g. ude.my/UC-xxx or udemy.com/certificate/UC-xxx)
      2. raw_text regex — scans full OCR output
      3. cert_info['cert_id'] — last resort, vision OCR can misread long hex IDs
    Returns the canonicalised ID (lowercase hex, UC- prefix preserved).
    """
    def canonicalise(s: str) -> str:
        # Keep UC- prefix, lowercase the hex portion only
        if s.upper().startswith("UC-"):
            return "UC-" + s[3:].lower()
        return s.lower()

    all_candidates = []

    # Option 1: URLs are most reliable
    for url in cert_info.get("urls", []):
        m = UDEMY_CERT_ID_RE.search(url)
        if m:
            all_candidates.append(canonicalise(m.group(0)))

    # Option 2: raw OCR text (may contain multiple UC- ids — collect all)
    raw = cert_info.get("raw_text", "")
    for m in UDEMY_CERT_ID_RE.finditer(raw):
        all_candidates.append(canonicalise(m.group(0)))

    # Option 3: vision-parsed cert_id field
    cert_id = cert_info.get("cert_id", "")
    if cert_id and UDEMY_CERT_ID_RE.match(cert_id):
        all_candidates.append(canonicalise(cert_id))

    if not all_candidates:
        return None

    # If all candidates agree — great. If they differ, pick the one that appears most.
    from collections import Counter
    most_common, _ = Counter(all_candidates).most_common(1)[0]
    return most_common


def fuzzy_name_match(name_a: str, name_b: str, threshold: float = 0.6) -> bool:
    """
    Name matching using fuzzywuzzy partial_ratio if available,
    falling back to token-overlap. Handles OCR variations and middle-name differences.
    """
    if not name_a or not name_b:
        return False
    try:
        from fuzzywuzzy import fuzz
        return fuzz.partial_ratio(name_a.lower(), name_b.lower()) >= 80
    except ImportError:
        pass
    a_tokens = set(name_a.lower().split())
    b_tokens = set(name_b.lower().split())
    overlap = len(a_tokens & b_tokens)
    return overlap / min(len(a_tokens), len(b_tokens)) >= threshold


def fuzzy_course_match(course_a: str, course_b: str, threshold: float = 0.45) -> bool:
    """
    Course name matching using fuzzywuzzy partial_ratio if available,
    falling back to token-overlap. Strips year markers before comparing.
    """
    def clean(s):
        s = re.sub(r"[\[\(]\d{4}[\]\)]", "", s)   # strip [2022], (2023)
        s = re.sub(r"[^a-z0-9 ]", " ", s.lower())     # keep alphanumeric only
        return s.strip()

    ca, cb = clean(course_a), clean(course_b)
    if not ca or not cb:
        return False

    try:
        from fuzzywuzzy import fuzz
        return fuzz.partial_ratio(ca, cb) >= 70
    except ImportError:
        pass

    # Token-overlap fallback
    stops = {"the", "a", "an", "and", "or", "of", "in", "for", "to", "with", "from", "2021", "2022", "2023"}
    a_tokens = set(ca.split()) - stops
    b_tokens = set(cb.split()) - stops
    if not a_tokens or not b_tokens:
        return False
    overlap = len(a_tokens & b_tokens)
    return overlap / min(len(a_tokens), len(b_tokens)) >= threshold


def udemy_db_verify(cert_info: dict) -> dict:
    """
    Full Udemy local DB verification.
    Steps:
      1. Detect if it's a Udemy cert
      2. Extract certificate ID (UC-xxx)
      3. Look up in local SQLite DB by cert ID
      4. If found, cross-check name + course
      5. If not found by ID, fallback search by name + course
    Returns a structured result dict.
    """
    result = {
        "is_udemy": False,
        "cert_id_extracted": None,
        "db_record_found": False,
        "name_match": None,
        "course_match": None,
        "db_record": None,
        "verdict": "NOT_UDEMY",
        "reason": "Certificate does not appear to be from Udemy.",
    }

    if not is_udemy_certificate(cert_info):
        return result

    result["is_udemy"] = True

    if not UDEMY_DB_PATH.exists():
        result["verdict"] = "DB_UNAVAILABLE"
        result["reason"] = "Udemy local database file not found."
        return result

    cert_id = extract_udemy_cert_id(cert_info)
    result["cert_id_extracted"] = cert_id

    conn = sqlite3.connect(str(UDEMY_DB_PATH))
    conn.row_factory = sqlite3.Row

    try:
        cur = conn.cursor()
        db_row = None

        # ---- Primary lookup: by certificate_number (case-insensitive hex) ----
        if cert_id:
            cur.execute(
                "SELECT * FROM udemy_certificates WHERE LOWER(certificate_number) = LOWER(?)",
                (cert_id,)
            )
            db_row = cur.fetchone()

        # ---- Fallback: search by name if cert_id not found / not extracted ----
        if db_row is None and cert_info.get("name"):
            name_tokens = cert_info["name"].lower().split()
            # Use LIKE with first + last token for a reasonable filter
            for token in name_tokens:
                if len(token) > 3:
                    cur.execute(
                        "SELECT * FROM udemy_certificates WHERE student_name LIKE ? COLLATE NOCASE",
                        (f"%{token}%",)
                    )
                    candidates = cur.fetchall()
                    for candidate in candidates:
                        if fuzzy_name_match(cert_info["name"], candidate["student_name"]):
                            db_row = candidate
                            break
                if db_row:
                    break

        if db_row is None:
            result["db_record_found"] = False
            result["verdict"] = "NOT_IN_DB"
            result["reason"] = (
                f"Certificate ID '{cert_id}' not found in Udemy database. "
                "This may be a fabricated certificate or an ID not in our local DB."
            )
            return result

        # ---- Record found — now cross-check fields ----
        db_dict = dict(db_row)
        result["db_record_found"] = True
        result["db_record"] = {
            "certificate_number": db_dict.get("certificate_number"),
            "student_name":       db_dict.get("student_name"),
            "course_name":        db_dict.get("course_name"),
            "issue_date":         db_dict.get("issue_date"),
            "instructor_name":    db_dict.get("instructor_name"),
            "course_duration":    db_dict.get("course_duration"),
        }

        name_ok   = fuzzy_name_match(cert_info.get("name", ""),   db_dict.get("student_name", ""))
        course_ok = fuzzy_course_match(cert_info.get("course", ""), db_dict.get("course_name", ""))

        result["name_match"]   = name_ok
        result["course_match"] = course_ok

        if name_ok and course_ok:
            result["verdict"] = "VERIFIED"
            result["reason"]  = (
                f"Certificate ID found in Udemy database. "
                f"Name '{db_dict['student_name']}' and course '{db_dict['course_name']}' match."
            )
        elif name_ok and not course_ok:
            result["verdict"] = "SUSPICIOUS"
            result["reason"]  = (
                f"Certificate ID exists in DB under name '{db_dict['student_name']}' "
                f"but the course on the certificate ('{cert_info.get('course')}') "
                f"does not match DB record ('{db_dict['course_name']}'). Possible tampered course name."
            )
        elif not name_ok and course_ok:
            result["verdict"] = "SUSPICIOUS"
            result["reason"]  = (
                f"Certificate ID exists in DB for course '{db_dict['course_name']}' "
                f"but the name on the certificate ('{cert_info.get('name')}') "
                f"does not match DB record ('{db_dict['student_name']}'). Possible stolen certificate ID."
            )
        else:
            result["verdict"] = "SUSPICIOUS"
            result["reason"]  = (
                f"Certificate ID found in DB but neither name nor course match. "
                f"DB has: '{db_dict['student_name']}' / '{db_dict['course_name']}'. "
                f"Certificate claims: '{cert_info.get('name')}' / '{cert_info.get('course')}'."
            )

    finally:
        conn.close()

    return result


# ============================================================
# ROUTES
# ============================================================

@app.get("/")
def root():
    return {
        "status": "DocGuard API running", "version": "4.0.0",
        "improvements": [
            "URL format validation before any HTTP request",
            "Proper SSL fallback (two separate sessions, not same session retry)",
            "Scam/dummy page detection via content analysis",
            "Person verification via Claude API + real web_search tool",
            "Domain trust check against known certificate issuers",
            "Name/issuer presence check on certificate pages",
        ]
    }


@app.get("/health")
def health():
    return {
        "cnn_model": "loaded" if get_cnn_model() else "unavailable",
        "groq": "configured" if GROQ_API_KEY else "missing",
        "person_verify": "DuckDuckGo + Groq (no extra key needed)",
    }


@app.post("/api/analyze/cnn")
async def analyze_cnn(file: UploadFile = File(...)):
    model = get_cnn_model()
    if not model:
        raise HTTPException(status_code=503, detail="CNN model not loaded.")
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        import torch
        import torch.nn.functional as F
        from torchvision import transforms
        from PIL import Image as PILImage
        img = PILImage.open(tmp_path).convert("RGB")
        transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        tensor = transform(img).unsqueeze(0)
        with torch.no_grad():
            output = model.model(tensor)
            probs = F.softmax(output, dim=1)[0]
            pred = torch.argmax(probs).item()
            confidence = float(probs[pred]) * 100
        label = "Authentic" if pred == 0 else "Tampered"
        return {
            "prediction": label, "confidence": round(confidence, 1),
            "authentic_prob": round(float(probs[0]) * 100, 1),
            "tampered_prob": round(float(probs[1]) * 100, 1),
        }
    finally:
        try: os.unlink(tmp_path)
        except: pass


@app.post("/api/analyze/links")
async def analyze_links(file: UploadFile = File(...)):
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not set in .env")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        # Stage 1: Extract certificate fields via Groq Vision
        cert_info = groq_vision_extract(tmp_path)

        # Stage 2: URL format check + HTTP check + scam detection (parallel)
        all_urls = extract_urls_from_groq_text(cert_info["raw_text"], cert_info["urls"])
        url_results = check_all_urls_parallel(
            all_urls,
            expected_name=cert_info.get("name", ""),
            expected_issuer=cert_info.get("issuer", ""),
        )

        valid_count   = sum(1 for r in url_results if r.get("valid") is True)
        invalid_count = sum(1 for r in url_results if r.get("valid") is False)
        blocked_count = sum(1 for r in url_results if r.get("valid") is None)
        scam_count    = sum(1 for r in url_results if r.get("scam_analysis") and r["scam_analysis"].get("is_scam"))

        if url_results:
            if scam_count > 0:
                url_status = "SCAM_PAGE_DETECTED"
            elif invalid_count > 0 and valid_count == 0:
                url_status = "INVALID"
            elif valid_count > 0:
                url_status = "VALID"
            else:
                url_status = "BLOCKED_OR_UNKNOWN"
        else:
            url_status = "NO_URLS_FOUND"

        # Stage 3: Udemy local DB verification (runs only if Udemy cert detected)
        udemy_check = udemy_db_verify(cert_info)

        # Stage 4: Person/issuer verification via Claude API + web search
        # Skip if Udemy DB already gave a definitive VERIFIED or SUSPICIOUS verdict
        person_check = {
            "issuer_legit": "UNKNOWN", "course_exists": "UNKNOWN",
            "person_found": "UNKNOWN", "verdict": "UNVERIFIABLE",
            "reason": "Name or issuer not extracted from certificate",
        }
        skip_ai_verify = udemy_check["is_udemy"] and udemy_check["verdict"] in ("VERIFIED", "SUSPICIOUS", "NOT_IN_DB")
        if not skip_ai_verify and cert_info["name"] and cert_info["issuer"]:
            person_check = groq_person_verify(
                cert_info["name"], cert_info["course"], cert_info["issuer"]
            )

        # ---- Final verdict (priority order) ----
        # 1. Udemy DB is definitive when available
        if udemy_check["is_udemy"]:
            if udemy_check["verdict"] == "SUSPICIOUS":
                final_verdict = "SUSPICIOUS"
                final_reason  = udemy_check["reason"]
            elif udemy_check["verdict"] == "NOT_IN_DB":
                final_verdict = "SUSPICIOUS"
                final_reason  = udemy_check["reason"]
            elif udemy_check["verdict"] == "VERIFIED":
                # Even a verified DB hit is downgraded if URL or scam checks fail
                if url_status == "SCAM_PAGE_DETECTED":
                    final_verdict = "SUSPICIOUS"
                    final_reason  = "Udemy DB verified but certificate URL appears to be a scam page."
                elif url_status == "INVALID":
                    final_verdict = "SUSPICIOUS"
                    final_reason  = "Udemy DB verified but certificate URL is unreachable."
                else:
                    final_verdict = "LIKELY_AUTHENTIC"
                    final_reason  = udemy_check["reason"]
            else:
                final_verdict = "UNVERIFIABLE"
                final_reason  = udemy_check.get("reason", "Udemy DB check inconclusive.")
        # 2. Non-Udemy certs use URL + AI person check
        elif url_status == "SCAM_PAGE_DETECTED":
            final_verdict = "SUSPICIOUS"
            final_reason  = "One or more certificate URLs appear to be dummy/scam pages."
        elif url_status == "INVALID":
            final_verdict = "SUSPICIOUS"
            final_reason  = "Certificate URL(s) are unreachable or return invalid pages."
        elif person_check["verdict"] == "SUSPICIOUS":
            final_verdict = "SUSPICIOUS"
            final_reason  = person_check["reason"]
        elif url_status == "VALID" and person_check["verdict"] == "LIKELY_AUTHENTIC":
            final_verdict = "LIKELY_AUTHENTIC"
            final_reason  = "URLs valid, page content genuine, issuer/course/person appear legitimate."
        else:
            final_verdict = "UNVERIFIABLE"
            final_reason  = "Could not fully verify — manual check recommended."

        return {
            "certificate": {
                "name": cert_info["name"], "course": cert_info["course"],
                "date": cert_info["date"], "cert_id": cert_info["cert_id"],
                "issuer": cert_info["issuer"],
            },
            "url_verification": {
                "urls_found": len(url_results), "url_status": url_status,
                "valid_count": valid_count, "invalid_count": invalid_count,
                "blocked_count": blocked_count, "scam_count": scam_count,
                "details": url_results,
            },
            # Udemy-specific DB lookup (only populated for Udemy certs)
            "udemy_db_verification": udemy_check if udemy_check["is_udemy"] else None,
            "person_verification": {
                "issuer_legitimate": person_check.get("issuer_legit", "UNKNOWN"),
                "course_exists":     person_check.get("course_exists", "UNKNOWN"),
                "person_found":      person_check.get("person_found", "UNKNOWN"),
                "verdict":           person_check["verdict"],
                "reason":            person_check["reason"],
                "powered_by": "DuckDuckGo search + Groq analysis",
                "skipped": skip_ai_verify,
            },
            "final_verdict": final_verdict,
            "final_reason":  final_reason,
        }

    finally:
        try: os.unlink(tmp_path)
        except: pass


# ============================================================
# UDEMY STANDALONE ENDPOINT
# ============================================================

@app.post("/api/analyze/udemy")
async def analyze_udemy(file: UploadFile = File(...)):
    """
    Dedicated Udemy DB verification endpoint.
    Extracts certificate fields via Groq Vision, then queries
    the local SQLite DB — no AI person-verify needed.
    """
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not set in .env")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        cert_info    = groq_vision_extract(tmp_path)
        udemy_result = udemy_db_verify(cert_info)

        if not udemy_result["is_udemy"]:
            return {
                "verified": False,
                "db_verified": False,
                "verdict": "NOT_UDEMY",
                "message": "This certificate does not appear to be from Udemy.",
                "certificate": {
                    "name":    cert_info.get("name"),
                    "course":  cert_info.get("course"),
                    "cert_id": cert_info.get("cert_id"),
                    "issuer":  cert_info.get("issuer"),
                },
                "data": {},
            }

        verified  = udemy_result["verdict"] == "VERIFIED"
        db_record = udemy_result.get("db_record") or {}

        return {
            "verified":          verified,
            "db_verified":       verified,
            "verdict":           udemy_result["verdict"],
            "message":           udemy_result["reason"],
            "cert_id_extracted": udemy_result.get("cert_id_extracted"),
            "name_match":        udemy_result.get("name_match"),
            "course_match":      udemy_result.get("course_match"),
            "certificate": {
                "name":    cert_info.get("name"),
                "course":  cert_info.get("course"),
                "cert_id": cert_info.get("cert_id"),
                "issuer":  cert_info.get("issuer"),
            },
            "data": db_record,
        }
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# ============================================================
# QR ISSUER VERIFICATION ENDPOINT  (replaces separate issuer_api.py)
# ============================================================

import csv as _csv

def _load_cert_db() -> dict:
    """Load qr_module/certificates_db.csv into a dict keyed by cert_id."""
    db_path = BASE_DIR / "qr_module" / "certificates_db.csv"
    records: dict = {}
    try:
        with open(db_path, newline="", encoding="utf-8") as f:
            for row in _csv.DictReader(f):
                records[row["cert_id"].strip()] = row
    except Exception as e:
        print(f"[QR DB] Could not load certificates_db.csv: {e}")
    return records

_CERT_DB: dict = _load_cert_db()


@app.get("/api/verify")
def verify_certificate(cert_id: str):
    """
    Issuer verification endpoint consumed by the QR module.
    Previously lived in qr_module/issuer_api.py as a separate FastAPI server;
    now mounted on the main app so it is always reachable on the same port.
    """
    record = _CERT_DB.get(cert_id.strip())
    if not record:
        return {
            "issuer":  "DocGuard Authority",
            "cert_id": cert_id,
            "status":  "not_found",
        }
    return {
        "issuer":  "DocGuard Authority",
        "cert_id": record["cert_id"],
        "name":    record.get("name", ""),
        "course":  record.get("course", ""),
        "status":  record.get("status", "not_found"),
    }


@app.post("/api/analyze/qr")
async def analyze_qr(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        ocr_data  = extract_certificate_data(tmp_path)
        qr_result = verify_qr_api(tmp_path)
        verdict = comparison = None
        if ocr_data.get("error") and not ocr_data.get("cert_id"):
            verdict = "OCR_UNAVAILABLE"
        elif not qr_result.get("verified"):
            verdict = "QR_NOT_VALID"
        elif qr_result.get("status") in ["revoked", "not_found"]:
            verdict = f"CERTIFICATE_{qr_result.get('status','').upper()}"
        elif not all(ocr_data.get(k) for k in ["cert_id", "name", "course"]):
            verdict = "OCR_FAILED"
        else:
            comparison = match_json(ocr_data, qr_result)
            verdict = "ORIGINAL" if comparison["match"] else "TAMPERED"
        return {"verdict": verdict, "qr_result": qr_result, "ocr_data": ocr_data, "comparison": comparison}
    finally:
        try: os.unlink(tmp_path)
        except: pass


if __name__ == "__main__":
    print("DocGuard API v4.0 → http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)