import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface LogEntry {
  id: string;
  time: Date;
  level: string;
  source: string;
  event_id: string;
  message: string;
}

interface LogsProps {
  serverId: string;
  token?: string;
}

const fetchLogs = async (serverId: string, token: string): Promise<LogEntry[]> => {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/logs/${serverId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch logs');
  }
  return response.json();
};

export const Logs: React.FC<LogsProps> = ({ serverId, token }) => {
  const { data: logs = [], isLoading, error } = useQuery({
    queryKey: ['logs', serverId],
    queryFn: () => fetchLogs(serverId, token || ''),
    enabled: !!token,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
 
  const [page, setPage] = useState(0);
  const rowsPerPage = 25;
  const totalPages = Math.ceil(logs.length / rowsPerPage);
  const paginatedLogs = logs.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const getLevelColor = (level: string) => {
    const lowerLevel = level.toLowerCase();
    if (lowerLevel.includes('error') || lowerLevel === '1') return 'bg-red-500';
    if (lowerLevel.includes('warn') || lowerLevel === '2') return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  if (isLoading) return <p className="text-center p-8">Loading logs...</p>;
  if (error) return <p className="text-center p-8 text-red-500">Error: {error.message}</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white mb-4">Event Logs</h1>
      <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Timestamp</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Level</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Source</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Message</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {paginatedLogs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{new Date(log.time).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white ${getLevelColor(log.level)}`}>
                      {log.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{log.source}</td>
                  <td className="px-6 py-4 text-sm text-gray-300 font-mono">{log.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        <div className="bg-gray-900 px-4 py-3 flex items-center justify-between border-t border-gray-700 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            {/* Mobile pagination (simple) */}
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-400">
                Showing <span className="font-medium">{page * rowsPerPage + 1}</span> to <span className="font-medium">{Math.min((page + 1) * rowsPerPage, logs.length)}</span> of{' '}
                <span className="font-medium">{logs.length}</span> results
              </p>
            </div>
            <div>
              <nav className="flex center relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-700 bg-gray-800 text-sm font-medium text-gray-400 hover:bg-gray-700 disabled:opacity-50">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-700 bg-gray-800 text-sm font-medium text-gray-400 hover:bg-gray-700 disabled:opacity-50">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};