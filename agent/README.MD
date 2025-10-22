
# 📘 `agent/README.md`
 
# Server Monitor - Agent (Python)

This is the agent that runs on each monitored server.  
It does:
- Generates a unique keypair & server fingerprint
- Registers with backend
- Collects CPU + memory usage
- Pushes metrics periodically

---

## 🚀 Getting Started

### 1. Clone repository and enter agent
```bash
git clone <your-repo-url>
cd server-monitor/agent
```

### 2. Create virtual environment
```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate 
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Configure backend URL
Edit agent.py and set:
```bash
BACKEND_URL = "http://localhost:8000/api/v1"
```

### 5. Run the agent
```bash
python agent.py
```