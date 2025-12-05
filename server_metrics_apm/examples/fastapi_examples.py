import os
import time
from uuid import UUID
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from typing import Dict, Any, Optional
from starlette.middleware import Middleware 
import uvicorn
import asyncio 

from server_metrics_apm import init_apm, trace_function, APMMiddleware, APMClient # <-- Import APMClient

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
  
middleware_list = []
initialized_apm_client: Optional[APMClient] = None # Hold the initialized client

if APM_ENABLED and APM_SERVER_ID:
    initialized_apm_client = init_apm(APM_BACKEND_URL, APM_SERVER_ID, APM_AUTH_TOKEN)
    # --- FIX: Remove apm_client_instance argument ---
    middleware_list.append(Middleware(APMMiddleware)) 
else:
    print("APM not initialized due to missing or invalid configuration.")

app = FastAPI(title="Example App with Server Metrics APM", middleware=middleware_list)
 
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
 
@app.get("/")
async def read_root(request: Request):
    """A simple root endpoint with middleware handling HTTP tracing."""
    return {"message": "Welcome to the APM example app!"}

@app.get("/items/{item_id}")
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
async def create_data(request: Request, payload: Dict[str, Any]):
    """An endpoint that can trigger a simulated error."""
    try:
        result = _process_data_synchronously(payload.get("value", "default"))
        return {"status": "success", "result": result}
    except ValueError as e: 
        raise # Re-raise to let FastAPI handle it normally
 
# --- Run the application ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
