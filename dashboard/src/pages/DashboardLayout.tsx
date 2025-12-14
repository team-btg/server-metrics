import React, { useState, useEffect } from "react";
import { MainTabs } from "../components/navigations/MainTabs"; 
import SettingsModal from '../components/SettingsModal';
import { X } from 'lucide-react'; 
import { useAuth } from "../context/AuthContext";
import TopBarLayout from '../components/navigations/TopBar';
import AppFooter from '../components/navigations/Footer';

interface ServerInfo {
  id: string;
  hostname: string;
}

const DashboardLayout: React.FC = () => {
  const { token, logout } = useAuth(); 

  const [servers, setServers] = useState<ServerInfo[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
 
  const [isClaiming, setIsClaiming] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [claimServerId, setClaimServerId] = useState('');
  const [claimApiKey, setClaimApiKey] = useState('');
  const [claimError, setClaimError] = useState('');

  // Fetch servers on component mount or token change
  useEffect(() => {
    if (token) {
      fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => {
        if (res.status === 401) {
          logout();
          return [];
        }
        return res.json();
      })
      .then((data: ServerInfo[]) => {
        setServers(data); 
      })
      .catch(err => console.error("Failed to fetch servers:", err));
    }
  }, [token, logout]);

  // Callback for when a server is selected from the TopBar dropdown
  const handleServerSelect = (serverId: string) => {
    setSelectedServerId(serverId);
  };

  // Handlers for TopBar actions
  const handleAddServer = () => setIsClaiming(true);
  const handleOpenSettings = () => setIsSettingsOpen(true);
  const handleLogout = () => logout();

  const handleClaimServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimError('');

    if (!token) {
      setClaimError("You are not logged in. Please log in again.");
      logout();
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers/claim`, {
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
    <TopBarLayout
      servers={servers}
      onServerSelect={handleServerSelect}
      onAddServer={handleAddServer}
      onSettings={handleOpenSettings}
      onLogout={handleLogout}
      selectedServerId={selectedServerId}
    >
      {/* The content that used to be next to the Sidebar, now inside TopBarLayout's children */}
      <main className="flex-1 text-gray-200 overflow-y-auto relative p-4"> {/* Added p-4 here */}
        {selectedServerId ? (
          <MainTabs serverId={selectedServerId} token={token || ""} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-semibold">Please Select a Server</h2>
              <p className="text-gray-400">Choose a server from the dropdown above to view its dashboard, or click "Add Server" to claim a new one.</p>
            </div>
          </div>
        )}
        <AppFooter />
      </main>

      {/* Modals remain here */}
      {isClaiming && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-[#1e293b] p-6 rounded-lg shadow-xl max-w-md w-full relative">
            <button onClick={() => setIsClaiming(false)} className="bg-transparent absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24} /></button>
            <h2 className="text-xl font-semibold text-white mb-4">Claim New Server</h2>
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

      {selectedServerId && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          serverId={selectedServerId}
          token={token || ''}
        />
      )}
    </TopBarLayout>
  );
};

export default DashboardLayout;