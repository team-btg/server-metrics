import React from 'react';

interface GeneralSettingsProps {
  serverId: string;
  token: string;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ serverId, token }) => {
  return (
    <div>
      <h3 className="text-xl font-semibold text-white mb-4">General Server Settings</h3>
      <div className="bg-gray-900 p-6 rounded-lg">
        <p className="text-gray-400">
          Future settings for managing this server, such as changing its name, tags, or deleting it, will appear here.
        </p>
        <div className="mt-4">
          <p className="text-sm text-gray-500">Server ID: {serverId}</p>
        </div>
      </div>
    </div>
  );
};

export default GeneralSettings;