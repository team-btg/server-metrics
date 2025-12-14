import React, { useState } from "react";
import { PlusCircle, Settings, LogOut } from 'lucide-react';
 
interface Server {
  id: string;
  hostname: string; 
}
 
interface TopBarLayoutProps {
  servers: Server[];  
  onServerSelect: (serverId: string) => void; 
  onAddServer: () => void; 
  onSettings: () => void; 
  onLogout: () => void; 
  children: React.ReactNode; 
  selectedServerId: string | null; 
}

const TopBarLayout: React.FC<TopBarLayoutProps> = ({ 
  servers, 
  onServerSelect, 
  onAddServer, 
  onSettings, 
  onLogout, 
  children,
  selectedServerId 
}) => {
  const [search, setSearch] = useState("");
 
  // Filter servers by search
  const filteredServers = servers.filter(s =>
    s.hostname.toLowerCase().includes(search.toLowerCase())
  );
 
  return (
    <div className="min-h-screen bg-[#0f172a] text-gray-200">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between px-6 py-1 bg-[#1e293b] shadow">
        {/* Server Dropdown */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search server..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-2 py-1 rounded bg-[#334155] text-white"
          />
          <select
            value={selectedServerId ?? ""} // Use the prop here
            onChange={e => onServerSelect(e.target.value)}  
            className="px-2 py-1 rounded bg-[#334155] text-white"
          >
            <option value="" disabled>Select server...</option>
            {/* Display "No servers available" if the list is empty and not searching */}
            {filteredServers.length === 0 && search === "" && (
                <option disabled>No servers available</option>
            )}
            {/* Display "No results" if searching and no matches */}
            {filteredServers.length === 0 && search !== "" && (
                <option disabled>No results for "{search}"</option>
            )}
            {filteredServers.map(server => (
              <option key={server.id} value={server.id}>{server.hostname}</option>
            ))}
          </select>
        </div>
        {/* Actions */}
        <div className="flex items-center space-x-4">
          <button onClick={onAddServer} title="Add Server" className="bg-transparent p-1 rounded-lg text-gray-400 hover:text-white focus:outline-none"><PlusCircle /></button>
          <button onClick={onSettings} title="Settings" className="bg-transparent p-1 rounded-lg text-gray-400 hover:text-blue-400 focus:outline-none"><Settings /></button>
          <button onClick={onLogout} title="Logout" className="bg-transparent p-1 rounded-lg text-gray-400 hover:text-red-400 focus:outline-none"><LogOut /></button>
        </div>
      </div> 
    </div>
  );
};

export default TopBarLayout;