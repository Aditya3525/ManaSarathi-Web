import React, { useMemo } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';

export interface AssessmentScore {
	type: string;
	label: string;
	score: number;
	date: string;
	maxScore?: number;
}

export interface AssessmentComparisonChartProps {
	scores: AssessmentScore[];
	title?: string;
}

const ASSESSMENT_COLORS: Record<string, { bar: string; bg: string; text: string }> = {
	anxiety: { bar: 'bg-red-500', bg: 'bg-red-500/10', text: 'text-red-700' },
	depression: { bar: 'bg-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-700' },
	stress: { bar: 'bg-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-700' },
	overthinking: { bar: 'bg-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-700' },
	trauma: { bar: 'bg-pink-500', bg: 'bg-pink-500/10', text: 'text-pink-700' },
	emotional_intelligence: { bar: 'bg-green-500', bg: 'bg-green-500/10', text: 'text-green-700' },
	personality: { bar: 'bg-blue-500', bg: 'bg-blue-500/10', text: 'text-blue-700' },
	default: { bar: 'bg-gray-500', bg: 'bg-gray-500/10', text: 'text-gray-700' }
};

const getAssessmentColor = (type: string) => {
	const key = type.toLowerCase().split('_')[0];
	return ASSESSMENT_COLORS[key] || ASSESSMENT_COLORS.default;
};

const getScoreInterpretation = (score: number): { label: string; color: string } => {
	if (score >= 80) {
		return { label: 'Excellent', color: 'text-green-600' };
	} else if (score >= 60) {
		return { label: 'Moderate', color: 'text-yellow-600' };
	} else if (score >= 40) {
		return { label: 'Fair', color: 'text-orange-600' };
	} else {
		return { label: 'Needs Attention', color: 'text-red-600' };
	}
};

export const AssessmentComparisonChart: React.FC<AssessmentComparisonChartProps> = ({
	scores,
	title = 'Assessment Comparison'
}) => {
	const sortedScores = useMemo(() => {
		return [...scores].sort((a, b) => b.score - a.score);
	}, [scores]);

	const averageScore = useMemo(() => {
		if (scores.length === 0) return 0;
		const sum = scores.reduce((acc, s) => acc + s.score, 0);
		return Math.round(sum / scores.length);
	}, [scores]);

	if (scores.length === 0) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-lg">{title}</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						<p className="text-sm">No assessment data available</p>
						<p className="text-xs mt-1">Complete multiple assessments to see comparisons</p>
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
					<div className="text-sm font-normal text-muted-foreground">
						Avg: <span className="font-semibold text-foreground">{averageScore}</span>
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{sortedScores.map((assessment, index) => {
					const colors = getAssessmentColor(assessment.type);
					const interpretation = getScoreInterpretation(assessment.score);
					const percentage = assessment.maxScore
						? (assessment.score / assessment.maxScore) * 100
						: assessment.score;

					return (
						<div key={`${assessment.type}-${assessment.date}-${index}`} className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="space-y-0.5">
									<div className="font-medium text-sm">{assessment.label}</div>
									<div className="text-xs text-muted-foreground">
										{new Date(assessment.date).toLocaleDateString('en-US', {
											month: 'short',
											day: 'numeric',
											year: 'numeric'
										})}
									</div>
								</div>
								<div className="text-right">
									<div className="text-2xl font-semibold">
										{assessment.score}
										{assessment.maxScore && (
											<span className="text-sm text-muted-foreground">
												/{assessment.maxScore}
											</span>
										)}
									</div>
									<div className={`text-xs ${interpretation.color}`}>
										{interpretation.label}
									</div>
								</div>
							</div>

							{/* Progress Bar */}
							<div className={`h-3 rounded-full ${colors.bg} overflow-hidden`}>
								<div
									className={`h-full ${colors.bar} transition-all duration-500 rounded-full`}
									style={{ width: `${Math.min(percentage, 100)}%` }}
								/>
							</div>
						</div>
					);
				})}

				{/* Overall Summary */}
				{scores.length > 1 && (
					<div className="pt-4 border-t">
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
							<div>
								<div className="text-lg font-semibold text-green-600">
									{sortedScores[0].score}
								</div>
								<div className="text-xs text-muted-foreground">Highest</div>
							</div>
							<div>
								<div className="text-lg font-semibold text-primary">
									{averageScore}
								</div>
								<div className="text-xs text-muted-foreground">Average</div>
							</div>
							<div>
								<div className="text-lg font-semibold text-orange-600">
									{sortedScores[sortedScores.length - 1].score}
								</div>
								<div className="text-xs text-muted-foreground">Lowest</div>
							</div>
						</div>
					</div>
				)}

				{/* Legend */}
				<div className="pt-4 border-t">
					<div className="text-xs text-muted-foreground mb-2">Score Guide</div>
					<div className="grid grid-cols-2 gap-2 text-xs">
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 bg-green-500 rounded-sm" />
							<span>80-100: Excellent</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 bg-yellow-500 rounded-sm" />
							<span>60-79: Moderate</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 bg-orange-500 rounded-sm" />
							<span>40-59: Fair</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-3 h-3 bg-red-500 rounded-sm" />
							<span>0-39: Needs Attention</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};
