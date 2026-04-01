from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from typing import List, Dict, Any
import uvicorn

app = FastAPI(title="Udemy Certificates API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class UdemyDatabase:
    def __init__(self, db_path="udemy_certificates.db"):
        self.db_path = db_path
    
    def get_all_certificates(self) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM udemy_certificates")
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results
    
    def get_certificate_by_number(self, certificate_number: str) -> Dict[str, Any]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM udemy_certificates WHERE certificate_number = ?", (certificate_number,))
        result = cursor.fetchone()
        conn.close()
        return dict(result) if result else None
    
    def search_certificates(self, student_name: str = None, course_name: str = None) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        query = "SELECT * FROM udemy_certificates WHERE 1=1"
        params = []
        
        if student_name:
            query += " AND student_name LIKE ?"
            params.append(f"%{student_name}%")
        if course_name:
            query += " AND course_name LIKE ?"
            params.append(f"%{course_name}%")
        
        cursor.execute(query, params)
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return results

db = UdemyDatabase()

@app.get("/")
async def root():
    return {"message": "Udemy Certificates API", "status": "active"}

@app.get("/certificates")
async def get_all_certificates():
    certificates = db.get_all_certificates()
    return {
        "status": "success",
        "count": len(certificates),
        "certificates": certificates
    }

@app.get("/certificates/{certificate_number}")
async def get_certificate(certificate_number: str):
    certificate = db.get_certificate_by_number(certificate_number)
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {"status": "success", "certificate": certificate}

@app.get("/search")
async def search_certificates(student_name: str = None, course_name: str = None):
    certificates = db.search_certificates(student_name, course_name)
    return {
        "status": "success",
        "count": len(certificates),
        "certificates": certificates
    }

@app.get("/stats")
async def get_stats():
    certificates = db.get_all_certificates()
    return {
        "status": "success",
        "total_certificates": len(certificates),
        "issuer": "Udemy"
    }

if __name__ == "__main__":
    print("Starting Udemy Certificates API server...")
    print("API available at: http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)