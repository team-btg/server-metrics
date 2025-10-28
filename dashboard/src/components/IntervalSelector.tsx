import React from 'react';

const intervals = [
  { label: '5s', value: 5000 },
  { label: '15s', value: 15000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '5m', value: 300000 },
];

interface IntervalSelectorProps {
  interval: number;
  setInterval: (interval: number) => void;
}

const IntervalSelector: React.FC<IntervalSelectorProps> = ({ interval, setInterval }) => {
  return (
    <div className="flex items-center space-x-2">
      <label htmlFor="interval" className="text-sm font-medium text-gray-400">
        Interval:
      </label>
      <select
        id="interval"
        value={interval}
        onChange={(e) => setInterval(Number(e.target.value))}
        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2"
      >
        {intervals.map((frame) => (
          <option key={frame.value} value={frame.value}>
            {frame.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default IntervalSelector;