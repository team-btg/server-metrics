import React from 'react';
import type { MetricPoint } from '../hooks/useMetrics';

interface DiskUsageProps {
  metricPoint: MetricPoint[];
}

const DiskUsage: React.FC<DiskUsageProps> = ({ metricPoint }) => {
  const disks = metricPoint.length > 0 && metricPoint[metricPoint.length - 1].disk ? metricPoint[metricPoint.length - 1].disk! : [];

  const getUsageColor = (percent: number) => {
    if (percent > 95) return 'bg-red-600';
    if (percent > 85) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (!metricPoint) {
    return <p className="text-center p-8 text-gray-400">Waiting for metric data...</p>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold text-white mb-4">Disk Usage</h1>
      <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Mountpoint</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Usage</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Used</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {disks.length > 0 ? (
                disks.map((disk) => (
                  <tr key={disk.mountpoint} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-sm font-medium text-white">{disk.mountpoint}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-600 rounded-full h-4">
                          <div
                            className={`h-4 rounded-full ${getUsageColor(disk.percent)}`}
                            style={{ width: `${disk.percent}%` }}
                          ></div>
                        </div>
                        <span className="ml-3 text-sm font-medium text-gray-300">{disk.percent.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400">{disk.used_gb.toFixed(2)} GB</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-400">{disk.total_gb.toFixed(2)} GB</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-gray-400">
                    No disk data available.
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

export default DiskUsage;