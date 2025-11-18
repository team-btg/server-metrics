import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';

interface IncidentHistoryProps {
  serverId: string;
}

// Define the structure of the incident data
interface AlertRule {
  name: string;
}

interface Incident {
  id: string;
  status: 'investigating' | 'active' | 'resolved';
  triggered_at: string;
  summary: string | null;
  alert_rule: AlertRule;
}

const statusStyles = {
  investigating: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  active: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const IncidentHistory: React.FC<IncidentHistoryProps> = ({ serverId }) => {
  const { token } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!serverId || !token) return;

    const fetchIncidents = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers/${serverId}/incidents`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch incidents.');
        }

        const data: Incident[] = await response.json();
        setIncidents(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIncidents();
    // Optional: Set up polling to refresh incidents periodically
    const interval = setInterval(fetchIncidents, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);

  }, [serverId, token]);

  if (isLoading && incidents.length === 0) {
    return <div className="text-center p-8 text-gray-400">Loading incidents...</div>;
  }

  if (error) {
    return <div className="text-center p-8 text-red-500">Error: {error}</div>;
  }

  if (incidents.length === 0) {
    return <div className="text-center p-8 text-gray-400">No incidents recorded for this server.</div>;
  }

  return (
    <div className="space-y-6 p-4">
      {incidents.map((incident) => (
        <div key={incident.id} className={`bg-gray-900/50 border rounded-lg shadow-lg overflow-hidden ${statusStyles[incident.status]}`}>
          <div className="p-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-xl font-bold text-white">{incident.alert_rule.name}</h3>
                <p className="text-sm text-gray-400">
                  Triggered at: {new Date(incident.triggered_at).toLocaleString()}
                </p>
              </div>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase ${statusStyles[incident.status]}`}>
                {incident.status}
              </span>
            </div>
            <div className="mt-4 border-t border-gray-700 pt-4">
              {incident.summary ? (
                <div className="prose prose-invert prose-sm max-w-none text-gray-300">
                  <ReactMarkdown>{incident.summary}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-yellow-400">
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>AI analysis in progress...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default IncidentHistory;