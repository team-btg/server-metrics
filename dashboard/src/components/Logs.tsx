import React from "react";
import { useLogs } from "../hooks/useLogs";
 
interface LogsProps {
  serverId: string;
  token?: string;
}

export const Logs: React.FC<LogsProps> = ({ serverId, token }) => {
  const logs = useLogs(serverId, token);  
  
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
                  {log.timestamp}
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
