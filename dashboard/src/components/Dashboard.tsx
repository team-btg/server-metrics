import React, { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from "recharts";
import { useMetrics } from "../hooks/useMetrics"; 
import PeriodSelector from './PeriodSelector';
import IntervalSelector from './IntervalSelector';
import Card from "./Card";
import ChatPopup from "./ChatPopup";

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
  const [period, setPeriod] = useState('1h');
  const [interval, setInterval] = useState(5000);
  const [maximizedChart, setMaximizedChart] = useState<string | null>(null);
 
  const metrics = useMetrics(serverId, period, interval, token); 
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
          <h1 className="text-3xl font-bold">Hub</h1>
          <div className="flex items-center space-x-2">
            <span className={`relative flex h-3 w-3`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${systemStatus.bgColor} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${systemStatus.bgColor}`}></span>
            </span>
            <span className={`font-semibold ${systemStatus.color}`}>{systemStatus.text}</span> 
             
            <PeriodSelector period={period} setPeriod={setPeriod} />
            <IntervalSelector interval={interval} setInterval={setInterval} />

          </div>
        </div> 
      </div>

      <div className="p-4 space-y-4"> 
        <div className="flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"> 
            {/* Card for CPU Usage */}
            <div className="bg-[#1e293b] rounded-2xl size-32 shadow-lg">
              <Card title="CPU Usage" value={latestMetric ? parseFloat(latestMetric.cpu.toFixed(1)) : 0} unit="%" />
            </div> 
            {/* Card for Memory Usage */}
            <div className="bg-[#1e293b] rounded-2xl size-32 shadow-lg">
              <Card title="Memory Usage" value={latestMetric ? parseFloat(latestMetric.memory.toFixed(1)) : 0} unit="%" />
            </div> 
            {/* Card for Disk Usage */}
            <div className="bg-[#1e293b] rounded-2xl size-32 shadow-lg">
              <Card title="Disk Usage" value={latestMetric ? parseFloat(latestMetric.diskPercent.toFixed(1)) : 0} unit="%" />
            </div> 
          </div>
        </div>
      </div>

      {/* Main content area with full-width layout */}
      <div className="p-4 space-y-4">
        {/* Top charts: CPU + RAM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">CPU History</h2>
              <button onClick={() => setMaximizedChart('cpu')} className="bg-transparent p-1 rounded-full text-gray-400 hover:text-white focus:outline-none" title="Maximize">
                {/* Smaller maximize icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 4H4v6M20 14v6h-6M14 4h6v6M4 14v6h6" />
                </svg>
              </button>
            </div>
            <ResponsiveContainer width="100%" height={200}> 
              <AreaChart data={metrics} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}> 
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
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">RAM History</h2>
              <button onClick={() => setMaximizedChart('ram')} className="bg-transparent p-1 rounded-full text-gray-400 hover:text-white focus:outline-none" title="Maximize">
                {/* Smaller maximize icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 4H4v6M20 14v6h-6M14 4h6v6M4 14v6h6" />
                </svg>
              </button>
            </div>
            <ResponsiveContainer width="100%" height={200}> 
              <AreaChart data={metrics} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}> 
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom charts: Disk + Network */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#1e293b] rounded-2xl shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">Disk History</h2>
              <button onClick={() => setMaximizedChart('disk')} className="bg-transparent p-1 rounded-full text-gray-400 hover:text-white focus:outline-none" title="Maximize">
                {/* Smaller maximize icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 4H4v6M20 14v6h-6M14 4h6v6M4 14v6h6" />
                </svg>
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
              <button onClick={() => setMaximizedChart('network')} className="bg-transparent p-1 rounded-full text-gray-400 hover:text-white focus:outline-none" title="Maximize">
                {/* Smaller maximize icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 4H4v6M20 14v6h-6M14 4h6v6M4 14v6h6" />
                </svg>
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
              <h2 className="text-2xl font-bold capitalize">{maximizedChart} History</h2>
              <button onClick={() => setMaximizedChart(null)} className="bg-transparent text-gray-400 hover:text-white focus:outline-none" title="Close">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              {/* Render the correct chart based on the state */}
              {maximizedChart === 'cpu' && (
                <AreaChart data={metrics}>
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
                </AreaChart>
              )}
              {maximizedChart === 'ram' && (
                 <AreaChart data={metrics}>
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

      {/* Add the Chat Popup Component Here */}
      <ChatPopup latestMetric={latestMetric} token={token} />
    </div>
  );
};