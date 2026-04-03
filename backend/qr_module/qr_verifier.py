import re
import csv
import cv2
from pathlib import Path
from urllib.parse import urlparse, parse_qs

# ── In-process cert DB (no HTTP self-call = no deadlock) ─────────────────────
_DB_PATH = Path(__file__).parent / "certificates_db.csv"

def _load_db() -> dict:
    records: dict = {}
    try:
        with open(_DB_PATH, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                records[row["cert_id"].strip()] = row
    except Exception as e:
        print(f"[QR] Could not load certificates_db.csv: {e}")
    return records

_CERT_DB: dict = _load_db()

VALID_STATUS = ["valid", "revoked", "not_found"]

# Patterns to pull cert_id out of any QR payload
_ID_PATTERNS = [
    re.compile(r"cert_id=([A-Za-z0-9_\-]+)"),  # ?cert_id=ABC123
    re.compile(r"/verify/([A-Za-z0-9_\-]+)"),   # /verify/ABC123
    re.compile(r"/([A-Za-z0-9]{4,})$"),          # last path segment
]


def extract_qr(image_path: str) -> str | None:
    img = cv2.imread(image_path)
    detector = cv2.QRCodeDetector()
    data, _, _ = detector.detectAndDecode(img)
    return data if data else None


def _extract_cert_id(qr_payload: str) -> str | None:
    """Extract cert_id from a QR payload (URL or raw ID)."""
    # If it looks like a plain ID already (no slashes, no spaces)
    if re.fullmatch(r"[A-Za-z0-9_\-]{3,}", qr_payload.strip()):
        return qr_payload.strip()
    # Try query string first
    parsed = urlparse(qr_payload)
    qs = parse_qs(parsed.query)
    if "cert_id" in qs:
        return qs["cert_id"][0]
    # Pattern matching
    for pat in _ID_PATTERNS:
        m = pat.search(qr_payload)
        if m:
            return m.group(1)
    return None


def _lookup_cert(cert_id: str) -> dict:
    """Look up cert_id directly in the in-memory CSV dict."""
    record = _CERT_DB.get(cert_id.strip())
    if not record:
        return {"issuer": "DocGuard Authority", "cert_id": cert_id, "status": "not_found"}
    return {
        "issuer":  "DocGuard Authority",
        "cert_id": record["cert_id"],
        "name":    record.get("name", ""),
        "course":  record.get("course", ""),
        "status":  record.get("status", "not_found"),
    }


def verify_qr_api(image_path: str) -> dict:
    result = {
        "qr_url":   None,
        "domain":   None,
        "verified": False,
        "issuer":   None,
        "cert_id":  None,
        "status":   None,
        "error":    None,
    }

    qr_payload = extract_qr(image_path)
    if not qr_payload:
        result["error"] = "No QR code detected"
        return result

    result["qr_url"] = qr_payload
    result["domain"] = urlparse(qr_payload).hostname or "local"

    cert_id = _extract_cert_id(qr_payload)
    if not cert_id:
        result["error"] = f"Could not extract cert_id from QR payload: {qr_payload[:80]}"
        return result

    data = _lookup_cert(cert_id)

    if data["status"] not in VALID_STATUS:
        result["error"] = f"Unexpected status value: {data['status']}"
        return result

    result["verified"] = True
    result["issuer"]   = data["issuer"]
    result["cert_id"]  = data["cert_id"]
    result["status"]   = data["status"]

    return result