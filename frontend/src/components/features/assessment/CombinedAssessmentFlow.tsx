import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { BASIC_ASSESSMENT_DEFINITIONS, isBasicAssessment } from '../../../data/basicAssessmentDefinitions';
import { assessmentsApi, type AssessmentTemplate } from '../../../services/api';
import { scoreAdvancedAssessment } from '../../../services/assessmentScoring';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { AssessmentLoadingCard, InsightsLoadingCard } from '../../ui/loading-card';
import { Progress } from '../../ui/progress';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';

type CombinedAssessmentResponseDetail = {
	questionId: string;
	questionText: string;
	answerLabel: string;
	answerValue: string | number | null;
	answerScore?: number;
};

interface CombinedAssessmentFlowProps {
	selectedTypes: string[];
	sessionId: string;
	onComplete: (results: {
		sessionId: string;
		assessments: Array<{
			assessmentType: string;
			responses: Record<string, string>;
			score: number;
			rawScore: number;
			maxScore: number;
			categoryBreakdown?: Record<string, { raw: number; normalized: number; interpretation?: string }>;
			responseDetails: CombinedAssessmentResponseDetail[];
		}>;
	}) => Promise<void>;
	onCancel: () => void;
}

interface CombinedQuestion {
	questionId: string;
	questionText: string;
	assessmentType: string;
	assessmentTitle: string;
	questionIndex: number; // Index within this assessment
	totalInAssessment: number;
	timeframe?: string;
	options: Array<{
		id: string;
		value: number;
		text: string;
	}>;
}

interface AdaptiveFollowUpRule {
	screenerType: string;
	followUpType: string;
	threshold: number;
	notice: string;
}

const ADAPTIVE_FOLLOW_UP_RULES: AdaptiveFollowUpRule[] = [
	{
		screenerType: 'anxiety_gad2',
		followUpType: 'anxiety',
		threshold: 3,
		notice: 'Adding a deeper anxiety check for a more accurate support plan.'
	},
	{
		screenerType: 'depression_phq2',
		followUpType: 'depression',
		threshold: 3,
		notice: 'Adding a deeper mood check to personalize your recommendations.'
	}
];

const normalizeTypeKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const BASIC_TEMPLATE_SCORING: Record<string, {
	minScore: number;
	maxScore: number;
	reverseScored?: string[];
	interpretationBands: Array<{ max: number; label: string }>;
}> = {
	anxiety_gad2: {
		minScore: 0,
		maxScore: 6,
		interpretationBands: [
			{ max: 2, label: 'Minimal anxiety' },
			{ max: 4, label: 'Mild anxiety symptoms' },
			{ max: 6, label: 'Elevated anxiety symptoms' }
		]
	},
	depression_phq2: {
		minScore: 0,
		maxScore: 6,
		interpretationBands: [
			{ max: 2, label: 'Minimal depression symptoms' },
			{ max: 4, label: 'Mild depression symptoms' },
			{ max: 6, label: 'Elevated depression symptoms' }
		]
	},
	stress_pss4: {
		minScore: 0,
		maxScore: 16,
		reverseScored: ['pss4_q2', 'pss4_q3'],
		interpretationBands: [
			{ max: 5, label: 'Low perceived stress' },
			{ max: 10, label: 'Moderate perceived stress' },
			{ max: 16, label: 'High perceived stress' }
		]
	},
	overthinking_rrs4: {
		minScore: 0,
		maxScore: 12,
		interpretationBands: [
			{ max: 3, label: 'Low overthinking' },
			{ max: 8, label: 'Moderate overthinking' },
			{ max: 12, label: 'High overthinking' }
		]
	},
	trauma_pcptsd5: {
		minScore: 0,
		maxScore: 5,
		interpretationBands: [
			{ max: 2, label: 'Low trauma symptom activation' },
			{ max: 5, label: 'Further trauma assessment recommended' }
		]
	},
	emotional_intelligence_eq5: {
		minScore: 0,
		maxScore: 20,
		interpretationBands: [
			{ max: 7, label: 'Developing emotional intelligence' },
			{ max: 14, label: 'Growing emotional intelligence' },
			{ max: 20, label: 'Strong emotional intelligence' }
		]
	},
	personality_bigfive10: {
		minScore: 0,
		maxScore: 40,
		reverseScored: ['bigfive10_q2', 'bigfive10_q6', 'bigfive10_q8', 'bigfive10_q9', 'bigfive10_q10'],
		interpretationBands: [
			{ max: 16, label: 'Subtle trait expression' },
			{ max: 28, label: 'Balanced trait expression' },
			{ max: 40, label: 'Strong trait expression' }
		]
	}
};

