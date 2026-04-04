import cv2
import pytesseract
import os
import re

# Tesseract path (Windows)
tesseract_exe = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if os.path.exists(tesseract_exe):
    pytesseract.pytesseract.tesseract_cmd = tesseract_exe


def clean_text(text):
    return re.sub(r"\s+", " ", text).strip()


# Stop-words: field labels that mark the END of the previous field's value
_STOP = r"(?:course|certificate\s*id|cert\s*id|name|program|issuer|date|id)\b"


def find_field(patterns, text):
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            val = match.group(1).strip()
            # Truncate at the next field label so we don't bleed into adjacent lines
            stop = re.search(_STOP, val, re.I)
            if stop:
                val = val[:stop.start()].strip()
            # Drop trailing punctuation / noise
            val = re.sub(r"[:\-]+$", "", val).strip()
            return val if val else None
    return None


def extract_certificate_data(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return {"error": "Image not found or invalid path"}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    raw_text = pytesseract.image_to_string(gray)
    text = clean_text(raw_text)

    # cert_id: strict alphanumeric after "Certificate ID:" or "Cert ID:" or "ID:"
    cert_id = find_field([
        r"certificate\s*id\s*[:\-]\s*([A-Z0-9]+)",
        r"cert\s*id\s*[:\-]\s*([A-Z0-9]+)",
        r"\bid\s*[:\-]\s*([A-Z0-9]{3,})",
    ], text)

    # name: stop before next label (course / certificate id / id)
    name = find_field([
        r"name\s*[:\-]\s*([A-Za-z][A-Za-z\s]{1,60}?)(?=\s*(?:course|certificate\s*id|cert\s*id|\bid\b|$))",
        r"name\s*[:\-]\s*([A-Za-z ]+)",
    ], text)

    # course: stop before next label (certificate id / id / name)
    course = find_field([
        r"course\s*[:\-]\s*([A-Za-z][A-Za-z\s]{1,80}?)(?=\s*(?:certificate\s*id|cert\s*id|\bid\b|name|$))",
        r"course\s*[:\-]\s*([A-Za-z ]+)",
        r"program\s*[:\-]\s*([A-Za-z ]+)",
    ], text)

    return {
        "cert_id": cert_id,
        "name": name,
        "course": course,
        "raw_extracted": text,
    }