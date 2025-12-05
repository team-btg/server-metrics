import functools
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
import asyncio

from server_metrics_apm import get_apm_client 
from server_metrics_apm.context import ( 
    get_current_trace_id, set_current_trace_id,
    get_current_span_id, set_current_span_id,
    push_span_to_stack,
    get_span_stack, set_span_stack, 
    reset_trace_context
)

from .utils import generate_uuid, now_ms
  
def trace_function(name: str, span_type: str = "function", attributes: Optional[Dict[str, Any]] = None):
    def decorator(func):
        is_coroutine_function = asyncio.iscoroutinefunction(func)

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            apm_client_instance = get_apm_client()
            if apm_client_instance is None:
                return await func(*args, **kwargs)

            trace_id = get_current_trace_id() 
            if trace_id is None:
                print(f"WARNING: trace_function('{name}') called without active trace context. Sending as standalone.")
                temp_trace_id = generate_uuid()
                set_current_trace_id(temp_trace_id)
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
                result = await func(*args, **kwargs)
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
                
            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            apm_client_instance = get_apm_client()
            if apm_client_instance is None:
                return func(*args, **kwargs)

            trace_id = get_current_trace_id()
            is_root_trace = trace_id is None
            if is_root_trace:
                print(f"WARNING: trace_function('{name}') called without active trace context. Sending as standalone.")
                temp_trace_id = generate_uuid()
                set_current_trace_id(temp_trace_id)
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
                result = func(*args, **kwargs)
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

            return result
        
        return async_wrapper if is_coroutine_function else sync_wrapper
    return decorator

def trace_http_request(name: str, attributes: Optional[Dict[str, Any]] = None):
    return trace_function(name, "http", attributes)

def trace_db_query(name: str, attributes: Optional[Dict[str, Any]] = None):
    return trace_function(name, "db", attributes)
