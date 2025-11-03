import React, { useState, useEffect } from "react";
import { MainTabs } from "../components/MainTabs"; 
import Sidebar from '../components/Sidebar';
import { Menu, Server, PlusCircle, X } from 'lucide-react';

interface ServerInfo {
  id: string;
  hostname: string;
} 

const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(true);  
  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimServerId, setClaimServerId] = useState('');
  const [claimApiKey, setClaimApiKey] = useState('');
  const [claimError, setClaimError] = useState('');

  useEffect(() => {
    // Fetch servers on component mount
    // This assumes you have a GET /api/v1/servers endpoint
    fetch('/api/v1/servers')
      .then(res => res.json())
      .then((data: ServerInfo[]) => {
        setServers(data);
        if (data.length > 0 && !selectedServerId) {
          setSelectedServerId(data[0].id); // Select the first server by default
        }
      })
      .catch(err => console.error("Failed to fetch servers:", err));
  }, []);

  const handleClaimServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError('');

    try {
      const response = await fetch('http://localhost:8000/api/v1/servers/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id: claimServerId, api_key: claimApiKey }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Claim failed. Check your Server ID and API Key.');
      }
      
      const newServer: ServerInfo = await response.json();
      
      // Add to state and select it
      setServers(prev => [...prev, newServer]);
      setSelectedServerId(newServer.id);
      
      // Close modal and reset form
      setIsClaiming(false);
      setClaimServerId('');
      setClaimApiKey('');

    } catch (error: any) {
      setClaimError(error.message);
    }
  };

  return (
    <div className="relative min-h-screen md:flex">
      {/* Mobile menu button */}
      <div className="bg-gray-800 text-gray-100 flex justify-between md:hidden">
        <a href="#" className="block p-4 text-white font-bold">Metrics</a>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-4 focus:outline-none bg-gray-700">
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar */}
      <Sidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        isMinimized={isSidebarMinimized}
        setIsMinimized={setIsSidebarMinimized}
      >
        {/* Server List */}
        <div className="flex-grow px-2 py-4 space-y-2 overflow-y-auto">
          <h3 className={`px-4 mb-2 text-xs font-semibold tracking-wider text-gray-400 uppercase ${isSidebarMinimized ? 'hidden' : 'block'}`}>
            Servers
          </h3>
          {servers.map(server => (
            <button
              key={server.id}
              onClick={() => setSelectedServerId(server.id)}
              className={`w-full flex items-center p-2 space-x-3 rounded-md transition-colors ${
                selectedServerId === server.id ? 'bg-blue-600 text-white' : 'text-gray-300 bg-gray-700'
              }`}
            >
              <Server size={20} />
              {!isSidebarMinimized && <span>{server.hostname}</span>}
            </button>
          ))}
          <button
            onClick={() => setIsClaiming(true)}
            className={`w-full flex items-center p-2 space-x-3 rounded-md text-gray-300 bg-gray-700 transition-colors`}
          >
            <PlusCircle size={20} />
            {!isSidebarMinimized && <span>Add Server</span>}
          </button>
        </div>
      </Sidebar>

      {/* Main content */}
      <main className="flex-1 text-gray-200">
        {selectedServerId ? (
          <MainTabs serverId={selectedServerId} token={""} />
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
            <button onClick={() => setIsClaiming(false)} className="absolute top-4 right-4 bg-transparent text-gray-400 hover:text-white focus:outline-none">
              <X size={24} />
            </button>
            <h2 className="text-xl text-green-400 ont-bold mb-4">Claim New Server</h2>
            <p className="text-gray-400 mb-6">Enter the details provided by the agent after its first run.</p>
            
            <form onSubmit={handleClaimServer}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="serverId" className="block text-sm font-medium text-gray-300">Server ID</label>
                  <input
                    type="text"
                    id="serverId"
                    value={claimServerId}
                    onChange={(e) => setClaimServerId(e.target.value)}
                    required
                    className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300">API Key</label>
                  <input
                    type="text"
                    id="apiKey"
                    value={claimApiKey}
                    onChange={(e) => setClaimApiKey(e.target.value)}
                    required
                    className="mt-1 block w-full bg-gray-900 border border-gray-700 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              {claimError && <p className="mt-4 text-sm text-red-500">Incorrect Server ID or API Key</p>}
              <div className="mt-6">
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
                  Claim Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;