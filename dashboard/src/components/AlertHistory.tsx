import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle } from 'lucide-react';

// Define interfaces to match the backend schemas
interface AlertRule {
  name: string;
  metric: string;
  operator: string;
  threshold: number;
}

interface AlertEvent {
  id: number;
  triggered_at: string;
  resolved_at: string | null;
  rule: AlertRule;
}

interface AlertHistoryProps {
  serverId: string;
  token: string;
}

const fetchAlertEvents = async (serverId: string, token: string): Promise<AlertEvent[]> => {
  const response = await fetch(`http://localhost:8000/api/v1/alerts/events/servers/${serverId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch alert history');
  }
  return response.json();
};

const AlertHistory: React.FC<AlertHistoryProps> = ({ serverId, token }) => {
  const queryClient = useQueryClient(); // Get the query client instance

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['alertEvents', serverId],
    queryFn: () => fetchAlertEvents(serverId, token),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const resolveMutation = useMutation({
    mutationFn: (eventId: number) => {
      return fetch(`http://localhost:8000/api/v1/alerts/events/${eventId}/resolve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
    },
    // After the mutation succeeds, invalidate queries to refetch data
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertEvents', serverId] });
      queryClient.invalidateQueries({ queryKey: ['activeAlertCount', serverId] });
    },
  });

  if (isLoading) return <p className="text-center p-8">Loading alert history...</p>;
  if (error) return <p className="text-center p-8 text-red-500">Error: {error.message}</p>;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Alert History</h2>
      <div className="space-y-4">
        {events && events.length > 0 ? (
          events.map(event => (
            <div key={event.id} className={`p-4 rounded-lg border-l-4 ${event.resolved_at ? 'bg-gray-800 border-green-500' : 'bg-red-900/50 border-red-500'}`}>
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <p className="font-bold text-lg text-white">{event.rule.name}</p>
                  <p className="text-sm text-gray-300">
                    Condition: {event.rule.metric.toUpperCase()} {event.rule.operator} {event.rule.threshold}%
                  </p>
                </div>
                <div className="text-right">
                  <div className={`flex items-center font-semibold ${event.resolved_at ? 'text-green-400' : 'text-red-400'}`}>
                    {event.resolved_at ? <CheckCircle size={18} className="mr-2" /> : <AlertTriangle size={18} className="mr-2" />}
                    {event.resolved_at ? 'Resolved' : 'Firing'}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Triggered: {new Date(event.triggered_at).toLocaleString()}
                  </p>
                  {event.resolved_at ? (
                     <p className="text-xs text-gray-400">
                       Resolved: {new Date(event.resolved_at).toLocaleString()}
                     </p>
                  ) : (
                    // --- Add the Resolve Button ---
                    <button
                      onClick={() => resolveMutation.mutate(event.id)}
                      disabled={resolveMutation.isPending}
                      className="mt-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1 px-3 rounded-md transition-colors disabled:opacity-50"
                    >
                      {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 bg-gray-800 rounded-lg">
            <p className="text-gray-400">No alert events have been recorded for this server.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertHistory;