import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import re
import time
from fuzzywuzzy import fuzz


# ------------------ CONFIG ------------------
HEADERS = {
    "User-Agent": "Mozilla/5.0"
}


# ------------------ UTILS ------------------
def fuzzy_match(name, text, threshold=80):
    return fuzz.partial_ratio(name.lower(), text.lower()) >= threshold


def get_page(url):
    for _ in range(3):  # retry
        try:
            response = requests.get(url, headers=HEADERS, timeout=20)
            if response.status_code == 200:
                return response
        except:
            time.sleep(2)
    return None


# ------------------ VALIDATION ------------------
def is_valid_coursera_url(url):
    parsed = urlparse(url)
    return parsed.netloc in ["coursera.org", "www.coursera.org"]


def extract_cert_id(url):
    match = re.search(r'/verify/([A-Z0-9]+)', url)
    return match.group(1) if match else None


# ------------------ CORE LOGIC ------------------
def verify_coursera(url, expected_name):
    result = {
        "platform": "coursera",
        "status": "not_verified",
        "confidence": 0.0,
        "method": None
    }

    try:
        # 1️⃣ Domain check
        if not is_valid_coursera_url(url):
            return {"status": "invalid", "message": "Invalid Coursera URL"}

        # 2️⃣ Certificate ID check
        cert_id = extract_cert_id(url)
        if not cert_id:
            return {"status": "invalid", "message": "Invalid certificate ID"}

        # 3️⃣ Fetch page
        response = get_page(url)
        if not response:
            return {"status": "error", "message": "Failed to fetch page"}

        soup = BeautifulSoup(response.content, "html.parser")

        # 4️⃣ Extract ALT text (internally only)
        alt_text = ""
        for img in soup.find_all("img"):
            alt = img.get("alt", "")
            if "certificate" in alt.lower():
                alt_text = alt
                break

        # 5️⃣ Verify
        if alt_text and fuzzy_match(expected_name, alt_text):
            result["status"] = "verified"
            result["confidence"] = 0.9
            result["method"] = "alt_text"

        return result

    except Exception as e:
        return {"status": "error", "message": str(e)}


# ------------------ TEST ------------------
if __name__ == "__main__":
    url = "https://coursera.org/verify/PE8E6UUM8EZL"
    name = "CANDIDA RUTH NORONHA"

    print(verify_coursera(url, name))