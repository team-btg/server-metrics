import React, { useState, useMemo } from "react"; // Import useMemo
import { Bell, FileText, Folder, Microchip, HardDrive, HistoryIcon, AlertTriangle, Lightbulb, LightbulbOff } from 'lucide-react'; // Import AlertTriangle
import { Dashboard } from "./Dashboard";
import { Logs } from "./Logs";
import ProcessList from './ProcessList';
import PeriodSelector from './PeriodSelector';
import IntervalSelector from './IntervalSelector'; 
import ChatPopup from "./ChatPopup";
import DiskUsage from "./DiskUsage";  
import IncidentFeed from "./IncidentFeed";
import { useMetrics } from "../hooks/useMetrics";   
import { useWebSocketMetrics } from "../hooks/useWebSocketMetrics";
import { useQuery } from '@tanstack/react-query';
import RightSizingAdvisor from './RightSizingAdvisor'; 
 
const DashboardSkeleton = () => (
    <div className="p-4 space-y-4 animate-pulse">
        <div className="flex justify-center"><div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><div className="bg-[#1e293b] rounded-2xl size-44"></div><div className="bg-[#1e293b] rounded-2xl size-44"></div><div className="bg-[#1e293b] rounded-2xl size-44"></div></div></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-56 bg-[#1e293b] rounded-2xl"></div>
            <div className="h-56 bg-[#1e293b] rounded-2xl"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-56 bg-[#1e293b] rounded-2xl"></div>
            <div className="h-56 bg-[#1e293b] rounded-2xl"></div>
        </div>
    </div>
);
 
interface MainTabsProps {
  serverId: string;
  token?: string;
}

const fetchBaseline = async (serverId: string, metric: string, token?: string) => {
  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL}/api/v1/metrics/baselines/${serverId}?metric=${metric}`,
    token ? { headers: { 'Authorization': `Bearer ${token}` } } : undefined
  );
  if (!response.ok) throw new Error('Failed to fetch baseline');
  return response.json();
};

const fetchActiveAlertCount = async (serverId: string, token: string): Promise<number> => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/alerts/events/servers/${serverId}/active_count`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch active alert count');
  }
  return response.json();
};

