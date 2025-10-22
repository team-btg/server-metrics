import { useEffect, useState } from "react";

export interface DiskMetric {
  mountpoint: string;
  total_gb: number;
  used_gb: number;
  percent: number;
}

export interface NetworkMetric {
  interface: string;
  address: string;
  netmask: string | null;
  broadcast: string | null;
}

export interface ServerInfo {
  hostname: string;
  os: string;
  os_name: string;
  os_version: string;
  arch: string;
  cores: number;
  memory_gb: number;
  kernel_version: string;
  ram_type: string;
  cpu_model: string;
  cpu_speed: number | string;
}

export interface MetricPoint {
  timestamp: string;
  cpu: number;
  memory: number;
  disk?: DiskMetric[];
  network?: NetworkMetric[];
  serverInfo?: ServerInfo;
  // New fields from meta.formatted
  name?: string;
  os?: string;
  kernel?: string;
  ram?: string;
  cpuInfo?: string;
  uptime?: string;
  loadAvg?: number | string;
  diskPercent?: number;
  networkIO?: string | number;
  // NEW: Separate network metrics
  networkIn?: number;
  networkOut?: number;
  networkTotal?: number;
  // Meta fields
  meta?: {
    uptime: number;
    uptime_days: number;
    load_avg: number | string;
    disk_percent: number;
    network_io: number;
    // NEW: Separate network metrics in meta
    network_in?: number;
    network_out?: number;
    network_total?: number;
    server_info: ServerInfo;
    formatted: {
      name: string;
      os: string;
      kernel: string;
      ram: string;
      cpu: string;
      uptime: string;
      load_avg: number | string;
      disk_percent: number;
      network_io: string;
      // NEW: Separate network metrics in formatted
      network_in?: string;
      network_out?: string;
      network_total?: string;
    };
  };
}

export function useMetrics(serverId: string, token?: string) {
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);

  useEffect(() => { 
    let active = true;
    
    // Fetch recent history first
    const fetchRecent = async () => {
      try {
        const url = new URL("http://localhost:8000/api/v1/metrics/recent");
        url.searchParams.append("server_id", serverId);

        const res = await fetch(url.toString(), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          console.error("Failed to fetch recent metrics:", res.statusText);
          return;
        }

        const data = await res.json();

        console.log(`[DEBUG] Fetched ${data.length} recent metrics for server_id ${serverId}`, data);

        // Normalize DB data into chart format 
        const recent: MetricPoint[] = data.map((item: any) => ({
          timestamp: item.timestamp,
          cpu: item.metrics.find((m: any) => m.name === "cpu.percent")?.value ?? 0,
          memory: item.metrics.find((m: any) => m.name === "mem.percent")?.value ?? 0,
          disk: item.metrics?.find((x: any) => x.name === "disk")?.value ?? [],
          network: item.metrics?.find((x: any) => x.name === "network")?.value ?? [],
          serverInfo: item.meta?.server_info, 
          meta: item.meta, 
          name: item.meta?.formatted?.name || item.meta?.server_info?.hostname,
          os: item.meta?.formatted?.os || item.meta?.server_info?.os_name,
          kernel: item.meta?.formatted?.kernel,
          ram: item.meta?.formatted?.ram,
          cpuInfo: item.meta?.formatted?.cpu,
          uptime: item.meta?.formatted?.uptime,
          loadAvg: item.meta?.formatted?.load_avg,
          diskPercent: item.meta?.formatted?.disk_percent || item.meta?.disk_percent,
          networkIO: item.meta?.formatted?.network_io || item.meta?.network_io,
          // NEW: Add separate network metrics
          networkIn: item.meta?.network_in || 
                    (typeof item.meta?.formatted?.network_in === 'string' ? 
                     parseFloat(item.meta.formatted.network_in) : 0),
          networkOut: item.meta?.network_out || 
                     (typeof item.meta?.formatted?.network_out === 'string' ? 
                      parseFloat(item.meta.formatted.network_out) : 0),
          networkTotal: item.meta?.network_total || 
                       (typeof item.meta?.formatted?.network_total === 'string' ? 
                        parseFloat(item.meta.formatted.network_total) : 0),
        }));

        if (active) setMetrics(recent);
      } catch (err) {
        console.error("Error fetching recent metrics:", err);
      }
    };

    fetchRecent();

    const params = new URLSearchParams({ server_id: serverId });
    if (token) params.append("token", token);

    const ws = new WebSocket(`ws://localhost:8000/api/v1/ws/metrics?${params.toString()}`);

    ws.onopen = () => {
      console.log("[WS] Connected to metrics stream");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "metric") {
          const cpu = msg.data.metrics.find((x: any) => x.name === "cpu.percent")?.value ?? 0;
          const memory = msg.data.metrics.find((x: any) => x.name === "mem.percent")?.value ?? 0;
          const disk = msg.data.metrics?.find((x: any) => x.name === "disk")?.value ?? [];
          const network = msg.data.metrics?.find((x: any) => x.name === "network")?.value ?? [];
          const serverInfo = msg.data.meta?.server_info;

          const newPoint: MetricPoint = {
            timestamp: msg.data.timestamp,
            cpu,
            memory,
            disk,
            network,
            serverInfo,
            meta: msg.data.meta, 
            name: msg.data.meta?.formatted?.name || msg.data.meta?.server_info?.hostname,
            os: msg.data.meta?.formatted?.os || msg.data.meta?.server_info?.os_name,
            kernel: msg.data.meta?.formatted?.kernel,
            ram: msg.data.meta?.formatted?.ram,
            cpuInfo: msg.data.meta?.formatted?.cpu,
            uptime: msg.data.meta?.formatted?.uptime,
            loadAvg: msg.data.meta?.formatted?.load_avg,
            diskPercent: msg.data.meta?.formatted?.disk_percent || msg.data.meta?.disk_percent,
            networkIO: msg.data.meta?.formatted?.network_io || msg.data.meta?.network_io,
            // NEW: Add separate network metrics for WebSocket data
            networkIn: msg.data.meta?.network_in || 
                      (typeof msg.data.meta?.formatted?.network_in === 'string' ? 
                       parseFloat(msg.data.meta.formatted.network_in) : 0),
            networkOut: msg.data.meta?.network_out || 
                       (typeof msg.data.meta?.formatted?.network_out === 'string' ? 
                        parseFloat(msg.data.meta.formatted.network_out) : 0),
            networkTotal: msg.data.meta?.network_total || 
                         (typeof msg.data.meta?.formatted?.network_total === 'string' ? 
                          parseFloat(msg.data.meta.formatted.network_total) : 0),
          };

          console.log("[WS] New metric point:", newPoint);

          setMetrics((prev) => [...prev, newPoint].slice(-200)); // keep last 200 points
        }
      } catch (err) {
        console.error("[WS] Parse error:", err);
      }
    };

    ws.onclose = (err) => console.log("Closed", err);
    ws.onerror = (err) => console.error("Error", err);

    return () => ws.close();
  }, [serverId, token]);

  return metrics;
}