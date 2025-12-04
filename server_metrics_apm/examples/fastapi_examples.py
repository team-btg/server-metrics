import os
import time
from uuid import UUID
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from typing import Optional, List, Dict, Any
import uvicorn

# Import your APM library components
from server_metrics_apm import init_apm, trace_function, trace_http_request

# --- Configuration ---
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# Retrieve APM configuration from environment variables
APM_BACKEND_URL = os.getenv("APM_BACKEND_URL")
APM_SERVER_ID_STR = os.getenv("APM_SERVER_ID")
APM_AUTH_TOKEN = os.getenv("APM_AUTH_TOKEN")

# Validate configuration
if not all([APM_BACKEND_URL, APM_SERVER_ID_STR, APM_AUTH_TOKEN]):
    print("WARNING: APM environment variables (APM_BACKEND_URL, APM_SERVER_ID, APM_AUTH_TOKEN) are not fully set.")
    print("         APM tracing will be disabled. Please check your .env file in server-metrics-py-apm/.")
    APM_ENABLED = False
    APM_SERVER_ID = None
else:
    APM_ENABLED = True
    try:
        APM_SERVER_ID = UUID(APM_SERVER_ID_STR)
    except ValueError:
        print(f"ERROR: Invalid APM_SERVER_ID format: {APM_SERVER_ID_STR}. APM tracing disabled.")
        APM_ENABLED = False
        APM_SERVER_ID = None


# --- FastAPI Application ---
app = FastAPI(title="Example App with Server Metrics APM")

# Initialize APM client (run once at application startup)
if APM_ENABLED and APM_SERVER_ID:
    init_apm(APM_BACKEND_URL, APM_SERVER_ID, APM_AUTH_TOKEN)
else:
    print("APM not initialized due to missing or invalid configuration.")


# --- Helper function that simulates work ---
@trace_function(name="process_data_sync", span_type="internal")
def _process_data_synchronously(data: str):
    """Simulates some synchronous data processing."""
    time.sleep(0.05) # Simulate work
    if "error" in data.lower():
        raise ValueError("Simulated processing error")
    return f"Processed: {data}"

@trace_function(name="fetch_external_resource", span_type="external")
async def _fetch_external_resource(resource_id: int):
    """Simulates fetching an external resource asynchronously."""
    await asyncio.sleep(0.03) # Simulate network call
    return {"id": resource_id, "data": "some_external_data"}


# --- FastAPI Endpoints with Tracing ---

@app.get("/")
@trace_http_request(name="GET /", attributes={"http.route": "/"})
async def read_root(request: Request):
    """A simple root endpoint with HTTP tracing."""
    return {"message": "Welcome to the APM example app!"}

@app.get("/items/{item_id}")
@trace_http_request(name="GET /items/{item_id}", attributes={"http.route": "/items/{item_id}"})
async def read_item(request: Request, item_id: int):
    """An endpoint that simulates internal processing and external calls."""
    # Simulate an internal synchronous operation
    processed_sync_data = _process_data_synchronously(f"item_{item_id}")

    # Simulate an external asynchronous operation
    external_data = await _fetch_external_resource(item_id)

    return {
        "item_id": item_id,
        "processed_sync": processed_sync_data,
        "external_data": external_data
    }

@app.post("/data")
@trace_http_request(name="POST /data", attributes={"http.route": "/data"})
async def create_data(request: Request, payload: Dict[str, Any]):
    """An endpoint that can trigger a simulated error."""
    try:
        result = _process_data_synchronously(payload.get("value", "default"))
        return {"status": "success", "result": result}
    except ValueError as e:
        return {"status": "error", "message": str(e)}, 500


# --- Run the application ---
if __name__ == "__main__":
    # Ensure asyncio is imported if not already, for async functions in example
    try:
        import asyncio
    except ImportError:
        print("Asyncio not found, please ensure you are in a Python 3.7+ environment.")
        exit(1)

    uvicorn.run(app, host="0.0.0.0", port=8001)
