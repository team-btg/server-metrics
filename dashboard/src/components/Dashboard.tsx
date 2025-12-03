import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
import Card from "./Card"; 
import type { MetricPoint } from "../hooks/useMetrics";
import { Maximize, X } from "lucide-react";

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

interface BaselinePoint {
  hour: number;
  mean: number;
  stddev: number;
}

interface DashboardProps {
  metricPoint: MetricPoint[];
  cpuBaseline?: BaselinePoint[];
  ramBaseline?: BaselinePoint[];
}

export const Dashboard: React.FC<DashboardProps> = ({ metricPoint, cpuBaseline = [], ramBaseline = [] }) => {
  const [showCpuBaseline, setShowCpuBaseline] = useState(false);
  const [showRamBaseline, setShowRamBaseline] = useState(false);
  const [maximizedChart, setMaximizedChart] = useState<string | null>(null);
  const metrics = metricPoint; 
  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  const cpuChartData = metricPoint.map((point) => {
    const hour = new Date(point.timestamp).getUTCHours();
    const baseline = cpuBaseline.find(b => b.hour === hour);
    const mean = baseline?.mean ?? null;
    const stddev = baseline?.stddev ?? null;
    const upper = mean !== null && stddev !== null ? +(mean + 3 * stddev).toFixed(1) : null;
    const lowerRaw = mean !== null && stddev !== null ? mean - 3 * stddev : null;
    const lower = lowerRaw !== null ? Math.max(0, lowerRaw) : null;
    return {
      ...point,
      cpu_upper: upper,
      cpu_lower: lower !== null ? +lower.toFixed(1) : null,
    };
  });

  const ramChartData = metricPoint.map((point) => {
    const hour = new Date(point.timestamp).getUTCHours();
    const baseline = ramBaseline.find(b => b.hour === hour);
    const mean = baseline?.mean ?? null;
    const stddev = baseline?.stddev ?? null;
    return {
      ...point,
      ram_upper: mean !== null && stddev !== null ? +(mean + 3 * stddev).toFixed(1) : null,
      ram_lower: mean !== null && stddev !== null ? +(mean - 3 * stddev).toFixed(1) : null,
    };
  });
  
  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200">
      {/* Header with reduced padding */} 
      <div className="p-4 space-y-4"> 
        <div className="flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"> 
            {/* Card for CPU Usage */}
            <div className="bg-[#1e293b] rounded-2xl size-44 shadow-lg">
              <Card title="CPU Usage" value={latestMetric ? parseFloat(latestMetric.cpu.toFixed(1)) : 0} unit="%" />
            </div> 
            {/* Card for Memory Usage */}
            <div className="bg-[#1e293b] rounded-2xl size-44 shadow-lg">
              <Card title="Memory Usage" value={latestMetric ? parseFloat(latestMetric.memory.toFixed(1)) : 0} unit="%" />
            </div> 
            {/* Card for Disk Usage */}
            <div className="bg-[#1e293b] rounded-2xl size-44 shadow-lg">
              <Card title="Disk Usage" value={latestMetric ? parseFloat(latestMetric.diskPercent.toFixed(1)) : 0} unit="%" />
            </div> 
          </div>
        </div>
      </div>

      {/* Main content area with full-width layout */}
      <div className="p-4 space-y-4">
        {/* Top charts: CPU + RAM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CPU Chart */}
          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">CPU History</h2>
              <div>
                <label className="text-xs mr-2 font-semibold">
                  <input
                    type="checkbox"
                    checked={showCpuBaseline}
                    onChange={e => setShowCpuBaseline(e.target.checked)}
                    className="mr-1"
                  /> Show baseline
                </label>
                <button onClick={() => setMaximizedChart('cpu')} className="bg-transparent p-1 rounded-lg text-gray-400 hover:text-white focus:outline-none" title="Maximize">
                  {/* Smaller maximize icon */}
                  <Maximize size={14} />
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cpuChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs> 
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1"> 
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs> 
                <CartesianGrid strokeDasharray="3 3" stroke="#444444" /> 
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#a1a1aa" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                /> 
                <YAxis 
                  stroke="#a1a1aa" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  domain={[0, 100]} 
                  unit="%" 
                /> 
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #444' }} 
                  labelStyle={{ color: '#fff' }}
                  labelFormatter={(label) => `Time: ${new Date(label).toLocaleTimeString()}`}
                /> 
                <Area 
                  type="monotone" 
                  dataKey="cpu" 
                  stroke="#06b6d4" 
                  fillOpacity={1} 
                  fill="url(#colorCpu)" 
                /> 
                {showCpuBaseline && (
                  <>
                    <Line type="monotone" dataKey="cpu_upper" stroke="#a020f0" strokeDasharray="5 5" name="Upper Bound" dot={false} />
                    <Line type="monotone" dataKey="cpu_lower" stroke="#a020f0" strokeDasharray="5 5" name="Lower Bound" dot={false} />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* RAM Chart */}
          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">RAM History</h2>
              <div>
                <label className="text-xs mr-2 font-semibold">
                  <input
                    type="checkbox"
                    checked={showRamBaseline}
                    onChange={e => setShowRamBaseline(e.target.checked)}
                    className="mr-1"                    
                  /> Show baseline
                </label>
                <button onClick={() => setMaximizedChart('ram')} className="bg-transparent p-1 rounded-lg text-gray-400 hover:text-white focus:outline-none" title="Maximize">
                  {/* Smaller maximize icon */}
                  <Maximize size={14} />
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={ramChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <defs>  
                  <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">  
                    <stop offset="5%" stopColor="#70f76cff" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#70f76cff" stopOpacity={0}/>
                  </linearGradient>
                </defs> 
                <CartesianGrid strokeDasharray="3 3" stroke="#444444" /> 
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#a1a1aa" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                /> 
                <YAxis 
                  stroke="#a1a1aa" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  domain={[0, 100]} 
                  unit="%" 
                /> 
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #444' }} 
                  labelStyle={{ color: '#fff' }}
                  labelFormatter={(label) => `Time: ${new Date(label).toLocaleTimeString()}`}
                /> 
                <Area 
                  type="monotone" 
                  dataKey="memory" 
                  stroke="#70f76cff" 
                  fillOpacity={1} 
                  fill="url(#colorMemory)"  
                  dot={false}
                /> 
                {showRamBaseline && (
                  <>
                    <Line type="monotone" dataKey="ram_upper" stroke="#a020f0" strokeDasharray="5 5" name="Upper Bound" dot={false} />
                    <Line type="monotone" dataKey="ram_lower" stroke="#a020f0" strokeDasharray="5 5" name="Lower Bound" dot={false} />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom charts: Disk + Network */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">Disk History</h2>
              <button onClick={() => setMaximizedChart('disk')} className="bg-transparent p-1 rounded-lg text-gray-400 hover:text-white focus:outline-none" title="Maximize">
                {/* Smaller maximize icon */}
                <Maximize size={14} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #444' }} 
                  labelStyle={{ color: '#fff' }}
                  labelFormatter={(label) => `Time: ${new Date(label).toLocaleTimeString()}`}
                />
                <Legend wrapperStyle={{fontSize: "14px"}}/>
                <Line type="monotone" dataKey="diskRead" name="Disk Read" stroke="#0044ffff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="diskWrite" name="Disk Write" stroke="#f59e0b" strokeWidth={2} dot={false}/>              
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">Network I/O</h2>
              <button onClick={() => setMaximizedChart('network')} className="bg-transparent p-1 rounded-lg text-gray-400 hover:text-white focus:outline-none" title="Maximize">
                {/* Smaller maximize icon */}
                <Maximize size={14} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={metrics} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444444" />
                <XAxis dataKey="timestamp" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #444' }} 
                  labelStyle={{ color: '#fff' }}
                  labelFormatter={(label) => `Time: ${new Date(label).toLocaleTimeString()}`}
                />
                <Legend wrapperStyle={{fontSize: "14px"}}/>
                <Line type="monotone" dataKey="networkIn" name="Network In" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="networkOut" name="Network Out" stroke="#f43f5e" strokeWidth={2} dot={false}/>
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

      {/* Maximized Chart Modal */}
      {maximizedChart && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setMaximizedChart(null)} // Close modal on background click
        >
          <div 
            className="bg-[#1e293b] rounded-2xl shadow-2xl p-6 w-11/12 h-5/6 flex flex-col"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
          >
            <div className="flex justify-between items-center mb-4">
              {(maximizedChart === 'cpu' || maximizedChart === 'ram') && (
                <h2 className="text-2xl font-bold capitalize">{maximizedChart.toUpperCase()} History</h2>
              )}
              {(maximizedChart === 'disk' || maximizedChart === 'network') && (
                <h2 className="text-2xl font-bold capitalize">{maximizedChart} History</h2>
              )}
              <button onClick={() => setMaximizedChart(null)} className="bg-transparent rounded-lg text-gray-400 hover:text-white focus:outline-none" title="Close">
                <X size={24} />
              </button>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              {/* Render the correct chart based on the state */}
              {maximizedChart === 'cpu' && (
                <AreaChart data={cpuChartData}>
                  <defs><linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444444" />
                  <XAxis dataKey="timestamp" stroke="#a1a1aa" fontSize={12} tickFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                  <YAxis stroke="#a1a1aa" fontSize={12} domain={[0, 100]} unit="%" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #444' }} 
                    labelStyle={{ color: '#fff' }}
                    labelFormatter={(label) => `Time: ${new Date(label).toLocaleTimeString()}`}
                  />                   
                <Area type="monotone" dataKey="cpu" stroke="#06b6d4" fill="url(#colorCpu)" />
                {showCpuBaseline && (
                  <>
                    <Line type="monotone" dataKey="cpu_lower" stroke="#a020f0" strokeDasharray="5 5" name="Lower Bound" dot={false} />
                    <Line type="monotone" dataKey="cpu_upper" stroke="#a020f0" strokeDasharray="5 5" name="Upper Bound" dot={false} />
                  </>
                )}
                </AreaChart>
              )}
              {maximizedChart === 'ram' && (
                 <AreaChart data={ramChartData}>
                  <defs><linearGradient id="colorMemory" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#70f76cff" stopOpacity={0.8}/><stop offset="95%" stopColor="#70f76cff" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444444" />
                  <XAxis dataKey="timestamp" stroke="#a1a1aa" fontSize={12} tickFormatter={(ts) => new Date(ts).toLocaleTimeString()} />
                  <YAxis stroke="#a1a1aa" fontSize={12} domain={[0, 100]} unit="%" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #444' }} 
                    labelStyle={{ color: '#fff' }}
                    labelFormatter={(label) => `Time: ${new Date(label).toLocaleTimeString()}`}
                  /> 
                  <Area type="monotone" dataKey="memory" stroke="#70f76cff" fill="url(#colorMemory)" />
                  {showRamBaseline && (
                    <>
                      <Line type="monotone" dataKey="ram_lower" stroke="#a020f0" strokeDasharray="5 5" name="Lower Bound" dot={false} />
                      <Line type="monotone" dataKey="ram_upper" stroke="#a020f0" strokeDasharray="5 5" name="Upper Bound" dot={false} />
                    </>
                  )}
                </AreaChart>
              )}
              {maximizedChart === 'disk' && (
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#94a3b8" }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #444' }} 
                  labelStyle={{ color: '#fff' }}
                  labelFormatter={(label) => `Time: ${new Date(label).toLocaleTimeString()}`}
                />
                <Legend wrapperStyle={{fontSize: "14px"}}/>
                <Line type="monotone" dataKey="diskRead" name="Disk Read" stroke="#0b36f575" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="diskWrite" name="Disk Write" stroke="#f4a63fa8" strokeWidth={2} dot={false}/>   
              </LineChart>
              )}
              {maximizedChart === 'network' && (
              <LineChart data={metrics} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444444" />
                <XAxis dataKey="timestamp" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #444' }} 
                  labelStyle={{ color: '#fff' }}
                  labelFormatter={(label) => `Time: ${new Date(label).toLocaleTimeString()}`}
                />
                <Legend wrapperStyle={{fontSize: "14px"}}/>
                <Line type="monotone" dataKey="networkIn" name="Network In" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="networkOut" name="Network Out" stroke="#f43f5e" strokeWidth={2} dot={false}/>
              </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )} 
    </div>
  );
};