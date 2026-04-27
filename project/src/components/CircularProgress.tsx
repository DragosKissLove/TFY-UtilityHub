interface CircularProgressProps {
  percentage: number;
  label: string;
  color?: string;
}

export function CircularProgress({
  percentage,
  label,
  color = '#24bf97',
}: CircularProgressProps) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="45"
            stroke="#333"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="60"
            cy="60"
            r="45"
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="ring-value text-center">
            {percentage}%
          </span>
        </div>
      </div>
      <p className="text-gray-400 text-sm mt-3">{label}</p>
    </div>
  );
}