export const MainTabs: React.FC<MainTabsProps> = ({ serverId, token }) => {
  const [tab, setTab] = useState("dashboard"); 
  const [period, setPeriod] = useState('1h'); // Default to 1h for better initial view
  const [interval, setInterval] = useState(10000); // Interval is now less critical

  const { data: activeAlertsCount } = useQuery({
    queryKey: ['activeAlertCount', serverId],
    queryFn: () => fetchActiveAlertCount(serverId, token || ''),
    enabled: !!token,  
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  const { data: cpuBaseline = [] } = useQuery({
    queryKey: ['cpuBaseline', serverId],
    queryFn: () => fetchBaseline(serverId, 'cpu.percent', token),
    enabled: !!serverId,
  });

  const { data: ramBaseline = [] } = useQuery({
    queryKey: ['ramBaseline', serverId],
    queryFn: () => fetchBaseline(serverId, 'mem.percent', token),
    enabled: !!serverId,
  });

  const [isAdvisorVisible, setIsAdvisorVisible] = useState(true);
 
  // --- NEW DECOUPLED DATA FETCHING ---
  const { historicalMetrics, isLoading, error } = useMetrics(serverId, period, token); 
  const liveMetrics = useWebSocketMetrics(serverId, token);

  const { data: recommendations } = useQuery<any[]>({
    queryKey: ['recommendations', serverId], 
    queryFn: () => fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers/${serverId}/recommendations`, {
        headers: { 'Authorization': `Bearer ${token}` },
    }).then(res => res.json()),
    enabled: !!token,
  });

  const hasActionableRecommendation = recommendations && recommendations.length > 0 && recommendations[0].recommendation_type !== 'STABLE';

  // Combine historical and live data, ensuring no duplicates and proper sorting
  const allMetrics = useMemo(() => {
    const metricMap = new Map();
    // Add historical data first
    historicalMetrics.forEach(metric => metricMap.set(metric.timestamp, metric));
    // Overwrite with live data, which is more up-to-date
   liveMetrics.forEach(metric => metricMap.set(metric.timestamp, metric));
    
    return Array.from(metricMap.values())
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [historicalMetrics, liveMetrics]);
  
  const latestMetric = allMetrics.length > 0 ? allMetrics[allMetrics.length - 1] : null;

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
  
  const renderContent = () => {
    // --- NEW LOADING AND ERROR HANDLING ---
    if (tab === 'dashboard') {
      if (isLoading) {
        return <DashboardSkeleton />;
      }
      if (error) {
        return (
          <div className="flex flex-col items-center justify-center h-96 text-red-400">
            <AlertTriangle className="h-12 w-12 mb-4" />
            <h2 className="text-xl font-bold">Failed to Load Dashboard</h2>
            <p className="mt-2 text-gray-400">{error}</p>
          </div>
        );
      }
    }

    switch (tab) {
      case 'dashboard':
        // Pass the combined 'allMetrics' to the Dashboard
        return <Dashboard metricPoint={allMetrics} cpuBaseline={cpuBaseline} ramBaseline={ramBaseline} />;
      case 'logs':
        return <Logs serverId={serverId} />;
      case 'processes': 
        // ProcessList can also use the combined data
        return <ProcessList metricPoint={latestMetric?.processes || []} />;
      case 'disk':  
        // DiskUsage can also use the combined data
        return <DiskUsage metricPoint={latestMetric?.disk || []} />; 
      case "history":
          return <IncidentFeed serverId={serverId} />;
      default:
        return <Dashboard metricPoint={allMetrics} cpuBaseline={cpuBaseline} ramBaseline={ramBaseline} />;
    }
  };
  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200">
      <RightSizingAdvisor 
        serverId={serverId} 
        isVisible={isAdvisorVisible}
        onDismiss={() => setIsAdvisorVisible(false)}
      />         
      {/* Main header bar with tabs and controls */}
      <div className="flex items-center justify-between px-4 pt-2">
        {/* Left side: Tab buttons */}
        <div className="flex space-x-1">
          <button
            className={`relative px-4 py-2 rounded-t-lg border border-b-0 transition-all duration-200 ${
              tab === "dashboard" 
                ? "bg-[#1e293b] border-gray-600 text-white shadow-lg" 
                : "bg-[#0f172a] border-transparent text-gray-400 hover:text-gray-300 hover:bg-[#1a2436]"
            }`}
            onClick={() => setTab("dashboard")}
          >
            <div className="flex items-center space-x-2">
              <Folder size={16} />
              <span>Dashboards</span>
            </div>
            {tab === "dashboard" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>}
          </button>
          
          <button
            className={`relative px-4 py-2 rounded-t-lg border border-b-0 transition-all duration-200 ${
              tab === "logs" 
                ? "bg-[#1e293b] border-gray-600 text-white shadow-lg" 
                : "bg-[#0f172a] border-transparent text-gray-400 hover:text-gray-300 hover:bg-[#1a2436]"
            }`}
            onClick={() => setTab("logs")}
          >
            <div className="flex items-center space-x-2">
              <FileText size={16} />
              <span>Logs</span>
            </div>
            {tab === "logs" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>}
          </button> 

          <button
            className={`relative px-4 py-2 rounded-t-lg border border-b-0 transition-all duration-200 ${
              tab === "processes" 
                ? "bg-[#1e293b] border-gray-600 text-white shadow-lg" 
                : "bg-[#0f172a] border-transparent text-gray-400 hover:text-gray-300 hover:bg-[#1a2436]"
            }`}
            onClick={() => setTab("processes")}
          >
            <div className="flex items-center space-x-2">
              <Microchip size={16} />
              <span>Processes</span>
            </div>
            {tab === "processes" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>}
          </button> 

          <button
            className={`relative px-4 py-2 rounded-t-lg border border-b-0 transition-all duration-200 ${
              tab === "disk" 
                ? "bg-[#1e293b] border-gray-600 text-white shadow-lg" 
                : "bg-[#0f172a] border-transparent text-gray-400 hover:text-gray-300 hover:bg-[#1a2436]"
            }`}
            onClick={() => setTab("disk")}
          >
            <div className="flex items-center space-x-2">
              <HardDrive size={16} />
              <span>Disk</span>
            </div>
            {tab === "disk" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>}
          </button>  

          <button
            className={`relative px-4 py-2 rounded-t-lg border border-b-0 transition-all duration-200 ${
              tab === "history" 
                ? "bg-[#1e293b] border-gray-600 text-white shadow-lg" 
                : "bg-[#0f172a] border-transparent text-gray-400 hover:text-gray-300 hover:bg-[#1a2436]"
            }`}
            onClick={() => setTab("history")}
          >
            <div className="flex items-center space-x-2">
              <HistoryIcon size={16} />
              <span>History</span>
            </div>
            {tab === "history" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>}
          </button>
        </div>

        {/* Right side: Status and Selectors */}
        <div className="flex items-center space-x-4">
          {hasActionableRecommendation && (
            <button
              onClick={() => setIsAdvisorVisible(!isAdvisorVisible)}
              className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
              title={isAdvisorVisible ? "Hide Recommendation" : "Show Recommendation"}
            >
              {isAdvisorVisible ? <LightbulbOff size={18} className="text-yellow-400" /> : <Lightbulb size={18} className="text-yellow-400 animate-pulse" />}
            </button>
          )}                      
          <div className="flex items-center space-x-2">
            <span className={`relative flex h-3 w-3`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${systemStatus.bgColor} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${systemStatus.bgColor}`}></span>
            </span>
            {/* Hide status text on small screens to save space */}
            <span className={`hidden sm:block font-semibold ${systemStatus.color}`}>{systemStatus.text}</span> 
          </div>
          <button 
            onClick={() => setTab('history')} 
            className="bg-transparent relative text-gray-400 text-white transition-colors"
            aria-label="View active alerts"
          >
            <Bell 
              size={20}  
              className={activeAlertsCount && activeAlertsCount > 0 ? 'animate-shake' : ''} 
              key={activeAlertsCount}
            />
            {(activeAlertsCount ?? 0) > 0 && (
              <span className="absolute -top-1 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                {activeAlertsCount}
              </span>
            )}
          </button>        
          {/* Hide selectors on small screens, show them on medium screens and up */}
          <div className="hidden md:flex items-center space-x-2">
            <PeriodSelector period={period} setPeriod={setPeriod} />
            <IntervalSelector interval={interval} setInterval={setInterval} />
          </div> 
        </div>
      </div> 
      
      {/* Tab Content Area */}
      <div className="bg-transparent rounded-b-lg rounded-tr-lg shadow-xl min-h-[calc(100vh-80px)]">
        {renderContent()}
      </div>  

      {/* Pass the combined 'latestMetric' to the Chat Popup */}
      <ChatPopup latestMetric={latestMetric} token={token} />
    </div>
  );
};