export default function CombinedAssessmentFlow({
	selectedTypes,
	sessionId,
	onComplete,
	onCancel
}: CombinedAssessmentFlowProps) {
	const [assessmentTemplates, setAssessmentTemplates] = useState<AssessmentTemplate[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [responses, setResponses] = useState<Record<string, Record<string, number>>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [showGeneratingInsights, setShowGeneratingInsights] = useState(false);
	const [loadingFollowUpType, setLoadingFollowUpType] = useState<string | null>(null);
	const [adaptiveNotice, setAdaptiveNotice] = useState<string | null>(null);
	const [triggeredFollowUps, setTriggeredFollowUps] = useState<string[]>([]);
	const [startTime] = useState(Date.now());

	// Fetch assessment templates
	useEffect(() => {
		const fetchAssessments = async () => {
			try {
				setLoading(true);
				setError(null);
				setAdaptiveNotice(null);
				setLoadingFollowUpType(null);
				setTriggeredFollowUps([]);
				
				// Separate basic assessments from others
				const basicTypes = selectedTypes.filter(type => isBasicAssessment(type));
				const otherTypes = selectedTypes.filter(type => !isBasicAssessment(type));
				
				// Convert basic assessment definitions to AssessmentTemplate format
				const basicTemplates: AssessmentTemplate[] = basicTypes.map(type => {
					const def = BASIC_ASSESSMENT_DEFINITIONS[type];
					const scoringProfile = BASIC_TEMPLATE_SCORING[type] ?? {
						minScore: 0,
						maxScore: def.questions.reduce((sum, q) => sum + Math.max(...q.options.map(o => o.value)), 0),
						interpretationBands: []
					};
					const reverseScoredSet = new Set(scoringProfile.reverseScored ?? []);
					return {
						assessmentType: def.assessmentType,
						definitionId: def.assessmentType, // Use assessment type as definition ID for basic assessments
						title: def.title,
						description: def.description,
						estimatedTime: `${def.estimatedMinutes} minutes`,
						questions: def.questions.map(q => ({
							id: q.id,
							text: q.text,
							responseType: q.type,
							uiType: q.type === 'yes-no' ? 'binary' as const : q.type === 'likert' ? 'likert' as const : 'multiple-choice' as const,
							reverseScored: reverseScoredSet.has(q.id),
							domain: null,
							options: q.options.map((opt, idx) => ({
								id: opt.id,
								value: opt.value,
								text: opt.text,
								order: idx
							}))
						})),
						scoring: {
							minScore: scoringProfile.minScore,
							maxScore: scoringProfile.maxScore,
							reverseScored: scoringProfile.reverseScored,
							interpretationBands: scoringProfile.interpretationBands
						}
					};
				});

				// Fetch other assessment templates from backend if any
				let otherTemplates: AssessmentTemplate[] = [];
				if (otherTypes.length > 0) {
					const response = await assessmentsApi.getAssessmentTemplates(otherTypes);
					if (response.success && response.data?.templates) {
						otherTemplates = response.data.templates;
					}
				}

				// Combine all templates
				const allTemplates = [...basicTemplates, ...otherTemplates];
				
				if (allTemplates.length === 0) {
					setError('Failed to load assessments');
				} else {
					setAssessmentTemplates(allTemplates);
				}
			} catch (err) {
				console.error('Error fetching assessments:', err);
				setError('Unable to load assessment questions. Please try again.');
			} finally {
				setLoading(false);
			}
		};

		if (selectedTypes.length > 0) {
			fetchAssessments();
		}
	}, [selectedTypes]);

	// Build combined question list from all assessment templates
	const allQuestions = useMemo<CombinedQuestion[]>(() => {
		const questions: CombinedQuestion[] = [];

		assessmentTemplates.forEach(template => {
			template.questions.forEach((q, index) => {
				questions.push({
					questionId: q.id,
					questionText: q.text,
					assessmentType: template.assessmentType,
					assessmentTitle: template.title,
					questionIndex: index + 1,
					totalInAssessment: template.questions.length,
					timeframe: template.timeframe,
					options: q.options.map(opt => ({
						id: opt.id,
						value: opt.value,
						text: opt.text
					}))
				});
			});
		});

		return questions;
	}, [assessmentTemplates]);

	const currentQuestion = useMemo(
		() => allQuestions[currentQuestionIndex] ?? null,
		[allQuestions, currentQuestionIndex]
	);

	const totalQuestions = allQuestions.length;
	const progressPercentage = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;
	const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);

	// Estimate remaining time (30 seconds per question)
	const estimateTimeRemaining = useMemo(() => {
		const questionsLeft = totalQuestions - currentQuestionIndex - 1;
		const minutes = Math.ceil((questionsLeft * 30) / 60);
		return minutes;
	}, [currentQuestionIndex, totalQuestions]);

	useEffect(() => {
		if (!adaptiveNotice) {
			return;
		}

		const timer = window.setTimeout(() => {
			setAdaptiveNotice(null);
		}, 5000);

		return () => window.clearTimeout(timer);
	}, [adaptiveNotice]);

	const handleAnswer = useCallback((value: number) => {
		if (!currentQuestion) return;

		setResponses(prev => ({
			...prev,
			[currentQuestion.assessmentType]: {
				...prev[currentQuestion.assessmentType],
				[currentQuestion.questionId]: value
			}
		}));
	}, [currentQuestion]);

	const appendFollowUpTemplate = useCallback(async (followUpType: string): Promise<boolean> => {
		if (loadingFollowUpType) {
			return false;
		}

		const normalizedFollowUpType = normalizeTypeKey(followUpType);
		const alreadyLoaded = assessmentTemplates.some((template) => {
			return (
				normalizeTypeKey(template.assessmentType) === normalizedFollowUpType ||
				normalizeTypeKey(template.definitionId) === normalizedFollowUpType
			);
		});

		if (alreadyLoaded) {
			setTriggeredFollowUps((prev) => (prev.includes(followUpType) ? prev : [...prev, followUpType]));
			return false;
		}

		setLoadingFollowUpType(followUpType);
		try {
			const response = await assessmentsApi.getAssessmentTemplates([followUpType]);
			if (!response.success || !response.data?.templates?.length) {
				return false;
			}

			const appendedTemplates = response.data.templates.filter((template) => {
				return !assessmentTemplates.some((existing) => {
					return (
						normalizeTypeKey(existing.assessmentType) === normalizeTypeKey(template.assessmentType) ||
						normalizeTypeKey(existing.definitionId) === normalizeTypeKey(template.definitionId)
					);
				});
			});

			if (appendedTemplates.length === 0) {
				setTriggeredFollowUps((prev) => (prev.includes(followUpType) ? prev : [...prev, followUpType]));
				return false;
			}

			setAssessmentTemplates((prev) => [...prev, ...appendedTemplates]);
			setTriggeredFollowUps((prev) => (prev.includes(followUpType) ? prev : [...prev, followUpType]));
			return true;
		} catch (fetchError) {
			console.error('Failed to append adaptive follow-up template:', fetchError);
			return false;
		} finally {
			setLoadingFollowUpType(null);
		}
	}, [assessmentTemplates, loadingFollowUpType]);

	const maybeTriggerAdaptiveFollowUp = useCallback(async (): Promise<boolean> => {
		if (!currentQuestion) {
			return false;
		}

		if (currentQuestion.questionIndex !== currentQuestion.totalInAssessment) {
			return false;
		}

		const rule = ADAPTIVE_FOLLOW_UP_RULES.find((candidate) => {
			return normalizeTypeKey(candidate.screenerType) === normalizeTypeKey(currentQuestion.assessmentType);
		});

		if (!rule || triggeredFollowUps.includes(rule.followUpType)) {
			return false;
		}

		const assessmentResponses = responses[currentQuestion.assessmentType] || {};
		if (Object.keys(assessmentResponses).length < currentQuestion.totalInAssessment) {
			return false;
		}

		const screenerScore = Object.values(assessmentResponses).reduce((sum, responseValue) => {
			if (typeof responseValue === 'number' && Number.isFinite(responseValue)) {
				return sum + responseValue;
			}
			const parsed = Number(responseValue);
			return Number.isFinite(parsed) ? sum + parsed : sum;
		}, 0);

		if (screenerScore < rule.threshold) {
			return false;
		}

		const appended = await appendFollowUpTemplate(rule.followUpType);
		if (appended) {
			setAdaptiveNotice(rule.notice);
		}

		return appended;
	}, [appendFollowUpTemplate, currentQuestion, responses, triggeredFollowUps]);

	const handleSubmit = useCallback(async () => {
		if (assessmentTemplates.length === 0) return;

		setIsSubmitting(true);
		setError(null);

		try {
			const assessmentResults = assessmentTemplates.map((template) => {
				const assessmentResponses = responses[template.assessmentType] || {};

				const stringResponses: Record<string, string> = {};
				for (const [questionId, value] of Object.entries(assessmentResponses)) {
					stringResponses[questionId] = String(value);
				}

				const scoringResult = scoreAdvancedAssessment({
					assessmentType: template.assessmentType,
					answers: stringResponses,
					questions: template.questions.map(q => ({
						id: q.id,
						options: q.options.map(opt => ({
							value: String(opt.id),
							score: opt.value
						})),
						reverseScored: q.reverseScored,
						domain: q.domain
					})),
					scoring: template.scoring
				});

				const responseDetails = template.questions
					.map((question) => {
						const answerScore = assessmentResponses[question.id];
						if (answerScore === undefined) {
							return null;
						}
						const selectedOption = question.options.find((option) => option.value === answerScore);
						return {
							questionId: question.id,
							questionText: question.text,
							answerLabel: selectedOption?.text ?? '',
							answerValue: selectedOption?.id ?? answerScore ?? null,
							answerScore: typeof answerScore === 'number' ? answerScore : (selectedOption?.value ?? 0)
						};
					})
					.filter((detail): detail is NonNullable<typeof detail> => detail !== null);

				return {
					assessmentType: template.assessmentType,
					responses: stringResponses,
					score: scoringResult.normalizedScore,
					rawScore: scoringResult.rawScore,
					maxScore: scoringResult.maxScore,
					categoryBreakdown: scoringResult.categoryBreakdown,
					responseDetails
				};
			});

			setShowGeneratingInsights(true);
			await onComplete({
				sessionId,
				assessments: assessmentResults
			});
		} catch (err) {
			console.error('Error submitting assessments:', err);
			setError('Failed to submit assessments. Please try again.');
			setShowGeneratingInsights(false);
		} finally {
			setIsSubmitting(false);
		}
	}, [assessmentTemplates, responses, sessionId, onComplete]);

	const handleNext = useCallback(async () => {
		const appendedFollowUp = await maybeTriggerAdaptiveFollowUp();

		if (currentQuestionIndex < totalQuestions - 1 || appendedFollowUp) {
			setCurrentQuestionIndex((prev) => prev + 1);
			return;
		}

		handleSubmit();
	}, [currentQuestionIndex, handleSubmit, maybeTriggerAdaptiveFollowUp, totalQuestions]);

	const handlePrevious = useCallback(() => {
		if (currentQuestionIndex > 0) {
			setCurrentQuestionIndex(prev => prev - 1);
		}
	}, [currentQuestionIndex]);

	const canProceed = useMemo(() => {
		if (!currentQuestion) return false;
		return responses[currentQuestion.assessmentType]?.[currentQuestion.questionId] !== undefined;
	}, [currentQuestion, responses]);

	// Loading state
	if (loading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<AssessmentLoadingCard 
					message={`Preparing ${selectedTypes.length} assessment${selectedTypes.length > 1 ? 's' : ''}...`}
				/>
			</div>
		);
	}

	// Error state
	if (error) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Card className="w-full max-w-2xl">
					<CardContent className="p-12 text-center">
						<AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
						<h2 className="text-2xl font-semibold mb-2">Error Loading Assessments</h2>
						<p className="text-muted-foreground mb-6">{error}</p>
						<div className="flex gap-3 justify-center">
							<Button variant="outline" onClick={onCancel}>
								<ArrowLeft className="h-4 w-4 mr-2" />
								Go Back
							</Button>
							<Button onClick={() => window.location.reload()}>Try Again</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// Generating insights state
	if (showGeneratingInsights) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Card className="w-full max-w-2xl">
					<CardContent className="p-12 text-center">
						<InsightsLoadingCard 
							message={`AI is generating personalized insights from your ${selectedTypes.length} assessments...`}
						/>
						<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mt-6">
							<CheckCircle2 className="h-4 w-4 text-green-600" />
							<span>Processing {totalQuestions} responses</span>
						</div>
					</CardContent>
				</Card>
			</div>
		);
	}

	// No current question (shouldn't happen after loading)
	if (!currentQuestion) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<Card className="w-full max-w-2xl">
					<CardContent className="p-12 text-center">
						<p className="text-muted-foreground">No questions available.</p>
						<Button variant="outline" onClick={onCancel} className="mt-4">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Go Back
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	const selectedAnswer = responses[currentQuestion.assessmentType]?.[currentQuestion.questionId];

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-6">
			<div className="w-full max-w-3xl space-y-6">
				{/* Header with Cancel and Elapsed Time */}
				<div className="flex items-center justify-between">
					<Button variant="ghost" size="sm" onClick={onCancel}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Cancel
					</Button>
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<Clock className="h-4 w-4" />
						<span>{elapsedMinutes} min</span>
					</div>
				</div>

				{/* Overall Progress Card */}
				<Card>
					<CardContent className="pt-6 space-y-2">
						<div className="flex items-center justify-between text-sm">
							<span className="font-medium text-muted-foreground">Overall Progress</span>
							<div className="flex items-center gap-4">
								<span className="font-semibold">
									Question {currentQuestionIndex + 1} of {totalQuestions}
								</span>
								{estimateTimeRemaining > 0 && (
									<span className="text-muted-foreground">
										~{estimateTimeRemaining} min remaining
									</span>
								)}
							</div>
						</div>
						<Progress value={progressPercentage} className="h-2" />
						<div className="text-xs text-muted-foreground text-center">
							{Math.round(progressPercentage)}% complete • {selectedTypes.length} assessment
							{selectedTypes.length > 1 ? 's' : ''} combined
						</div>
					</CardContent>
				</Card>

				{/* Assessment Title Badge */}
				<div className="flex items-center gap-2">
					<span className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-md">
						{currentQuestion.assessmentTitle}
					</span>
					<span className="text-sm text-muted-foreground">
						Question {currentQuestion.questionIndex} of {currentQuestion.totalInAssessment}
					</span>
				</div>

				{loadingFollowUpType && (
					<p className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2">
						Loading additional questions for deeper personalization...
					</p>
				)}

				{adaptiveNotice && !loadingFollowUpType && (
					<p className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2">
						{adaptiveNotice}
					</p>
				)}

				{/* Question Card */}
				<Card className="shadow-lg">
					<CardHeader className="space-y-1.5">
						{currentQuestion.timeframe && (
							<p className="text-xs font-semibold text-primary uppercase tracking-wider">
								Timeframe asked: {currentQuestion.timeframe}
							</p>
						)}
						<CardTitle className="text-xl leading-relaxed">{currentQuestion.questionText}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<RadioGroup
							value={selectedAnswer?.toString() || ''}
							onValueChange={value => handleAnswer(Number(value))}
						>
							<div className="space-y-3">
								{currentQuestion.options.map(option => (
									<div
										key={option.id}
										className={`
											flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer
											${
												selectedAnswer === option.value
													? 'border-primary bg-primary/5'
													: 'border-border hover:border-primary/50 hover:bg-muted/50'
											}
										`}
										onClick={() => handleAnswer(option.value)}
										onKeyDown={e => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleAnswer(option.value);
											}
										}}
										role="button"
										tabIndex={0}
									>
										<RadioGroupItem
											value={option.value.toString()}
											id={`option-${option.id}`}
										/>
										<Label
											htmlFor={`option-${option.id}`}
											className="flex-1 cursor-pointer font-normal text-base"
										>
											{option.text}
										</Label>
									</div>
								))}
							</div>
						</RadioGroup>

						{/* Navigation Buttons */}
						<div className="flex gap-3 pt-6">
							<Button
								variant="outline"
								onClick={handlePrevious}
								disabled={currentQuestionIndex === 0}
								className="flex-1"
							>
								<ArrowLeft className="h-4 w-4 mr-2" />
								Previous
							</Button>
							<Button
								onClick={() => void handleNext()}
								disabled={!canProceed || isSubmitting}
								className="flex-1"
							>
								{currentQuestionIndex === totalQuestions - 1 ? (
									<>
										Complete Assessment
										<CheckCircle2 className="h-4 w-4 ml-2" />
									</>
								) : (
									<>
										Next Question
										<ArrowRight className="h-4 w-4 ml-2" />
									</>
								)}
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Mini Progress Indicators */}
				<div className="flex justify-center gap-1 flex-wrap">
					{allQuestions.map((_, index) => (
						<div
							key={index}
							className={`h-1.5 w-6 rounded-full transition-all ${
								index <= currentQuestionIndex ? 'bg-primary' : 'bg-muted'
							}`}
						/>
					))}
				</div>
			</div>
		</div>
	);
}
