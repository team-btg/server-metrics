import { useEffect, useState } from "react";

export interface LogEntry {
  timestamp: string;
  level: string;
  source?: string;
  message: string;
  event_id?: string;
}

export function useLogs(serverId: string, token?: string) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    let active = true;
    const fetchRecent = async () => {
      try {
        const url = new URL("http://localhost:8000/api/v1/logs/recent");
        url.searchParams.append("server_id", serverId);

        const res = await fetch(url.toString(), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          console.error("Failed to fetch recent logs:", res.statusText);
          return;
        }

        const data = await res.json();

        console.log(`[DEBUG] Fetched ${data.length} recent logs for server_id ${serverId}`, data);
  
        const recent: LogEntry[] = data.map((item: any) => ({
          timestamp: item.timestamp,
          level: item.level,
          source: item.source,
          message: item.message,
          event_id: item.event_id,
        }));

        if (active) setLogs(recent);
      } catch (err) {
        console.error("Error fetching recent logs:", err);
      }
    };

    fetchRecent();

    const params = new URLSearchParams({ server_id: serverId });
    if (token) params.append("token", token);

    const wsUrl = new URL(`/api/v1/ws/logs?${params.toString()}`, window.location.origin.replace(/^http/, "ws"));

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
