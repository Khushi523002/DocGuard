import cv2
import pytesseract
import os
import re

# --- STEP 1: SAFE PATH SETUP ---
# r"" use karna zaroori hai Windows ke liye
tesseract_exe = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

if os.path.exists(tesseract_exe):
    pytesseract.pytesseract.tesseract_cmd = tesseract_exe
else:
    # Agar ye print hua, matlab installation folder galat hai
    print(f"❌ ERROR: Tesseract not found at {tesseract_exe}")

def clean_text(text):
    return re.sub(r"\s+", " ", text).strip()

def find_field(patterns, text):
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            return match.group(1).strip()
    return None

def extract_certificate_data(image_path):
    img = cv2.imread(image_path)
    if img is None:
        return {"error": "Image not found or invalid path"}

    # OCR accuracy badhane ke liye grayscale + thresholding
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Optional: Noise reduce karne ke liye
    # gray = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

    raw_text = pytesseract.image_to_string(gray)
    text = clean_text(raw_text)

    # Patterns
    cert_id = find_field([r"cert\s*id\s*[:\-]\s*([A-Z0-9]+)", r"id\s*[:\-]\s*([A-Z0-9]+)"], text)
    name = find_field([r"name\s*[:\-]\s*([A-Za-z ]+)"], text)
    course = find_field([r"course\s*[:\-]\s*([A-Za-z ]+)", r"program\s*[:\-]\s*([A-Za-z ]+)"], text)

    return {
        "cert_id": cert_id,
        "name": name,
        "course": course,
        "raw_extracted": text # Testing ke liye raw text bhi dekh lena
    }