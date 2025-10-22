# Server Monitor - Backend (FastAPI + Postgres)

This is the backend API for the Server Monitor project.  
It handles:
- Server registration
- Metrics ingestion
- Persistence into Postgres

---

## 🚀 Getting Started

### 1. Clone repository and enter backend
```bash
git clone <your-repo-url>
cd server-monitor/backend
```

### 2. Create virtual environment
```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run Postgres (Docker)
```bash
docker run --name monitor-db \
  -e POSTGRES_USER=monitor \
  -e POSTGRES_PASSWORD=monitor \
  -e POSTGRES_DB=monitor \
  -p 5432:5432 -d postgres:16
```

### 5. Run Backend
```bash
uvicorn backend.main:app --reload --port 8000
```