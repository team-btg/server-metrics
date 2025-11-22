import React from 'react';

// Define interfaces for process data
interface Process {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
}

interface ProcessListProps {
  metricPoint: Process[];
}

const ProcessList: React.FC<ProcessListProps> = ({ metricPoint }) => {  
  const processes: Process[] = metricPoint;  

  if (!metricPoint) return <p className="text-center p-8">No process data available.</p>;
  
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white mb-4">Top Processes</h1>
      <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">PID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">CPU %</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Memory %</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {processes.length > 0 ? (
                processes.map((proc) => (
                  <tr key={proc.pid} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{proc.pid}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-white">{proc.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">{proc.cpu_percent.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300">{proc.memory_percent.toFixed(2)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400">
                    No process data available. The agent might be offline or not sending process info.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProcessList;