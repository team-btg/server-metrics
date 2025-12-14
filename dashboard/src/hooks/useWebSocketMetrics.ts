import { useEffect, useState } from "react";
import type { MetricPoint } from "./useMetrics"; 

export function useWebSocketMetrics(serverId: string, token?: string) {
  const [liveMetrics, setLiveMetrics] = useState<MetricPoint[]>([]);

  useEffect(() => {
    if (!serverId || !token) return;

    const params = new URLSearchParams({ server_id: serverId, token });
    const wsUrl = new URL(`/api/v1/ws/metrics?${params.toString()}`, import.meta.env.VITE_API_BASE_URL.replace(/^http/, "ws"));
    const ws = new WebSocket(wsUrl.toString());

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "metric") {
          const newPoint: MetricPoint = {
            timestamp: msg.data.timestamp,
            cpu: msg.data.metrics.find((x: any) => x.name === "cpu.percent")?.value ?? 0,
            memory: msg.data.metrics.find((x: any) => x.name === "mem.percent")?.value ?? 0,
            disk: msg.data.metrics?.find((x: any) => x.name === "disk")?.value ?? [],
            network: msg.data.metrics?.find((x: any) => x.name === "network")?.value ?? [],
            processes: msg.data.processes || [],
            serverInfo: msg.data.meta?.server_info,
            meta: msg.data.meta,
            name: msg.data.meta?.formatted?.name || msg.data.meta?.server_info?.hostname,
            os: msg.data.meta?.formatted?.os || msg.data.meta?.server_info?.os_name,
            kernel: msg.data.meta?.formatted?.kernel,
            ram: msg.data.meta?.formatted?.ram,
            cpuInfo: msg.data.meta?.formatted?.cpu,
            uptime: msg.data.meta?.formatted?.uptime,
            loadAvg: msg.data.meta?.formatted?.load_avg,
            diskPercent: parseFloat(msg.data.meta?.formatted?.disk_percent) || msg.data.meta?.disk_percent || 0,
            diskRead: msg.data.meta?.disk_read_mbps || 0,
            diskWrite: msg.data.meta?.disk_write_mbps || 0,
            networkIn: msg.data.meta?.network_in || 0,
            networkOut: msg.data.meta?.network_out || 0,
            networkTotal: msg.data.meta?.network_total || 0,
          };
          setLiveMetrics((prev) => [...prev, newPoint]);
        }
      } catch (err) {
        console.error("[WS] Parse error:", err);
      }
    };

    ws.onclose = (err) => console.log("WS Closed", err.code, err.reason);
    ws.onerror = (err) => console.error("WS Error", err);

    return () => {
      ws.close();
    };
  }, [serverId, token]);

  return liveMetrics;
}