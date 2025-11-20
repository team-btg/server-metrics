import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface IncidentFeedProps {
  serverId: string;
}

// Define the unified data structure
interface AlertRule {
  name: string;
  metric: string;
  operator: string;
  threshold: number;
}

interface Incident {
  id: string;
  alert_rule_id: number; // We need this to link to the old resolve endpoint
  status: 'investigating' | 'active' | 'resolved';
  triggered_at: string;
  resolved_at: string | null;
  summary: string | null;
  alert_rule: AlertRule;
}

const fetchIncidents = async (serverId: string, token: string): Promise<Incident[]> => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers/${serverId}/incidents`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Failed to fetch incidents');
  return response.json();
};

const IncidentCard: React.FC<{ incident: Incident; token: string }> = ({ incident, token }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: (incidentId: string) => {
      return fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/servers/incidents/${incidentId}/resolve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents', incident.id.split('-')[0]] }); // Invalidate by serverId
    },
  });

  const statusStyles = {
    investigating: { border: 'border-yellow-500', bg: 'bg-yellow-900/50', text: 'text-yellow-400' },
    active: { border: 'border-red-500', bg: 'bg-red-900/50', text: 'text-red-400' },
    resolved: { border: 'border-green-500', bg: 'bg-gray-800', text: 'text-green-400' },
  };
  const currentStyle = statusStyles[incident.status] || statusStyles.resolved;

  return (
    <div className={`p-4 rounded-lg border-l-4 ${currentStyle.bg} ${currentStyle.border}`}>
      {/* Main Info Row */}
      <div className="flex justify-between items-center">
        <div className="flex-1">
          <p className="font-bold text-lg text-white">{incident.alert_rule.name}</p>
          <p className="text-sm text-gray-300">
            Condition: {incident.alert_rule.metric.toUpperCase()} {incident.alert_rule.operator} {incident.alert_rule.threshold}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Triggered: {new Date(incident.triggered_at).toLocaleString()}
          </p>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className={`flex items-center font-semibold ${currentStyle.text}`}>
            {incident.status === 'resolved' ? <CheckCircle size={18} className="mr-2" /> : <AlertTriangle size={18} className="mr-2" />}
            {incident.status.charAt(0).toUpperCase() + incident.status.slice(1)}
          </div>
          {incident.status !== 'resolved' && (
            <button
              onClick={() => resolveMutation.mutate(incident.id)}
              disabled={resolveMutation.isPending}
              className="mt-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors disabled:opacity-50"
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
            </button>
          )}
        </div>
      </div>

      {/* AI Summary Drilldown */}
      {incident.summary && (
        <div className="mt-3 border-t border-gray-700/50 pt-3">
          <button onClick={() => setIsExpanded(!isExpanded)} className="bg-transparent border-none flex items-center text-sm text-indigo-400 w-full">
            {isExpanded ? <ChevronUp size={16} className="mr-2" /> : <ChevronDown size={16} className="mr-2" />}
            {isExpanded ? 'Hide AI Analysis' : 'Show AI Analysis'}
          </button>
          {isExpanded && (
            <div className="prose prose-invert prose-sm max-w-none text-gray-300 mt-2 pl-6">
              <ReactMarkdown>{incident.summary}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const IncidentFeed: React.FC<IncidentFeedProps> = ({ serverId }) => {
  const { token } = useAuth();
  const { data: incidents, isLoading, error } = useQuery({
    queryKey: ['incidents', serverId],
    queryFn: () => fetchIncidents(serverId, token!),
    enabled: !!token,
    refetchInterval: 30000,
  });

  if (isLoading) return <p className="text-center p-8 text-gray-400">Loading incident history...</p>;
  if (error) return <p className="text-center p-8 text-red-500">Error: {error.message}</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Incident History</h2>
      <div className="space-y-4">
        {incidents && incidents.length > 0 ? (
          incidents.map(incident => <IncidentCard key={incident.id} incident={incident} token={token!} />)
        ) : (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <p className="text-gray-400">No incidents have been recorded for this server.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IncidentFeed;