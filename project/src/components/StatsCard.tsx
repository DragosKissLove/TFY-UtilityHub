import { CircularProgress } from './CircularProgress';

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  progress?: number;
  color?: string;
  delay?: number;
}

export function StatsCard({
  icon,
  label,
  value,
  progress,
  color,
  delay = 0,
}: StatsCardProps) {
  return (
    <div
      className="glass-dark rounded-2xl p-8 group hover:border-accent/50 transition-all duration-500 overflow-hidden relative animate-fadeIn"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute inset-0 gradient-accent opacity-0 group-hover:opacity-5 transition-opacity duration-500"></div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 glass rounded-xl text-accent group-hover:shadow-lg group-hover:shadow-accent/20 transition-all duration-300">
            {icon}
          </div>
          <span className="text-gray-400 text-sm font-medium">{label}</span>
        </div>

        {progress !== undefined ? (
          <div className="flex flex-col items-center justify-center py-4">
            <CircularProgress percentage={progress} label="" color={color} />
          </div>
        ) : (
          <div className="text-4xl font-bold text-white group-hover:text-accent transition-colors duration-300">
            {value}
          </div>
        )}
      </div>
    </div>
  );
}
