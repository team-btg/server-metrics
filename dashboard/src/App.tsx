import './App.css'
import React, { useState } from "react";
import { MainTabs } from "./components/MainTabs"; 
import Sidebar from './components/Sidebar';
import { Menu } from 'lucide-react';

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(true); 
  const serverId = "b11f5078-a6e3-426c-a369-ad9389e6f0b9"; // replace with actual server_id
  const token = ""; // optional JWT token if required

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
      />

      {/* Main content */}
      <main className="flex-1">
        <MainTabs serverId={serverId} token={token} />
      </main>
    </div>
  );
};

export default App;
