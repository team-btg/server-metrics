import contextvars
from typing import Optional, List, Dict, Any
from uuid import UUID

_current_trace_id_ctx = contextvars.ContextVar('current_trace_id', default=None)
_current_span_id_ctx = contextvars.ContextVar('current_span_id', default=None)
_span_stack_ctx = contextvars.ContextVar('span_stack', default=[]) 

def get_current_trace_id() -> Optional[UUID]:
    return _current_trace_id_ctx.get()

def set_current_trace_id(trace_id: Optional[UUID]):
    _current_trace_id_ctx.set(trace_id)

def get_current_span_id() -> Optional[UUID]:
    return _current_span_id_ctx.get()

def set_current_span_id(span_id: Optional[UUID]):
    _current_span_id_ctx.set(span_id)

def get_span_stack() -> List[Dict[str, Any]]:
    return _span_stack_ctx.get()

def set_span_stack(span_stack: List[Dict[str, Any]]):
    _span_stack_ctx.set(span_stack)

def push_span_to_stack(span_data: Dict[str, Any]):
    """Adds a completed span to the thread-local stack for the current trace."""
    current_stack = _span_stack_ctx.get()
    current_stack.append(span_data)
    _span_stack_ctx.set(current_stack)
    
def reset_trace_context():
    """Resets all contextvars for a new trace."""
    _current_trace_id_ctx.set(None)
    _current_span_id_ctx.set(None)
    _span_stack_ctx.set([]) 
