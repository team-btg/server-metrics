import requests
from dotenv import load_dotenv
from typing import Dict, Any
from uuid import UUID
 
load_dotenv()

class APMClient:
    def __init__(self, backend_url: str, server_id: UUID, auth_token: str):
        self.backend_url = backend_url
        self.server_id = server_id
        self.auth_token = auth_token
        self.traces_endpoint = f"{self.backend_url}/api/v1/apm/traces"

    def send_trace(self, trace_data: Dict[str, Any]):
        """Sends a single trace (with its spans) to the backend."""
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.auth_token
        } 
        trace_data["server_id"] = str(self.server_id) 

        try: 
            params = {"server_id": str(self.server_id)}
            response = requests.post(self.traces_endpoint, headers=headers, params=params, json=trace_data, timeout=5)
            response.raise_for_status()
            print(f"APM Trace sent successfully. Status: {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"ERROR: Failed to send APM trace: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response Content: {e.response.text}")