# 🚀 Usage
```bash 
docker compose up --build 
```

This will start:
- Postgres → localhost:5432
- Backend → http://localhost:8000
- Agent → running inside container, auto-registers and pushes metrics

## Application Architecture

This diagram illustrates the complete data flow of the Server Metrics application, from user authentication to real-time metric updates via WebSockets.

```mermaid
sequenceDiagram
    participant User
    participant React Dashboard
    participant FastAPI Backend
    participant Cloud SQL DB
    participant Metrics Agent

    %% --- 1. Authentication Flow ---
    box rgb(235, 245, 255) Authentication
        User->>React Dashboard: Accesses website
        React Dashboard->>User: Displays Login Page
        User->>React Dashboard: Submits credentials (user/pass)
        React Dashboard->>FastAPI Backend: POST /token with credentials
        FastAPI Backend->>Cloud SQL DB: Query: Verify user and get hashed password
        Cloud SQL DB-->>FastAPI Backend: Returns user record
        FastAPI Backend->>FastAPI Backend: Verifies password
        FastAPI Backend-->>React Dashboard: Returns JWT (Access Token)
        React Dashboard->>React Dashboard: Stores JWT securely
    end

    %% --- 2. Dashboard Load and WebSocket Connection ---
    box rgb(230, 255, 230) Dashboard Initialization
        React Dashboard->>FastAPI Backend: GET /api/servers (with Bearer JWT)
        FastAPI Backend->>FastAPI Backend: Verifies JWT
        FastAPI Backend->>Cloud SQL DB: Query: Fetch initial server data
        Cloud SQL DB-->>FastAPI Backend: Returns data
        FastAPI Backend-->>React Dashboard: Sends initial data
        React Dashboard->>User: Renders dashboard with initial data

        React Dashboard->>FastAPI Backend: Establishes WebSocket connection (/ws)
        note right of FastAPI Backend: Backend authenticates WS connection (e.g., via token in query) and adds client to active connections list.
        FastAPI Backend-->>React Dashboard: WebSocket connection accepted
    end

    %% --- 3. Agent Metrics and Real-time Update ---
    box rgb(255, 245, 230) Real-time Metrics Flow
        loop Every X seconds
            Metrics Agent->>Metrics Agent: Collects server metrics (CPU, RAM, etc.)
            Metrics Agent->>FastAPI Backend: POST /api/metrics (with API Key/Auth)
            FastAPI Backend->>FastAPI Backend: Authenticates Agent
            FastAPI Backend->>Cloud SQL DB: INSERT new metrics into database
            Cloud SQL DB-->>FastAPI Backend: Confirms write
            note right of FastAPI Backend: Backend finds the relevant client(s) watching this server.
            FastAPI Backend-->>React Dashboard: Pushes new metrics data via WebSocket
            React Dashboard->>User: Updates charts and UI in real-time
        end
    end
```