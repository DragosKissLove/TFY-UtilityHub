import { useEffect, useState } from 'react';
import { Cpu, Monitor } from 'lucide-react';

interface TemperatureGraphProps {
    cpuHistory: number[];
    gpuHistory: number[];
}

export function TemperatureGraph({ cpuHistory, gpuHistory }: TemperatureGraphProps) {
    const [mounted, setMounted] = useState(false);
    const [view, setView] = useState<'cpu' | 'gpu'>('cpu');
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const width = 800;
    const height = 300;
    const padding = { top: 40, right: 20, bottom: 30, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const currentHistory = view === 'cpu' ? cpuHistory : gpuHistory;
    const currentColor = 'var(--accent)';
    const currentGradient = 'url(#accentGradient)';

    // Find min/max for scaling with better baseline
    const validTemps = currentHistory.filter(t => t > 0);
    const minTemp = validTemps.length > 0 ? Math.max(0, Math.min(...validTemps) - 10) : 0;
    const maxTemp = validTemps.length > 0 ? Math.max(...validTemps) + 10 : 100;

    const scaleY = (temp: number) => {
        if (maxTemp === minTemp) return chartHeight / 2;
        return chartHeight - ((temp - minTemp) / (maxTemp - minTemp)) * chartHeight;
    };

    const scaleX = (index: number) => {
        return (index / (currentHistory.length - 1)) * chartWidth;
    };

    const createPath = (data: number[]) => {
        if (data.length === 0) return '';
        const points = data.map((temp, i) => `${scaleX(i)},${scaleY(temp)}`).join(' L ');
        return `M ${points}`;
    };

    const path = createPath(currentHistory);
    const hasData = validTemps.length > 0;

    const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();

        // Calculate position relative to the SVG viewBox, accounting for scaling
        const scaleFactorX = width / rect.width;
        const scaleFactorY = height / rect.height;

        const x = (e.clientX - rect.left) * scaleFactorX - padding.left;

        if (x < 0 || x > chartWidth) {
            setHoverIndex(null);
            return;
        }

        const index = Math.round((x / chartWidth) * (currentHistory.length - 1));
        setHoverIndex(index);
    };

    const handleMouseLeave = () => {
        setHoverIndex(null);
    };

    // Show tooltip at any position
    const tooltipData = hoverIndex !== null ? {
        index: hoverIndex,
        temp: currentHistory[hoverIndex],
        x: scaleX(hoverIndex),
        y: scaleY(currentHistory[hoverIndex]),
    } : null;

    return (
        <div className="w-full h-full flex flex-col">
            {/* Toggle Buttons */}
            <div className="flex items-center gap-2 mb-3">
                <button
                    type="button"
                    onClick={() => setView('cpu')}
                    className={`temp-toggle ${view === 'cpu' ? 'active' : ''}`}
                >
                    <Cpu size={14} />
                    CPU
                </button>
                <button
                    type="button"
                    onClick={() => setView('gpu')}
                    className={`temp-toggle ${view === 'gpu' ? 'active' : ''}`}
                >
                    <Monitor size={14} />
                    GPU
                </button>
            </div>

            {/* Graph */}
            <div className="flex-1 flex items-center justify-center">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-full cursor-crosshair"
                    style={{ maxHeight: '300px' }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                >
                    <defs>
                        <linearGradient id="accentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    <g transform={`translate(${padding.left}, ${padding.top})`}>
                        {/* Grid lines */}
                        {[0, 25, 50, 75, 100].map((percent) => {
                            const y = (percent / 100) * chartHeight;
                            return (
                                <line
                                    key={percent}
                                    x1={0}
                                    y1={y}
                                    x2={chartWidth}
                                    y2={y}
                                    stroke="rgba(255,255,255,0.05)"
                                    strokeWidth="1"
                                />
                            );
                        })}

                        {/* Area fill */}
                        {hasData && (
                            <>
                                <path
                                    d={`${path} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`}
                                    fill={currentGradient}
                                    opacity={mounted ? 1 : 0}
                                    style={{ transition: 'opacity 0.5s ease-in-out' }}
                                />
                                <path
                                    d={path}
                                    fill="none"
                                    stroke={currentColor}
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    opacity={mounted ? 1 : 0}
                                    style={{ transition: 'opacity 0.5s ease-in-out' }}
                                />
                            </>
                        )}

                        {/* Hover tooltip */}
                        {tooltipData && tooltipData.temp > 0 && (
                            <g style={{ transition: 'all 0.15s ease-out' }}>
                                <line
                                    x1={tooltipData.x}
                                    y1={0}
                                    x2={tooltipData.x}
                                    y2={chartHeight}
                                    stroke={currentColor}
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                    opacity="0.5"
                                    style={{ transition: 'all 0.15s ease-out' }}
                                />
                                <circle
                                    cx={tooltipData.x}
                                    cy={tooltipData.y}
                                    r="5"
                                    fill={currentColor}
                                    stroke="white"
                                    strokeWidth="2"
                                    style={{ transition: 'all 0.15s ease-out' }}
                                />
                                <g transform={`translate(${tooltipData.x}, ${tooltipData.y - 20})`} style={{ transition: 'all 0.15s ease-out' }}>
                                    <rect
                                        x="-30"
                                        y="-20"
                                        width="60"
                                        height="18"
                                        fill="color-mix(in srgb, var(--accent) 12%, rgba(6,8,12,0.94))"
                                        stroke={currentColor}
                                        strokeWidth="1"
                                        rx="4"
                                    />
                                    <text
                                        x="0"
                                        y="-8"
                                        textAnchor="middle"
                                        fill="#f3f7ff"
                                        fontSize="11"
                                        fontWeight="600"
                                        fontFamily="system-ui"
                                    >
                                        {Math.round(tooltipData.temp)}°C
                                    </text>
                                </g>
                            </g>
                        )}

                        {/* Y-axis labels */}
                        {[0, 25, 50, 75, 100].map((percent) => {
                            const y = (percent / 100) * chartHeight;
                            const temp = Math.round(minTemp + ((maxTemp - minTemp) * (100 - percent)) / 100);
                            return (
                                <text
                                    key={percent}
                                    x={-10}
                                    y={y}
                                    textAnchor="end"
                                    dominantBaseline="middle"
                                    fill="rgba(255,255,255,0.4)"
                                    fontSize="10"
                                    fontFamily="system-ui"
                                >
                                    {temp}°
                                </text>
                            );
                        })}

                        {/* X-axis label */}
                        <text
                            x={chartWidth / 2}
                            y={chartHeight + 20}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.4)"
                            fontSize="10"
                            fontFamily="system-ui"
                        >
                            Last 60 seconds
                        </text>
                    </g>
                </svg>
            </div>
        </div>
    );
}



