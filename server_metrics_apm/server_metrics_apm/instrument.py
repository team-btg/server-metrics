import functools
from datetime import datetime
from typing import Optional, Dict, Any
import asyncio

from server_metrics_apm import get_apm_client 
from server_metrics_apm.context import ( 
    get_current_trace_id, set_current_trace_id,
    get_current_span_id, set_current_span_id,
    push_span_to_stack,
    get_span_stack, 
    reset_trace_context
)

from .utils import generate_uuid, now_ms
from urllib.parse import urlparse
  
def trace_function(name: str, span_type: str = "function", attributes: Optional[Dict[str, Any]] = None):
    def decorator(func):
        is_coroutine_function = asyncio.iscoroutinefunction(func)

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            apm_client_instance = get_apm_client()
            if apm_client_instance is None:
                return await func(*args, **kwargs) if is_coroutine_function else func(*args, **kwargs)

            trace_id = get_current_trace_id() 
            is_root_trace = trace_id is None 
            
            if is_root_trace:
                trace_id = generate_uuid()
                set_current_trace_id(trace_id)
                reset_trace_context() 
                
            parent_span_id = get_current_span_id()
            span_id = generate_uuid()
            set_current_span_id(span_id)

            start_time_ms = now_ms()
            start_dt = datetime.utcfromtimestamp(start_time_ms / 1000)

            result = None
            exception_happened = False
            span_attributes = attributes.copy() if attributes else {}

            try:
                if is_coroutine_function:
                    result = await func(*args, **kwargs)
                else:
                    result = await asyncio.to_thread(func, *args, **kwargs)
            except Exception as e:
                exception_happened = True
                span_attributes["error"] = True
                span_attributes["error.message"] = str(e)
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
                    "attributes": span_attributes 
                }
                push_span_to_stack(span_data)
                set_current_span_id(parent_span_id) 
                
                if is_root_trace:
                    all_spans_for_trace = get_span_stack()
                    trace_payload = {
                        "server_id": str(apm_client_instance.server_id), 
                        "timestamp": start_dt.isoformat(timespec='milliseconds') + 'Z',
                        "duration_ms": duration_ms,
                        "service_name": urlparse(apm_client_instance.backend_url).hostname or "unknown-service", 
                        "endpoint": name, 
                        "status_code": 500 if exception_happened else 200, 
                        "attributes": {}, 
                        "spans": all_spans_for_trace
                    }
                    
                    asyncio.create_task(
                        asyncio.to_thread(apm_client_instance.send_trace, trace_payload)
                    )
                    reset_trace_context()

            return result

        return async_wrapper
    return decorator

def trace_http_request(name: str, attributes: Optional[Dict[str, Any]] = None):
    return trace_function(name, "http", attributes)

def trace_db_query(name: str, attributes: Optional[Dict[str, Any]] = None):
    return trace_function(name, "db", attributes)
