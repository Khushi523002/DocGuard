import cv2
import requests
from urllib.parse import urlparse


def extract_qr(image_path):
    img = cv2.imread(image_path)
    detector = cv2.QRCodeDetector()
    data, _, _ = detector.detectAndDecode(img)
    return data if data else None


REQUIRED_FIELDS = ["issuer", "cert_id", "status"]
VALID_STATUS = ["valid", "revoked", "not_found"]


def verify_api_endpoint(url):
    try:
        r = requests.get(url, timeout=5)

        if "application/json" not in r.headers.get("Content-Type", ""):
            return False, "Response is not JSON"

        data = r.json()

        for field in REQUIRED_FIELDS:
            if field not in data:
                return False, f"Missing field: {field}"

        if data["status"] not in VALID_STATUS:
            return False, "Invalid status value"

        return True, data
    except Exception as e:
        return False, str(e)


def verify_qr_api(image_path):
    result = {
        "qr_url": None,
        "domain": None,
        "verified": False,
        "issuer": None,
        "cert_id": None,
        "status": None,
        "error": None
    }

    qr_url = extract_qr(image_path)
    if not qr_url:
        result["error"] = "No QR code detected"
        return result

    result["qr_url"] = qr_url
    result["domain"] = urlparse(qr_url).hostname

    ok, data = verify_api_endpoint(qr_url)

    if not ok:
        result["error"] = data
        return result

    result["verified"] = True
    result["issuer"] = data["issuer"]
    result["cert_id"] = data["cert_id"]
    result["status"] = data["status"]

    return result