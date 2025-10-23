import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useMetrics } from "../hooks/useMetrics";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}
const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, color }) => (
  <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
    <h3 className="text-gray-400 text-sm">{title}</h3>
    <p className={`text-xl font-bold ${color ?? "text-white"}`}>{value}</p>
    {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
  </div>
);

interface DashboardProps {
  serverId: string;
  token?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ serverId, token }) => {
  const metrics = useMetrics(serverId, token); 
  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  
  const getSystemStatus = () => {
    if (!latestMetric) return { status: 'loading', text: 'Loading...', color: 'text-gray-700', bgColor: 'bg-gray-700' };
    
    const cpuUsage = latestMetric.cpu;
    const memoryUsage = latestMetric.memory;
    const diskUsage = latestMetric.diskPercent || 0;
    
    // Check if metrics are stale (older than 2 minutes)
    const metricTime = new Date(latestMetric.timestamp).getTime();
    const currentTime = new Date().getTime();
    const isStale = (currentTime - metricTime) > 120000; // 2 minutes
    
    if (isStale) {
      return { status: 'stale', text: 'System Data Stale', color: 'text-orange-400', bgColor: 'bg-orange-700' };
    }
    
    // Critical if any metric is very high
    if (cpuUsage > 95 || memoryUsage > 95 || diskUsage > 95) {
      return { status: 'critical', text: 'System Critical', color: 'text-red-400', bgColor: 'bg-red-700' };
    }
    
    // Warning if any metric is high
    if (cpuUsage > 80 || memoryUsage > 85 || diskUsage > 90) {
      return { status: 'warning', text: 'System Under Load', color: 'text-yellow-400', bgColor: 'bg-yellow-700' };
    }
    
    // Online if metrics are normal
    if (cpuUsage >= 0 && memoryUsage >= 0) {
      return { status: 'online', text: 'System Online', color: 'text-green-400', bgColor: 'bg-green-700' };
    }

    return { status: 'unknown', text: 'System Unknown', color: 'text-gray-400', bgColor: 'bg-gray-700' };
  };

  const systemStatus = getSystemStatus();

  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200">
      {/* Header with reduced padding */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <div className="flex items-center space-x-2">
            <span className={`relative flex h-3 w-3`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${systemStatus.bgColor} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${systemStatus.bgColor}`}></span>
            </span>
            <span className={`font-semibold ${systemStatus.color}`}>{systemStatus.text}</span> 
            {latestMetric && (
              <span className="text-xs text-gray-400">
                CPU: {latestMetric.cpu.toFixed(1)}% | RAM: {latestMetric.memory.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main content area with full-width layout */}
      <div className="p-4 space-y-4">
        {/* Top charts: CPU + RAM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <h2 className="text-lg font-semibold mb-2">CPU Usage</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8" }} />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" stroke="#3b82f6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <h2 className="text-lg font-semibold mb-2">RAM Usage</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8" }} />
                <Tooltip />
                <Line type="monotone" dataKey="memory" stroke="#22c55e" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Disk + Network charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <h2 className="text-lg font-semibold mb-2">Disk Usage (%)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8" }} />
                <Tooltip />
                <Line type="monotone" dataKey="diskPercent" stroke="#f97316" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <h2 className="text-lg font-semibold mb-2">Network I/O (MB/s)</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="timestamp" 
                  tick={{ fontSize: 10, fill: "#94a3b8" }} 
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
                  }}
                />
                <YAxis tick={{ fill: "#94a3b8" }} />
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    if (name === 'Network In') return [`${value} MB/s`, 'Network In'];
                    if (name === 'Network Out') return [`${value} MB/s`, 'Network Out'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Time: ${new Date(label).toLocaleTimeString()}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="networkIn" 
                  stroke="#06b6d4"  // Blue for incoming
                  dot={false} 
                  name="Network In"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="networkOut" 
                  stroke="#eab308"  // Yellow for outgoing
                  dot={false} 
                  name="Network Out"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

        </div>

        {/* Server Details */}
        <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Server Details</h2>
          
          {latestMetric ? (
            <>
              {/* Main server info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard 
                  title="Server Name" 
                  value={latestMetric.name || latestMetric.serverInfo?.hostname || "N/A"} 
                  subtitle="Hostname"
                  color="text-purple-400" 
                />
                <StatCard 
                  title="Operating System" 
                  value={latestMetric.os || latestMetric.serverInfo?.os || "N/A"} 
                  subtitle={`Kernel: ${latestMetric.kernel || "N/A"}`}
                />
                <StatCard 
                  title="CPU" 
                  value={latestMetric.cpuInfo || `${latestMetric.serverInfo?.cores || "N/A"} cores`} 
                  subtitle="Processor"
                />
                <StatCard 
                  title="Memory" 
                  value={latestMetric.ram || `${latestMetric.serverInfo?.memory_gb || "N/A"} GB`} 
                  subtitle="Total RAM"
                />
              </div>

              {/* Additional server details */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                <StatCard 
                  title="Architecture" 
                  value={latestMetric.serverInfo?.arch || "N/A"} 
                  subtitle="Platform"
                  color="text-blue-400"
                />
                <StatCard 
                  title="CPU Cores" 
                  value={latestMetric.serverInfo?.cores || "N/A"} 
                  subtitle="Total cores"
                />
                <StatCard 
                  title="CPU Speed" 
                  value={latestMetric.serverInfo?.cpu_speed ? `${latestMetric.serverInfo.cpu_speed} GHz` : "N/A"} 
                  subtitle="Processor speed"
                />
                <StatCard 
                  title="Kernel Version" 
                  value={latestMetric.kernel || latestMetric.serverInfo?.kernel_version || "N/A"} 
                  subtitle="OS Kernel"
                />
              </div>
            </>
          ) : (
            /* Fallback to static data if no metrics available */
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard title="Server Name" value="Loading..." subtitle="Hostname" color="text-purple-400" />
              <StatCard title="Operating System" value="Loading..." subtitle="Platform" />
              <StatCard title="CPU" value="Loading..." subtitle="Processor" />
              <StatCard title="Memory" value="Loading..." subtitle="Total RAM" />
            </div>
          )}

          {/* Dynamic footer info */}
          <div className="flex flex-wrap justify-between mt-6 text-sm text-gray-400">
            <span>Uptime: {latestMetric?.uptime || "N/A"}</span>
            <span>Load Avg: {latestMetric?.loadAvg || "N/A"}</span>
            <span>Disk Usage: {latestMetric?.diskPercent || "N/A"}%</span>
            <span>Network I/O: {latestMetric?.networkTotal || "N/A"}</span>
          </div>
        </div>
      </div>
    </div>
  );
};