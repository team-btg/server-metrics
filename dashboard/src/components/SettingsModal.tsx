import React, { useState } from 'react';
import { X } from 'lucide-react';
import AlertsManager from './AlertsManager';
import GeneralSettings from './GeneralSettings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverId: string;
  token: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, serverId, token }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'alerts'>('general');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e293b] rounded-lg shadow-xl max-w-4xl w-full relative border border-gray-700 flex flex-col h-[80vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Server Settings</h2>
          <button onClick={onClose} className="bg-transparent text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-grow overflow-hidden">
          {/* Left side: Tab navigation */}
          <div className="w-1/4 border-r border-gray-700 p-4">
            <nav className="flex flex-col space-y-2">
              <button
                onClick={() => setActiveTab('general')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'general' ? 'bg-blue-600 text-white' : 'text-gray-300 bg-gray-700'
                }`}
              >
                General
              </button>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'alerts' ? 'bg-blue-600 text-white' : 'text-gray-300 bg-gray-700'
                }`}
              >
                Alerts
              </button>
            </nav>
          </div>

          {/* Right side: Tab content */}
          <div className="w-3/4 p-6 overflow-y-auto">
            {activeTab === 'general' && <GeneralSettings serverId={serverId} token={token} />}
            {activeTab === 'alerts' && <AlertsManager serverId={serverId} token={token} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;