import React, { useState } from "react";
import { Dashboard } from "./Dashboard";
import { Logs } from "./Logs";
import ProcessList from './ProcessList';

interface MainTabsProps {
  serverId: string;
  token?: string;
}

export const MainTabs: React.FC<MainTabsProps> = ({ serverId, token }) => {
  const [tab, setTab] = useState("dashboard"); 
  const renderContent = () => {
    switch (tab) {
      case 'dashboard':
        return <Dashboard serverId={serverId} token={token} />;
      case 'logs':
        return <Logs serverId={serverId} token={token} />;
      case 'processes':
        // Pass the processes from the latest metric to the ProcessList component
        return <ProcessList serverId={serverId} token={token} />;
      default:
        return <Dashboard serverId={serverId} token={token} />;
    }
  };
  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200">
      {/* Folder-style Tab Bar */}
      <div className="flex space-x-1 px-4 pt-2">
        <button
          className={`relative px-4 py-2 rounded-t-lg border border-b-0 transition-all duration-200 ${
            tab === "dashboard" 
              ? "bg-[#1e293b] border-gray-600 text-white shadow-lg" 
              : "bg-[#0f172a] border-transparent text-gray-400 hover:text-gray-300 hover:bg-[#1a2436]"
          }`}
          onClick={() => setTab("dashboard")}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>Dashboard</span>
          </div>
          {tab === "dashboard" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
          )}
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Logs</span>
          </div>
          {tab === "logs" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
          )}
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Processes</span>
          </div>
          {tab === "processes" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
          )}
        </button> 
      </div>

      {/* Tab Content Area */}
      <div className="rounded-b-lg rounded-tr-lg shadow-xl min-h-[calc(100vh-80px)]">
        {renderContent()}
      </div>
    </div>
  );
};