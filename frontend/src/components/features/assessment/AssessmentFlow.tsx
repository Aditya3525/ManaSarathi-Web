import { AlertCircle, ArrowLeft, ArrowRight, Brain, CheckCircle2, Clock } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { assessmentsApi, type AssessmentTemplate } from '../../../services/api';
import { scoreAdvancedAssessment } from '../../../services/assessmentScoring';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Label } from '../../ui/label';
import { AssessmentLoadingCard } from '../../ui/loading-card';
import { Progress } from '../../ui/progress';
import { RadioGroup, RadioGroupItem } from '../../ui/radio-group';

export interface AssessmentCompletionPayload {
	assessmentType: string;
	sessionId?: string;
	responses: Record<string, number>;
	submissionResponses: Record<string, string>;
	responseDetails: Array<{
		questionId: string;
		questionText: string;
		answerLabel: string;
		answerValue: string | number | null;
		answerScore?: number;
	}>;
	score: number;
	rawScore: number;
	maxScore: number;
	categoryBreakdown?: Record<string, { raw: number; normalized: number; interpretation?: string }>;
}

interface AssessmentFlowProps {
	assessmentId: string;
	sessionId?: string;
	onComplete: (payload: AssessmentCompletionPayload) => Promise<void>;
	onNavigate: (page: string) => void;
}

