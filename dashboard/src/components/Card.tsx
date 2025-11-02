import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface CardProps {
  title: string;
  value: number;
  unit?: string;
}

export default function Card({ title, value, unit = '%' }: CardProps) {
  // Determine color based on value for visual feedback
  const getColor = (val: number) => {
    if (val > 90) return '#ef4444'; // red-500
    if (val > 70) return '#f97316'; // orange-500
    return '#22c55e'; // green-500
  };

  const pathColor = getColor(value);

  return (
    <div className="p-4 flex flex-col items-center justify-center gap-2 aspect-square size-32">
      <div style={{ width: '60%' }}>
        <CircularProgressbar
          value={value}
          text={`${Math.round(value)}${unit}`}
          circleRatio={0.75}
          strokeWidth={8}
          styles={buildStyles({
            textColor: '#374151', // gray-700
            pathColor: pathColor,
            trailColor: '#e5e7eb', // gray-200
            textSize: '28px',
            strokeLinecap: 'round',
            rotation: 1 / 2 + 1 / 8,
          })}
        />
      </div>
      <p className="text-gray-500 font-semibold text-[12px] text-center mt-2">{title}</p>
    </div>
  );
}
