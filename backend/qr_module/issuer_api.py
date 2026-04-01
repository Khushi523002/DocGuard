from fastapi import FastAPI
import pandas as pd

app = FastAPI()

db = pd.read_csv("certificates_db.csv")

@app.get("/api/verify")
def verify_certificate(cert_id: str):
    record = db[db["cert_id"] == cert_id]

    if record.empty:
        return {
            "issuer": "DocGuard Authority",
            "status": "not_found"
        }

    row = record.iloc[0]
    return {
        "issuer": "DocGuard Authority",
        "cert_id": row["cert_id"],
        "name": row["name"],
        "course": row["course"],
        "status": row["status"]
    }