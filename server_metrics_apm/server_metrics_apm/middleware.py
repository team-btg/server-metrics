import asyncio
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp
from typing import Optional, Dict, Any

from .utils import generate_uuid, now_ms
from server_metrics_apm import get_apm_client
from server_metrics_apm.context import ( 
    set_current_trace_id,
    set_current_span_id,
    get_span_stack, 
    reset_trace_context,
    push_span_to_stack
)

class APMMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        apm_client_instance = get_apm_client()
        if apm_client_instance is None:
            return await call_next(request)

        if request.url.path == "/api/v1/apm/traces" and request.method == "POST":
            return await call_next(request)
        
        reset_trace_context() 

        trace_id = generate_uuid()
        set_current_trace_id(trace_id) 
        
        root_span_id = generate_uuid()
        set_current_span_id(root_span_id) 

        start_time_ms = now_ms()
        start_dt = datetime.utcfromtimestamp(start_time_ms / 1000)

        response: Optional[Response] = None
        exception_happened = False
        status_code: int = 500 

        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            exception_happened = True
            raise
        finally:
            end_time_ms = now_ms()
            duration_ms = end_time_ms - start_time_ms

            root_span_attributes: Dict[str, Any] = {
                "http.method": request.method,
                "http.url": str(request.url),
                "http.status_code": status_code,
            }
            if request.scope and 'route' in request.scope:
                route_path = request.scope['route'].path
                root_span_attributes["http.route"] = route_path

            if exception_happened:
                root_span_attributes["error"] = True
                root_span_attributes["error.message"] = f"Unhandled exception during request: {type(e).__name__}" 

            root_span_data = {
                "id": str(root_span_id),
                "parent_id": None, 
                "name": f"{request.method} {root_span_attributes.get('http.route', str(request.url.path))}",
                "span_type": "http",
                "start_time": start_dt.isoformat(timespec='milliseconds') + 'Z',
                "duration_ms": duration_ms,
                "attributes": root_span_attributes
            }
            push_span_to_stack(root_span_data) 

            all_spans_for_trace = get_span_stack() 

            trace_payload = {
                "server_id": str(apm_client_instance.server_id), 
                "timestamp": start_dt.isoformat(timespec='milliseconds') + 'Z',
                "duration_ms": duration_ms,
                "service_name": apm_client_instance.backend_url.split("//")[1].split("/")[0], 
                "endpoint": root_span_attributes.get('http.route', str(request.url.path)),
                "status_code": status_code,
                "attributes": {}, 
                "spans": all_spans_for_trace
            }

            asyncio.create_task(
                asyncio.to_thread(apm_client_instance.send_trace, trace_payload)
            )

            reset_trace_context() 

        if response is None:
            pass
        return response