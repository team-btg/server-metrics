import React, { useEffect, useState } from "react";

interface LogEntry {
  timestamp: string;
  level: string;
  source?: string;
  event_id?: string;
  message: string;
  meta?: Record<string, any>;
}

interface LogsProps {
  serverId: string;
  token?: string;
}

export const Logs: React.FC<LogsProps> = ({ serverId, token }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const params = new URLSearchParams({ server_id: serverId });
    if (token) params.append("token", token);

    const ws = new WebSocket(`ws://localhost:8000/api/v1/ws/logs?${params.toString()}`);

    ws.onopen = () => console.log("[WS] Connected to logs stream");

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "log") {
          const newLog: LogEntry = msg.data;
          setLogs((prev) => [newLog, ...prev].slice(0, 50)); // keep last 50 logs
        }
      } catch (err) {
        console.error("[WS] Logs parse error:", err);
      }
    };

    ws.onclose = () => console.log("[WS] Logs disconnected");
    ws.onerror = (err) => console.error("[WS] Logs error", err);

    return () => ws.close();
  }, [serverId, token]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200 p-4">
      <h1 className="text-3xl font-bold mb-4">Event Logs</h1>
      <div className="bg-[#1e293b] rounded-2xl shadow-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#334155] text-gray-300">
            <tr>
              <th className="px-4 py-2 text-left">Time</th>
              <th className="px-4 py-2 text-left">Level</th>
              <th className="px-4 py-2 text-left">Source</th>
              <th className="px-4 py-2 text-left">Event ID</th>
              <th className="px-4 py-2 text-left">Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => (
              <tr key={i} className="border-t border-gray-700 hover:bg-[#334155]">
                <td className="px-4 py-2 text-gray-400">
                  {new Date(log.timestamp).toLocaleString()}
                </td>
                <td
                  className={`px-4 py-2 font-semibold ${
                    log.level === "Error"
                      ? "text-red-400"
                      : log.level === "Warning"
                      ? "text-yellow-400"
                      : "text-green-400"
                  }`}
                >
                  {log.level}
                </td>
                <td className="px-4 py-2">{log.source || "-"}</td>
                <td className="px-4 py-2">{log.event_id || "-"}</td>
                <td className="px-4 py-2">{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
