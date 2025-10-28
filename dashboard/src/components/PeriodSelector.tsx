import React from 'react';

const periods = [
  { label: 'Last 15 Minutes', value: '15m' },
  { label: 'Last Hour', value: '1h' },
  { label: 'Last 6 Hours', value: '6h' },
  { label: 'Last 24 Hours', value: '24h' },
];

interface PeriodSelectorProps {
  period: string;
  setPeriod: (period: string) => void;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ period, setPeriod }) => {
  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="period" className="text-sm font-medium text-gray-400">
        Period:
      </label>
      <select
        id="period"
        value={period}
        onChange={(e) => setPeriod(e.target.value)}
        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
      >
        {periods.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PeriodSelector;