export function AssessmentFlow({
	assessmentId,
	sessionId,
	onComplete,
	onNavigate
}: AssessmentFlowProps) {
	const [assessmentDef, setAssessmentDef] = useState<AssessmentTemplate | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [responses, setResponses] = useState<Record<string, number>>({});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [startTime] = useState(Date.now());

	// Fetch assessment definition
	useEffect(() => {
		const fetchAssessment = async () => {
			try {
				setLoading(true);
				setError(null);
				// Request the specific assessment template by ID
				const response = await assessmentsApi.getAssessmentTemplates([assessmentId]);

				if (response.success && response.data && response.data.templates.length > 0) {
					// Backend resolves aliases and returns the matching template
					setAssessmentDef(response.data.templates[0]);
				} else {
					setError(`Assessment "${assessmentId}" not found`);
				}
			} catch (err) {
				console.error('Error fetching assessment:', err);
				setError('Unable to load assessment. Please try again.');
			} finally {
				setLoading(false);
			}
		};

		fetchAssessment();
	}, [assessmentId]);

	const totalQuestions = assessmentDef?.questions.length || 0;
	const currentQuestion = assessmentDef?.questions[currentQuestionIndex];
	const progressPercentage = totalQuestions > 0 ? ((currentQuestionIndex + 1) / totalQuestions) * 100 : 0;

	// Calculate estimated time remaining (30 seconds per question average)
	const estimateTimeRemaining = useMemo(() => {
		const questionsRemaining = totalQuestions - currentQuestionIndex - 1;
		const secondsRemaining = questionsRemaining * 30; // 30 seconds per question
		const minutes = Math.ceil(secondsRemaining / 60);
		return minutes;
	}, [currentQuestionIndex, totalQuestions]);

	const handleAnswer = useCallback((value: number) => {
		if (!currentQuestion) return;
		setResponses(prev => ({
			...prev,
			[currentQuestion.id]: value
		}));
	}, [currentQuestion]);

	const handleSubmit = useCallback(async () => {
		if (!assessmentDef) return;

		setIsSubmitting(true);
		setError(null);

		try {
			// Convert responses to string format for scoring
			const stringResponses: Record<string, string> = {};
			for (const [questionId, value] of Object.entries(responses)) {
				stringResponses[questionId] = String(value);
			}

			// Score the assessment
			const scoringResult = scoreAdvancedAssessment({
				assessmentType: assessmentDef.assessmentType,
				answers: stringResponses,
				questions: assessmentDef.questions.map(q => ({
					id: q.id,
					options: q.options.map(opt => ({
						value: String(opt.id),
						score: opt.value
					})),
					reverseScored: q.reverseScored,
					domain: q.domain
				})),
				scoring: assessmentDef.scoring
			});

			const responseDetails = assessmentDef.questions.reduce<AssessmentCompletionPayload['responseDetails']>(
				(details, question) => {
					const answerScore = responses[question.id];
					if (answerScore === undefined) {
						return details;
					}

					const selectedOption = question.options.find((option) => option.value === answerScore);
					const detail: AssessmentCompletionPayload['responseDetails'][number] = {
						questionId: question.id,
						questionText: question.text,
						answerLabel: selectedOption?.text ?? '',
						answerValue: selectedOption?.id ?? answerScore ?? null
					};

					if (typeof selectedOption?.value === 'number') {
						detail.answerScore = selectedOption.value;
					}

					details.push(detail);
					return details;
				},
				[]
			);

			const payload: AssessmentCompletionPayload = {
				assessmentType: assessmentDef.assessmentType,
				sessionId,
				responses,
				submissionResponses: stringResponses,
				responseDetails,
				score: scoringResult.normalizedScore,
				rawScore: scoringResult.rawScore,
				maxScore: scoringResult.maxScore,
				categoryBreakdown: scoringResult.categoryBreakdown
			};

			await onComplete(payload);
		} catch (err) {
			console.error('Error submitting assessment:', err);
			setError('Failed to submit assessment. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	}, [assessmentDef, responses, sessionId, onComplete]);

	const handleNext = useCallback(() => {
		if (currentQuestionIndex < totalQuestions - 1) {
			setCurrentQuestionIndex(prev => prev + 1);
		} else {
			handleSubmit();
		}
	}, [currentQuestionIndex, totalQuestions, handleSubmit]);

	const handlePrevious = useCallback(() => {
		if (currentQuestionIndex > 0) {
			setCurrentQuestionIndex(prev => prev - 1);
		}
	}, [currentQuestionIndex]);

	const canProceed = useMemo(() => {
		if (!currentQuestion) return false;
		return responses[currentQuestion.id] !== undefined;
	}, [currentQuestion, responses]);

	if (loading) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center">
				<AssessmentLoadingCard message="Loading assessment..." />
			</div>
		);
	}

	if (error || !assessmentDef) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-6">
				<Card className="w-full max-w-2xl">
					<CardContent className="p-12 text-center space-y-4">
						<AlertCircle className="h-12 w-12 text-destructive mx-auto" />
						<h2 className="text-xl font-semibold">Error Loading Assessment</h2>
						<p className="text-muted-foreground">{error || 'Assessment not found'}</p>
						<Button onClick={() => onNavigate('assessments')}>
							Return to Assessments
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="max-w-4xl mx-auto p-6 space-y-6">
				{/* Header */}
				<div className="flex items-center justify-between">
					<Button variant="ghost" onClick={() => onNavigate('assessments')}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back to Assessments
					</Button>
					<div className="text-sm text-muted-foreground">
						Session {sessionId ? `#${sessionId.slice(0, 8)}` : 'Standalone'}
					</div>
				</div>

				{/* Assessment Title */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Brain className="h-6 w-6 text-primary" />
							{assessmentDef.title}
						</CardTitle>
						{assessmentDef.description && (
							<p className="text-sm text-muted-foreground mt-2">
								{assessmentDef.description}
							</p>
						)}
					</CardHeader>
				</Card>

				{/* Progress Indicator */}
				<Card>
					<CardContent className="p-6 space-y-4">
						<div className="flex items-center justify-between text-sm">
							<div className="flex items-center gap-2">
								<CheckCircle2 className="h-4 w-4 text-primary" />
								<span className="font-medium">
									Question {currentQuestionIndex + 1} of {totalQuestions}
								</span>
							</div>
							{estimateTimeRemaining > 0 && (
								<div className="flex items-center gap-2 text-muted-foreground">
									<Clock className="h-4 w-4" />
									<span>~{estimateTimeRemaining} min remaining</span>
								</div>
							)}
						</div>
						<Progress value={progressPercentage} className="h-2" />
						<div className="text-xs text-muted-foreground text-center">
							{Math.round(progressPercentage)}% complete
						</div>
					</CardContent>
				</Card>

				{/* Question Card */}
				{currentQuestion && (
					<Card>
						<CardHeader className="space-y-1.5">
							{assessmentDef.timeframe && (
								<p className="text-xs font-semibold text-primary uppercase tracking-wider">
									Timeframe asked: {assessmentDef.timeframe}
								</p>
							)}
							<CardTitle className="text-lg leading-relaxed">
								{currentQuestion.text}
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<RadioGroup
								value={responses[currentQuestion.id]?.toString()}
								onValueChange={(value) => handleAnswer(Number(value))}
							>
								<div className="space-y-3">
									{currentQuestion.options.map((option) => (
										<div
											key={option.id}
											className={`
												flex items-center space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer
												${responses[currentQuestion.id] === option.value
													? 'border-primary bg-primary/5'
													: 'border-border hover:border-primary/50 hover:bg-muted/50'
												}
											`}
											onClick={() => handleAnswer(option.value)}
											onKeyDown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													handleAnswer(option.value);
												}
											}}
											role="button"
											tabIndex={0}
										>
											<RadioGroupItem value={option.value.toString()} id={`option-${option.id}`} />
											<Label
												htmlFor={`option-${option.id}`}
												className="flex-1 cursor-pointer font-normal"
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
									onClick={handleNext}
									disabled={!canProceed || isSubmitting}
									className="flex-1"
								>
									{currentQuestionIndex === totalQuestions - 1 ? (
										isSubmitting ? (
											'Submitting...'
										) : (
											<>
												Submit Assessment
												<CheckCircle2 className="h-4 w-4 ml-2" />
											</>
										)
									) : (
										<>
											Next
											<ArrowRight className="h-4 w-4 ml-2" />
										</>
									)}
								</Button>
							</div>

							{error && (
								<div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
									<AlertCircle className="h-5 w-5 flex-shrink-0" />
									<p className="text-sm">{error}</p>
								</div>
							)}
						</CardContent>
					</Card>
				)}

				{/* Progress Summary */}
				<Card className="bg-muted/50">
					<CardContent className="p-4">
						<div className="flex items-center justify-between text-sm">
							<span className="text-muted-foreground">
								Answered: {Object.keys(responses).length} / {totalQuestions}
							</span>
							<span className="text-muted-foreground">
								Time elapsed: {Math.floor((Date.now() - startTime) / 60000)} min
							</span>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
