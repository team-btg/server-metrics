import { useEffect, useState } from "react";

export interface LogEntry {
  timestamp: string;
  level: string;
  source?: string;
  message: string;
}

export function useLogs(serverId: string, token?: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const wsUrl = new URL(`/api/v1/ws/logs/${serverId}`, window.location.origin.replace(/^http/, "ws"));
    if (token) wsUrl.searchParams.set("token", token);

    const ws = new WebSocket(wsUrl.toString());

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "log") {
          const log: LogEntry = msg.data;
          setLogs((prev) => [...prev, log].slice(-50)); // keep last 50 logs
        }
      } catch (err) {
        console.error("[WS Logs] Parse error:", err);
      }
    };

    ws.onclose = () => console.warn("[WS Logs] Disconnected");
    return () => ws.close();
  }, [serverId, token]);

  return logs;
}
