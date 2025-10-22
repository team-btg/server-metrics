interface CardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
}

export default function Card({ title, value, icon }: CardProps) {
  return (
    <div className="bg-white shadow rounded p-4 flex items-center gap-4">
      {icon && <div className="text-2xl">{icon}</div>}
      <div>
        <p className="text-gray-500">{title}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
