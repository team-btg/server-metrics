import functools
import threading
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from .client import APMClient
from .utils import generate_uuid, now_ms
 
_thread_local = threading.local()
_thread_local.current_trace_id = None
_thread_local.current_span_id = None
_thread_local.span_stack = []  

_apm_client: Optional[APMClient] = None

def init_apm(backend_url: str, server_id: UUID, auth_token: str):
    """Initializes the APM client globally for the application."""
    global _apm_client
    _apm_client = APMClient(backend_url, server_id, auth_token)
    print(f"APM client initialized for server {server_id} reporting to {backend_url}")

def get_current_trace_id() -> Optional[UUID]:
    return getattr(_thread_local, 'current_trace_id', None)

def get_current_span_id() -> Optional[UUID]:
    return getattr(_thread_local, 'current_span_id', None)

def set_current_trace_id(trace_id: UUID):
    _thread_local.current_trace_id = trace_id

def set_current_span_id(span_id: UUID):
    _thread_local.current_span_id = span_id

def push_span_to_stack(span_data: Dict[str, Any]):
    """Adds a completed span to the thread-local stack for the current trace."""
    if not hasattr(_thread_local, 'span_stack'):
        _thread_local.span_stack = []
    _thread_local.span_stack.append(span_data)

def _reset_trace_context():
    """Resets the thread-local trace context."""
    _thread_local.current_trace_id = None
    _thread_local.current_span_id = None
    _thread_local.span_stack = []


def trace_function(name: str, span_type: str = "function", attributes: Optional[Dict[str, Any]] = None):
    """
    Decorator to trace the execution of a function.
    Automatically creates a new trace if one doesn't exist for the current thread.
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if _apm_client is None:
                return func(*args, **kwargs)

            trace_id = get_current_trace_id()
            is_root_trace = trace_id is None
            if is_root_trace:
                trace_id = generate_uuid()
                set_current_trace_id(trace_id)
                _reset_trace_context() # Clear any previous stack for a new trace

            parent_span_id = get_current_span_id()
            span_id = generate_uuid()
            set_current_span_id(span_id)

            start_time_ms = now_ms()
            start_dt = datetime.utcfromtimestamp(start_time_ms / 1000)

            result = None
            exception_happened = False
            try:
                result = func(*args, **kwargs)
            except Exception as e:
                exception_happened = True
                if attributes is None:
                    attributes = {}
                attributes["error"] = True
                attributes["error.message"] = str(e)
                raise
            finally:
                end_time_ms = now_ms()
                duration_ms = end_time_ms - start_time_ms

                span_data = {
                    "id": str(span_id),
                    "parent_id": str(parent_span_id) if parent_span_id else None,
                    "name": name,
                    "span_type": span_type,
                    "start_time": start_dt.isoformat(timespec='milliseconds') + 'Z',
                    "duration_ms": duration_ms,
                    "attributes": attributes if attributes else {}
                }
                push_span_to_stack(span_data)
                set_current_span_id(parent_span_id) # Restore parent span context

                if is_root_trace:
                    # This span is the root of the trace
                    trace_payload = {
                        "server_id": str(_apm_client.server_id), # Agent's configured server ID
                        "timestamp": start_dt.isoformat(timespec='milliseconds') + 'Z',
                        "duration_ms": duration_ms,
                        "service_name": _apm_client.backend_url.split("//")[1].split("/")[0], # Simple service name from URL
                        "endpoint": name, # Or get from request context if applicable
                        "status_code": 500 if exception_happened else 200, # Placeholder
                        "attributes": {},
                        "spans": _thread_local.span_stack
                    }
                    _apm_client.send_trace(trace_payload)
                    _reset_trace_context() # Clear context after sending

            return result
        return wrapper
    return decorator
 
def trace_http_request(name: str, attributes: Optional[Dict[str, Any]] = None):
    return trace_function(name, "http", attributes)

def trace_db_query(name: str, attributes: Optional[Dict[str, Any]] = None):
    return trace_function(name, "db", attributes)
