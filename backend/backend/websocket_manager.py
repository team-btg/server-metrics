from typing import Dict, List
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # store list of websockets per server_id
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, server_id: str, websocket: WebSocket):
        await websocket.accept()
        if server_id not in self.active_connections:
            self.active_connections[server_id] = []
        self.active_connections[server_id].append(websocket)

    async def disconnect(self, server_id: str, websocket: WebSocket):
        if server_id in self.active_connections:
            self.active_connections[server_id].remove(websocket)
            if not self.active_connections[server_id]:
                del self.active_connections[server_id]

    async def broadcast(self, server_id: str, message: dict):
        """Send message to all connected websockets for this server_id"""
        if server_id in self.active_connections:
            for websocket in self.active_connections[server_id]:
                try:
                    await websocket.send_json(message)
                except Exception:
                    # handle disconnected websockets
                    await self.disconnect(server_id, websocket)
