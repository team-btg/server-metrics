import React, { useState } from "react";
import { useMetrics } from "../hooks/useMetrics"; 
  
interface ProcessListProps {
  serverId: string;
  token?: string;
}

const ProcessList: React.FC<ProcessListProps> = ({ serverId, token }) => {
  const [period, setPeriod] = useState('1h');
  const [interval, setInterval] = useState(5000);
  const [maximizedChart, setMaximizedChart] = useState<string | null>(null);
 
  const metrics = useMetrics(serverId, period, interval, token); 
  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  if (!latestMetric) {
    return <div className="text-center text-gray-400 p-8">No process data available.</div>;
  }
  const processes = latestMetric.processes || [];
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4 text-white">Top Processes by CPU</h3>
      <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-700 text-xs uppercase font-semibold text-gray-300">
            <tr>
              <th className="px-6 py-3 text-left">PID</th>
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-right">CPU %</th>
              <th className="px-6 py-3 text-right">Memory %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {processes.map((proc) => (
              <tr key={proc.pid} className="hover:bg-gray-700/50">
                <td className="px-6 py-4 whitespace-nowrap text-gray-300">{proc.pid}</td>
                <td className="px-6 py-4 whitespace-nowrap font-medium text-white">{proc.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">{proc.cpu_percent.toFixed(2)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-gray-300">{proc.memory_percent.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProcessList;