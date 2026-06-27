import { TrendingDown, TrendingUp } from 'lucide-react';
import React, { useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

export interface WellnessDataPoint {
	date: string; // YYYY-MM-DD
	score: number; // 0-100
	type?: string; // assessment type
}

export interface WellnessScoreTrendProps {
	data: WellnessDataPoint[];
	title?: string;
	days?: number; // Show last N days (default 30)
}

export const WellnessScoreTrend: React.FC<WellnessScoreTrendProps> = ({
	data,
	title = 'Wellness Score Trend',
	days = 30
}) => {
	const chartData = useMemo(() => {
		if (!data || data.length === 0) return [];

		const endDate = new Date();
		const startDate = new Date();
		startDate.setDate(endDate.getDate() - days);

		return data
			.filter(d => {
				const entryDate = new Date(d.date);
				return entryDate >= startDate && entryDate <= endDate;
			})
			.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
	}, [data, days]);

	const stats = useMemo(() => {
		if (chartData.length === 0) {
			return { avg: 0, min: 0, max: 0, trend: 0, trendPercent: 0 };
		}

		const scores = chartData.map(d => d.score);
		const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
		const min = Math.min(...scores);
		const max = Math.max(...scores);

		// Calculate trend (comparing first half vs second half)
		const midpoint = Math.floor(scores.length / 2);
		const firstHalf = scores.slice(0, midpoint);
		const secondHalf = scores.slice(midpoint);

		const firstAvg = firstHalf.reduce((sum, s) => sum + s, 0) / firstHalf.length;
		const secondAvg = secondHalf.reduce((sum, s) => sum + s, 0) / secondHalf.length;
		const trend = secondAvg - firstAvg;
		const trendPercent = firstAvg > 0 ? ((trend / firstAvg) * 100) : 0;

		return {
			avg: Math.round(avg),
			min: Math.round(min),
			max: Math.round(max),
			trend: Math.round(trend),
			trendPercent: Math.round(trendPercent)
		};
	}, [chartData]);

	const svgPoints = useMemo(() => {
		if (chartData.length === 0) return '';

		const width = 100;
		const height = 60;
		const padding = 5;

		const xStep = (width - padding * 2) / Math.max(chartData.length - 1, 1);
		const yMin = 0;
		const yMax = 100;
		const yRange = yMax - yMin;

		const points = chartData.map((d, i) => {
			const x = padding + i * xStep;
			const y = height - padding - ((d.score - yMin) / yRange) * (height - padding * 2);
			return `${x},${y}`;
		}).join(' ');

		return points;
	}, [chartData]);

	const areaPath = useMemo(() => {
		if (chartData.length === 0) return '';

		const width = 100;
		const height = 60;
		const padding = 5;

		const xStep = (width - padding * 2) / Math.max(chartData.length - 1, 1);
		const yMin = 0;
		const yMax = 100;
		const yRange = yMax - yMin;

		let path = `M ${padding} ${height - padding}`;

		chartData.forEach((d, i) => {
			const x = padding + i * xStep;
			const y = height - padding - ((d.score - yMin) / yRange) * (height - padding * 2);
			if (i === 0) {
				path += ` L ${x} ${y}`;
			} else {
				path += ` L ${x} ${y}`;
			}
		});

		path += ` L ${padding + (chartData.length - 1) * xStep} ${height - padding}`;
		path += ' Z';

		return path;
	}, [chartData]);

	if (chartData.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">{title}</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						<p className="text-sm">No wellness data yet</p>
						<p className="text-xs mt-1">Complete assessments to see your trend over time</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-lg flex items-center justify-between">
					<span>{title}</span>
					{stats.trend !== 0 && (
						<div className={`flex items-center gap-1 text-sm ${stats.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
							{stats.trend > 0 ? (
								<TrendingUp className="h-4 w-4" />
							) : (
								<TrendingDown className="h-4 w-4" />
							)}
							<span>{stats.trendPercent > 0 ? '+' : ''}{stats.trendPercent}%</span>
						</div>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* SVG Chart */}
				<div className="w-full h-32 relative">
					<svg
						viewBox="0 0 100 60"
						className="w-full h-full"
						preserveAspectRatio="none"
					>
						{/* Grid lines */}
						<line x1="0" y1="15" x2="100" y2="15" stroke="currentColor" strokeWidth="0.1" className="text-muted-foreground/20" />
						<line x1="0" y1="30" x2="100" y2="30" stroke="currentColor" strokeWidth="0.1" className="text-muted-foreground/20" />
						<line x1="0" y1="45" x2="100" y2="45" stroke="currentColor" strokeWidth="0.1" className="text-muted-foreground/20" />

						{/* Area fill */}
						<path
							d={areaPath}
							fill="currentColor"
							className="text-primary/10"
						/>

						{/* Line */}
						<polyline
							points={svgPoints}
							fill="none"
							stroke="currentColor"
							strokeWidth="0.5"
							className="text-primary"
						/>

						{/* Points */}
						{chartData.map((d, i) => {
							const width = 100;
							const height = 60;
							const padding = 5;
							const xStep = (width - padding * 2) / Math.max(chartData.length - 1, 1);
							const yMin = 0;
							const yMax = 100;
							const yRange = yMax - yMin;
							const x = padding + i * xStep;
							const y = height - padding - ((d.score - yMin) / yRange) * (height - padding * 2);

							return (
								<circle
									key={i}
									cx={x}
									cy={y}
									r="0.8"
									fill="currentColor"
									className="text-primary"
								>
									<title>{`${d.date}: ${d.score}`}</title>
								</circle>
							);
						})}
					</svg>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
					<div className="text-center">
						<div className="text-2xl font-semibold text-primary">{stats.avg}</div>
						<div className="text-xs text-muted-foreground">Average</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-semibold">{stats.min}</div>
						<div className="text-xs text-muted-foreground">Lowest</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-semibold">{stats.max}</div>
						<div className="text-xs text-muted-foreground">Highest</div>
					</div>
				</div>

				{/* Trend message */}
				{stats.trend !== 0 && (
					<div className={`text-center text-sm ${stats.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
						{stats.trend > 0 ? '↑' : '↓'} {Math.abs(stats.trend)} points {stats.trend > 0 ? 'improvement' : 'decline'} over time
					</div>
				)}
			</CardContent>
		</Card>
	);
};
