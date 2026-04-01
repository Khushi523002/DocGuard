# 🛡️ DocGuard — Certificate Verification System

## Tech Stack
- **Backend**: FastAPI + Groq AI (llama-4-scout vision + llama-3.3-70b text)
- **Frontend**: React + Vite
- **CNN Model**: EfficientNet-B0
- **Database**: SQLite (Udemy certificates)

---

## ⚙️ Setup

### 1. Get Groq API Key (Free)
Go to https://console.groq.com → Create API Key

### 2. Backend Setup
```bash
cd backend
# Add your Groq API key in .env file:
# GROQ_API_KEY=your_key_here

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## 🔍 How It Works

### Step 1 — CNN Analysis
EfficientNet-B0 model classifies certificate as Authentic or Tampered.

### Step 2 — Link & Identity Verification (Groq AI)
- **Groq Call 1**: Vision model extracts name, course, issuer, URLs from image
- **Parallel**: All URLs checked simultaneously (HTTP — no API call)
- **Groq Call 2**: Verifies issuer legitimacy + course existence
- **Total: exactly 2 Groq API calls** → no rate limit issues

### Step 3 — QR + OCR Match
Scans QR code → contacts issuer API → OCR extracts fields → fuzzy comparison.

---

## 📁 Project Structure
```
docguard/
├── backend/
│   ├── main.py              ← FastAPI app (Groq-powered)
│   ├── model.py             ← CNN model loader
│   ├── udemy_certificates.db ← Udemy local database (34 records)
│   ├── udemy_api.py         ← Udemy DB API helper
│   ├── .env                 ← Add GROQ_API_KEY here
│   ├── requirements.txt
│   └── qr_module/
│       ├── qr_verifier.py
│       ├── ocr_extractor.py
│       ├── json_matcher.py
│       └── certificates_db.csv
├── frontend/
│   └── src/
│       └── App.jsx          ← Complete React app (single file)
├── start_backend.bat        ← Windows
├── start_frontend.bat       ← Windows
├── start_backend.sh         ← Linux/Mac
└── start_frontend.sh        ← Linux/Mac
```

---

## ⚠️ Notes
- Add `efficientnet_b0_docguard.pth` to `backend/` folder (too large for zip)
- Tesseract OCR must be installed for Step 3: https://github.com/UB-Mannheim/tesseract/wiki
- SSL errors on Windows are handled automatically (verify=False session)
