import React, { useState, useEffect } from 'react';

interface GeneralSettingsProps {
  serverId: string;
  token: string;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ serverId, token }) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookFormat, setWebhookFormat] = useState('slack_discord'); // <-- Add state for format
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    // Fetch the current server settings when the component loads
    const fetchServer = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers/${serverId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setWebhookUrl(data.webhook_url || '');
        setWebhookFormat(data.webhook_format || 'slack_discord'); // <-- Load format
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
          webhook_format: webhookFormat // <-- Send format
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

  if (isLoading) {
    return <p>Loading settings...</p>;
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-white mb-4">Notification Settings</h3>
      <div className="bg-gray-900 p-6 rounded-lg space-y-6">
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
    </div>
  );
};

export default GeneralSettings;