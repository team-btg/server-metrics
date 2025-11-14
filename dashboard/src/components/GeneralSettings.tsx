import React, { useState, useEffect } from 'react';

interface GeneralSettingsProps {
  serverId: string;
  token: string;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ serverId, token }) => {
  const [serverData, setServerData] = useState<any>(null); // Store full server object
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookFormat, setWebhookFormat] = useState('slack_discord');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // --- New state for unregister functionality ---
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);
  const [unregisterError, setUnregisterError] = useState('');

  useEffect(() => {
    // Fetch the current server settings when the component loads
    const fetchServer = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers/${serverId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setServerData(data); // <-- Save the full server object
        setWebhookUrl(data.webhook_url || '');
        setWebhookFormat(data.webhook_format || 'slack_discord');
      } catch (error) {
        console.error("Failed to fetch server settings", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchServer();
  }, [serverId, token]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers/${serverId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          webhook_url: webhookUrl,
          webhook_format: webhookFormat
        })
      });
      if (!response.ok) throw new Error('Failed to save settings.');
      setSaveMessage('Settings saved successfully!');
    } catch (error) {
      setSaveMessage('Error saving settings.');
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 3000); // Clear message after 3 seconds
    }
  };

  // --- New function to handle server unregistration ---
  const handleUnregister = async () => {
    setIsUnregistering(true);
    setUnregisterError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers/${serverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok && response.status !== 204) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Failed to unregister server');
      }

      // On success, redirect to the home page
      window.location.href = '/';

    } catch (err: any) {
      setUnregisterError(err.message);
      setIsUnregistering(false);
    }
  };

  if (isLoading) {
    return <p>Loading settings...</p>;
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-white mb-4">Notification Settings</h3>
      <div className="bg-gray-900 p-6 rounded-lg space-y-6">
        {/* ... existing notification settings form ... */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="webhookUrl" className="block text-sm font-medium text-gray-300">
              Webhook URL
            </label>
            <input
              type="url"
              id="webhookUrl"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="Paste your webhook URL here"
              className="mt-1 block w-full bg-gray-800 border-gray-600 rounded-md text-white"
            />
          </div>
          <div>
            <label htmlFor="webhookFormat" className="block text-sm font-medium text-gray-300">
              Format
            </label>
            <select
              id="webhookFormat"
              value={webhookFormat}
              onChange={(e) => setWebhookFormat(e.target.value)}
              className="mt-1 block w-full bg-gray-800 border-gray-600 rounded-md text-white"
            >
              <option value="slack_discord">Slack & Discord</option>
              <option value="teams">Microsoft Teams</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Enter a webhook URL and select the matching format to receive alert notifications.
        </p>
        
        <div className="flex items-center justify-end">
          {saveMessage && <p className="text-sm text-gray-400 mr-4">{saveMessage}</p>}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* --- DANGER ZONE --- */}
      <div className="mt-12 pt-6 border-t border-red-500/30">
        <h3 className="text-xl font-semibold text-red-400 mb-4">Danger Zone</h3>
        <div className="bg-gray-900 p-6 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-200">Unregister this server</p>
            <p className="text-xs text-gray-400">This action is permanent and will delete all associated data.</p>
          </div>
          <button
            onClick={() => setIsConfirmOpen(true)}
            className="bg-red-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            Unregister Server
          </button>
        </div>
      </div>

      {/* --- CONFIRMATION MODAL --- */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-white">Are you sure?</h3>
            <p className="mt-2 text-sm text-gray-400">
              This will permanently delete the server '{serverData?.hostname || serverId}' and all of its historical data. This action cannot be undone.
            </p>
            {unregisterError && <p className="text-sm text-red-500 mt-4">{unregisterError}</p>}
            <div className="mt-6 flex justify-end space-x-4">
              <button
                onClick={() => setIsConfirmOpen(false)}
                disabled={isUnregistering}
                className="py-2 px-4 border border-gray-600 text-sm font-medium rounded-md text-gray-300 bg-gray-700 focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={handleUnregister}
                disabled={isUnregistering}
                className="py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-700 focus:outline-none disabled:opacity-50"
              >
                {isUnregistering ? 'Unregistering...' : 'Yes, Unregister'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralSettings;