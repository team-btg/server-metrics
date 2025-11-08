import React, { useState } from "react";
import { Dashboard } from "./Dashboard";
import { Logs } from "./Logs";
import ProcessList from './ProcessList';
import PeriodSelector from './PeriodSelector';
import IntervalSelector from './IntervalSelector';
import { useMetrics } from "../hooks/useMetrics";   
import ChatPopup from "./ChatPopup";

interface MainTabsProps {
  serverId: string;
  token?: string;
}

export const MainTabs: React.FC<MainTabsProps> = ({ serverId, token }) => {
  const [tab, setTab] = useState("dashboard"); 
  const [period, setPeriod] = useState('1h');
  const [interval, setInterval] = useState(5000); 

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
  
  const renderContent = () => {
    switch (tab) {
      case 'dashboard':
        return <Dashboard metricPoint={metrics} token={token} />;
      case 'logs':
        return <Logs serverId={serverId} token={token} />;
      case 'processes':
        // Pass the processes from the latest metric to the ProcessList component
        return <ProcessList metricPoint={metrics} />;
      default:
        return <Dashboard metricPoint={metrics} token={token} />;
    }
  };
  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200">
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
              <span>Dashboard</span>
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
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
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              <span>Processes</span>
            </div>
            {tab === "processes" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>}
          </button> 
        </div>

        {/* Right side: Status and Selectors */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className={`relative flex h-3 w-3`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${systemStatus.bgColor} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${systemStatus.bgColor}`}></span>
            </span>
            {/* Hide status text on small screens to save space */}
            <span className={`hidden sm:block font-semibold ${systemStatus.color}`}>{systemStatus.text}</span> 
          </div>
          {/* Hide selectors on small screens, show them on medium screens and up */}
          <div className="hidden md:flex items-center space-x-2">
            <PeriodSelector period={period} setPeriod={setPeriod} />
            <IntervalSelector interval={interval} setInterval={setInterval} />
          </div> 
        </div>
      </div> 
      
      {/* Tab Content Area */}
      <div className="bg-[#1e293b] rounded-b-lg rounded-tr-lg shadow-xl min-h-[calc(100vh-80px)]">
        {renderContent()}
      </div>  

      {/* Add the Chat Popup Component Here */}
      <ChatPopup latestMetric={latestMetric} token={token} />
    </div>
  );
};