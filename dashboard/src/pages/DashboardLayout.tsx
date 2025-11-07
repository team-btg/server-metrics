import React, { useState, useEffect } from "react";
import { MainTabs } from "../components/MainTabs"; 
import Sidebar from '../components/Sidebar';
import { Server, PlusCircle, X, LogOut } from 'lucide-react';
import { useAuth } from "../context/AuthContext";

interface ServerInfo {
  id: string;
  hostname: string;
} 

const DashboardLayout: React.FC = () => {
  const { token, logout } = useAuth();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(true);  
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimServerId, setClaimServerId] = useState('');
  const [claimApiKey, setClaimApiKey] = useState('');
  const [claimError, setClaimError] = useState('');

  useEffect(() => {
    if (token) {
      fetch('http://localhost:8000/api/v1/servers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (res.status === 401) {
          // If token is invalid, log the user out
          logout();
          return [];
        }
        return res.json();
      })
      .then((data: ServerInfo[]) => {
        setServers(data);
        if (data.length > 0 && !selectedServerId) {
          setSelectedServerId(data[0].id);
        }
      })
      .catch(err => console.error("Failed to fetch servers:", err));
    }
  }, [token, logout]);

  const handleClaimServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError('');

    if (!token) {
      setClaimError("You are not logged in. Please log in again.");
      logout(); 
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/v1/servers/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ server_id: claimServerId, api_key: claimApiKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Claim failed. Check your Server ID and API Key.');
      }
      
      const newServer: ServerInfo = await response.json(); 
      setServers(prev => [...prev, newServer]);
      setSelectedServerId(newServer.id); 
      setIsClaiming(false);
      setClaimServerId('');
      setClaimApiKey('');

    } catch (error: any) {
      setClaimError(error.message);
    }
  };

return (
    <div className="h-screen flex bg-[#0f172a]">
      <Sidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        isMinimized={isSidebarMinimized}
        setIsMinimized={setIsSidebarMinimized}
      >
        {/* This flex container correctly pushes the logout button to the bottom */}
        <div className="flex flex-col h-full">
          {/* Server List (make this scrollable if the list gets too long) */}
          <div className="flex-grow px-2 py-4 space-y-2 overflow-y-auto">
            <h3 className={`px-4 mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase ${isSidebarMinimized ? 'hidden' : 'block'}`}>
              Servers
            </h3>
            {servers.map(server => (
              <button key={server.id} onClick={() => setSelectedServerId(server.id)} className={`w-full flex items-center p-2 space-x-3 rounded-md transition-colors ${selectedServerId === server.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                <Server size={20} />
                {!isSidebarMinimized && <span>{server.hostname}</span>}
              </button>
            ))}
            <button onClick={() => setIsClaiming(true)} className={`w-full flex items-center p-2 space-x-3 rounded-md text-gray-300 bg-gray-700 transition-colors`}>
              <PlusCircle size={20} />
              {!isSidebarMinimized && <span>Add Server</span>}
            </button>
          </div>
          {/* Logout Button Section */}
          <div className="px-2 py-4 border-t border-gray-700">
            <button 
              onClick={logout} 
              className={`w-full flex items-center p-2 space-x-3 rounded-md text-gray-300 bg-red-600 hover:text-white transition-colors`}
            >
              <LogOut size={20} />
              {!isSidebarMinimized && <span>Logout</span>}
            </button>
          </div>
        </div>
      </Sidebar>

      {/* Make the main content area the scrollable part */}
      <main className="flex-1 text-gray-200 overflow-y-auto relative">
        {selectedServerId ? (
          <MainTabs serverId={selectedServerId} token={token || ""} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-semibold">No Servers Found</h2>
              <p className="text-gray-400">Click "Add Server" in the sidebar to claim your first agent.</p>
            </div>
          </div>
        )}
      </main>

      {/* Claim Server Modal */}
      {isClaiming && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] p-6 rounded-lg shadow-xl max-w-md w-full relative">
            <button onClick={() => setIsClaiming(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24} /></button>
            <h2 className="text-xl font-bold mb-4">Claim New Server</h2>
            <p className="text-gray-400 mb-6">Enter the details provided by the agent.</p>
            <form onSubmit={handleClaimServer}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="serverId" className="block text-sm font-medium text-gray-300">Server ID</label>
                  <input type="text" id="serverId" value={claimServerId} onChange={(e) => setClaimServerId(e.target.value)} required className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300">API Key</label>
                  <input type="text" id="apiKey" value={claimApiKey} onChange={(e) => setClaimApiKey(e.target.value)} required className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              {claimError && <p className="mt-4 text-sm text-red-500">{claimError}</p>}
              <div className="mt-6">
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors">Claim Server</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;