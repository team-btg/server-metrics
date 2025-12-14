from typing import Optional, List, Dict, Any
from uuid import UUID 
from .client import APMClient

_apm_client_instance: Optional[APMClient] = None
 
def init_apm(backend_url: str, server_id: UUID, auth_token: str) -> APMClient:
    """Initializes the APM client globally for the application."""
    global _apm_client_instance
    _apm_client_instance = APMClient(backend_url, server_id, auth_token)
    print(f"APM client initialized for server {server_id} reporting to {backend_url}")
    return _apm_client_instance
 
def get_apm_client() -> Optional[APMClient]:
    """Returns the globally initialized APMClient instance."""
    return _apm_client_instance

# --- Delayed Imports of Submodules (placed at the very end of __init__.py) ---
# This ensures __init__.py itself is fully loaded before trying to load submodules
# that might in turn try to re-import from __init__.py.

# Expose specific items from submodules for convenience when doing 'from server_metrics_apm import X'
from .instrument import trace_function, trace_http_request, trace_db_query
from .utils import generate_uuid
from .middleware import APMMiddleware

# Also expose context functions via the package
from .context import ( # Import all context functions from the context submodule
    get_current_trace_id, set_current_trace_id,
    get_current_span_id, set_current_span_id,
    get_span_stack, set_span_stack,
    reset_trace_context
)

__version__ = "0.1.0"