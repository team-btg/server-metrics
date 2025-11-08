import React, { useState, useEffect } from 'react';

// Define the structure of an alert rule
interface AlertRule {
  id: number;
  metric: 'cpu' | 'memory' | 'disk';
  operator: '>' | '<';
  threshold: number;
  duration_minutes: number;
  is_enabled: boolean;
}

interface AlertsManagerProps {
  serverId: string;
  token: string;
}

const AlertsManager: React.FC<AlertsManagerProps> = ({ serverId, token }) => {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // In a real implementation, you would fetch rules from your API
  useEffect(() => {
    const fetchRules = async () => {
      setIsLoading(true);
      setError(null);
      // This is a placeholder. You would replace this with a real API call.
      // For now, we'll simulate an empty list.
      try {
        // const response = await fetch(`/api/v1/alerts/servers/${serverId}`, {
        //   headers: { 'Authorization': `Bearer ${token}` }
        // });
        // if (!response.ok) throw new Error('Failed to fetch rules.');
        // const data = await response.json();
        // setRules(data);
        setRules([]); // Start with an empty list
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRules();
  }, [serverId, token]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-white">Alert Rules</h3>
        <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors">
          Create New Rule
        </button>
      </div>
      <p className="text-gray-400 mb-6">
        Create rules to be notified when a server's metrics cross a defined threshold for a specific duration.
      </p>
      
      {isLoading && <p>Loading rules...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      {!isLoading && !error && (
        <div className="space-y-3">
          {rules.length > 0 ? (
            rules.map(rule => (
              <div key={rule.id} className="bg-gray-900 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <span className="font-mono uppercase bg-gray-700 text-white text-xs font-bold mr-2 px-2.5 py-0.5 rounded">{rule.metric}</span>
                  <span className="text-lg">{rule.operator} {rule.threshold}%</span>
                  <span className="text-gray-400 ml-2">for {rule.duration_minutes} min</span>
                </div>
                <div>
                  {/* Add Edit/Delete buttons here */}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 px-4 border-2 border-dashed border-gray-700 rounded-lg">
              <p className="text-gray-400">No alert rules have been created for this server yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertsManager;