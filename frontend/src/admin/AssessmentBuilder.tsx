import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ClipboardList,
  Plus,
  Trash2,
  GripVertical,
  Save,
  X,
  Loader2,
  AlertCircle
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { adminApi } from '../services/api';
import { useNotificationStore } from '../stores/notificationStore';

import type { Assessment } from './AssessmentList';

interface Question {
  id?: string;
  text: string;
  order: number;
  responseType: string;
  domain?: string | null;
  reverseScored?: boolean;
  options: ResponseOption[];
}

interface ResponseOption {
  id?: string;
  value: number;
  text: string;
  order: number;
}

interface InterpretationBand {
  max: number;
  label: string;
  color: string;
}

interface ScoringConfig {
  minScore: number;
  maxScore: number;
  interpretationBands: InterpretationBand[];
  algorithm?: string;
  customHookId?: string;
  domains?: any[];
}

interface AssessmentBuilderProps {
  assessment: Assessment | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}

const CATEGORIES = [
  'anxiety',
  'depression',
  'stress',
  'trauma',
  'wellbeing',
  'overthinking',
  'emotional intelligence',
  'personality',
  'composite',
  'other'
];
const RESPONSE_TYPES = [
  { value: 'likert', label: 'Likert (0-3)' },
  { value: 'likert_5', label: 'Likert (0-4)' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'binary', label: 'Yes / No' }
];
const RESPONSE_TYPE_VALUES = RESPONSE_TYPES.map((type) => type.value);
const COLORS = [
  { value: '#2b4c37', label: 'Forest Green' },
  { value: '#10b981', label: 'Emerald Green' },
  { value: '#a7f3d0', label: 'Light Mint' },
  { value: '#84cc16', label: 'Lime (Green-Yellow)' },
  { value: '#d9f99d', label: 'Light Lime-Green' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#fef9c3', label: 'Soft Yellow' },
  { value: '#f97316', label: 'Orange' },
  { value: '#ffedd5', label: 'Pale Peach' },
  { value: '#e11d48', label: 'Red' },
  { value: '#fecdd3', label: 'Soft Rose' },
  { value: '#6fa3b5', label: 'Slate Blue' },
  { value: '#ddd6fe', label: 'Soft Lavender' }
];

// Sortable Question Item Component
interface SortableQuestionItemProps {
  question: Question;
  index: number;
  onEdit: (question: Question) => void;
  onDelete: (id: string | undefined) => void;
}

const SortableQuestionItem: React.FC<SortableQuestionItemProps> = ({
  question,
  index,
  onEdit,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id || `question-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`border-muted ${isDragging ? 'shadow-lg' : ''}`}>
        <CardContent className="p-2 sm:p-3">
          <div className="flex gap-3 items-start justify-between w-full">
            <div
              className="flex sm:flex flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1 mb-1">
                <Badge variant="outline" className="h-5 text-xs px-1.5">
                  Q{index + 1}
                </Badge>
                <Badge variant="secondary" className="h-5 text-xs px-1.5">
                  {question.responseType}
                </Badge>
                {question.reverseScored && (
                  <Badge variant="outline" className="h-5 text-xs px-1.5">
                    Reverse
                  </Badge>
                )}
              </div>
              <p className="text-xs sm:text-sm font-medium break-words pr-2">
                {question.text}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {question.options.length} options
              </p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(question)}
                className="h-7 text-xs px-2"
              >
                Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(question.id)}
                className="h-7 px-2"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const AssessmentBuilder: React.FC<AssessmentBuilderProps> = ({
  assessment,
  open,
  onClose,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'scoring' | 'questions'>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { addNotification } = useNotificationStore();

  // Basic Info State
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('anxiety');
  const [description, setDescription] = useState('');
  const [timeEstimate, setTimeEstimate] = useState('');
  const [timeframe, setTimeframe] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isBasicOverallOnly, setIsBasicOverallOnly] = useState(false);
  const [visibleInMainList, setVisibleInMainList] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>(['all']);

  // Scoring State
  const [minScore, setMinScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [interpretationBands, setInterpretationBands] = useState<InterpretationBand[]>([
    { max: 5, label: 'Minimal', color: '#10b981' },
  ]);
  const [scoringAlgorithm, setScoringAlgorithm] = useState<'SUM' | 'AVERAGE' | 'WEIGHTED_SUM' | 'CUSTOM_HOOK'>('SUM');
  const [customHookId, setCustomHookId] = useState('');
  const [domains, setDomains] = useState<any[]>([]);

  // Questions State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);

  // Drag and Drop Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end event
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setQuestions((items) => {
        const oldIndex = items.findIndex((item) => (item.id || `question-${items.indexOf(item)}`) === active.id);
        const newIndex = items.findIndex((item) => (item.id || `question-${items.indexOf(item)}`) === over.id);

        const reordered = arrayMove(items, oldIndex, newIndex);
        // Update order property
        const updated = reordered.map((q, index) => ({ ...q, order: index + 1 }));
        recalculateScoreRange(updated);
        return updated;
      });
    }
  };

  const recalculateScoreRange = useCallback((questionList: Question[]) => {
    if (!questionList.length) {
      setMinScore(0);
      setMaxScore(0);
      setInterpretationBands((prev) => {
        if (!prev.length) {
          return prev;
        }
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (updated[lastIndex].max === 0) {
          return prev;
        }
        updated[lastIndex] = {
          ...updated[lastIndex],
          max: 0
        };
        return updated;
      });
      return;
    }

    const totals = questionList.reduce(
      (acc, question) => {
        if (!question.options.length) {
          return acc;
        }
        const optionValues = question.options.map((opt) => Number(opt.value));
        return {
          min: acc.min + Math.min(...optionValues),
          max: acc.max + Math.max(...optionValues)
        };
      },
      { min: 0, max: 0 }
    );

    setMinScore(totals.min);
    setMaxScore(totals.max);
    setInterpretationBands((prev) => {
      if (!prev.length) {
        return prev;
      }
      const updated = [...prev];
      const lastIndex = updated.length - 1;
      if (updated[lastIndex].max === totals.max) {
        return prev;
      }
      updated[lastIndex] = {
        ...updated[lastIndex],
        max: totals.max
      };
      return updated;
    });
  }, []);

  const loadAssessment = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const response = await adminApi.getAssessment(id);

      // Backend returns: { success: true, data: { ...assessment... } }
      // So response.success is the success flag, and response.data is the assessment
      if (response.success && response.data) {
        const data = response.data as {
          name: string;
          type: string;
          category: string;
          description: string | null;
          timeEstimate: string | null;
          timeframe: string | null;
          isActive: boolean;
          isBasicOverallOnly?: boolean;
          visibleInMainList?: boolean;
          tags?: string | null;
          scoringConfig: ScoringConfig | null;
          questions: Question[];
        };
        
        setName(data.name);
        setType(data.type);
        setCategory(data.category);
        setDescription(data.description || '');
        setTimeEstimate(data.timeEstimate || '');
        setTimeframe(data.timeframe || '');
        setIsActive(data.isActive);
        setIsBasicOverallOnly(data.isBasicOverallOnly || false);
        setVisibleInMainList(data.visibleInMainList !== false);
        
        // Parse tags from comma-separated string
        if (data.tags) {
          const tags = data.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
          setSelectedTags(tags.length > 0 ? tags : ['all']);
        } else {
          setSelectedTags(['all']);
        }

        if (data.scoringConfig) {
          setMinScore(data.scoringConfig.minScore ?? 0);
          setMaxScore(data.scoringConfig.maxScore ?? 0);
          setInterpretationBands(data.scoringConfig.interpretationBands || []);
          setScoringAlgorithm((data.scoringConfig.algorithm as any) || 'SUM');
          setCustomHookId(data.scoringConfig.customHookId || '');
          setDomains(data.scoringConfig.domains || []);
        }

        setQuestions(data.questions || []);
        recalculateScoreRange(data.questions || []);
      } else {
        // Handle API error response
        addNotification({
          type: 'error',
          title: 'Error',
          description: response.error || 'Failed to load assessment'
        });
      }
    } catch (error: unknown) {
      console.error('Failed to load assessment:', error);
      addNotification({
        type: 'error',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load assessment'
      });
    } finally {
      setIsLoading(false);
    }
  }, [addNotification, recalculateScoreRange]);

  const resetForm = useCallback(() => {
    setName('');
    setType('');
    setCategory('anxiety');
    setDescription('');
    setTimeEstimate('');
    setTimeframe('');
    setIsActive(false);
    setIsBasicOverallOnly(false);
    setVisibleInMainList(true);
    setSelectedTags(['all']);
    setMinScore(0);
    setMaxScore(0);
    setInterpretationBands([{ max: 5, label: 'Minimal', color: '#10b981' }]);
    setScoringAlgorithm('SUM');
    setCustomHookId('');
    setDomains([]);
    setQuestions([]);
    recalculateScoreRange([]);
    setActiveTab('basic');
  }, [recalculateScoreRange]);

  // Load assessment data when editing
  useEffect(() => {
    if (!open) {
      return;
    }

    if (assessment?.id) {
      void loadAssessment(assessment.id);
    } else {
      resetForm();
    }
  }, [assessment, open, loadAssessment, resetForm]);

  const validateBasicInfo = (): string | null => {
    if (!name.trim()) return 'Assessment name is required';
    if (!type.trim()) return 'Assessment type is required';
    if (!category) return 'Category is required';
    if (!description.trim()) return 'Description is required';
    if (description.trim().length < 10) return 'Description must be at least 10 characters';
    return null;
  };

  const validateScoring = (): string | null => {
    if (maxScore <= minScore) return 'Max score must be greater than min score';
    if (interpretationBands.length === 0) return 'At least one interpretation band is required';
    
    const sortedBands = [...interpretationBands].sort((a, b) => a.max - b.max);
    if (sortedBands[sortedBands.length - 1].max !== maxScore) {
      return 'Highest interpretation band must match max score';
    }

    return null;
  };

  const validateQuestions = (): string | null => {
    if (questions.length === 0) return 'At least one question is required';

    for (const question of questions) {
      if (!question.text.trim()) return 'All questions must have text';
      if (question.options.length === 0) return 'All questions must have response options';
    }

    return null;
  };

  const handleSave = async () => {
    // Validate all sections
    const basicError = validateBasicInfo();
    if (basicError) {
      setActiveTab('basic');
      addNotification({
        type: 'error',
        title: 'Validation Error',
        description: basicError
      });
      return;
    }

    const scoringError = validateScoring();
    if (scoringError) {
      setActiveTab('scoring');
      addNotification({
        type: 'error',
        title: 'Validation Error',
        description: scoringError
      });
      return;
    }

    const questionsError = validateQuestions();
    if (questionsError) {
      setActiveTab('questions');
      addNotification({
        type: 'error',
        title: 'Validation Error',
        description: questionsError
      });
      return;
    }

    // Prepare data
    const assessmentData = {
      name: name.trim(),
      type: type.trim().toLowerCase().replace(/\s+/g, '_'),
      category,
      description: description.trim(),
      timeEstimate: timeEstimate.trim() || null,
      timeframe: timeframe.trim() || null,
      isActive,
      isBasicOverallOnly,
      visibleInMainList,
      tags: selectedTags.join(','),
      scoringConfig: {
        algorithm: scoringAlgorithm,
        customHookId: scoringAlgorithm === 'CUSTOM_HOOK' ? customHookId : undefined,
        minScore,
        maxScore,
        interpretationBands: interpretationBands.map(b => ({
          max: b.max,
          label: b.label,
          color: b.color
        })),
        domains: domains.map(d => ({
          id: d.id,
          label: d.label,
          minScore: d.minScore,
          maxScore: d.maxScore,
          interpretationBands: d.interpretationBands.map((b: any) => ({
            max: b.max,
            label: b.label,
            color: b.color
          }))
        }))
      },
      questions: questions.map((q, index) => ({
        text: q.text.trim(),
        order: index + 1,
        responseType: q.responseType,
        domain: q.domain?.trim() || undefined,
        reverseScored: q.reverseScored || false,
        options: q.options.map((opt, optIndex) => ({
          value: opt.value,
          text: opt.text.trim(),
          order: optIndex + 1
        }))
      }))
    };

    try {
      setIsSaving(true);

      if (assessment?.id) {
        // Update existing
        await adminApi.updateAssessment(assessment.id, assessmentData);
        addNotification({
          type: 'success',
          title: 'Success',
          description: 'Assessment updated successfully'
        });
      } else {
        // Create new
        await adminApi.createAssessment(assessmentData);
        addNotification({
          type: 'success',
          title: 'Success',
          description: 'Assessment created successfully'
        });
      }

      onSave();
      onClose();
    } catch (error: unknown) {
      console.error('Failed to save assessment:', error);
      const err = error as { response?: { data?: { error?: string } } };
      const errorMessage = err.response?.data?.error || 'Failed to save assessment. Please check all required fields.';
      addNotification({
        type: 'error',
        title: 'Error',
        description: errorMessage
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Interpretation Band Functions
  const addBand = () => {
    const lastBand = interpretationBands[interpretationBands.length - 1];
    const newMax = lastBand ? lastBand.max + 5 : 5;
    setInterpretationBands([
      ...interpretationBands,
      { max: newMax, label: '', color: '#8b5cf6' }
    ]);
  };

  const updateBand = (index: number, field: keyof InterpretationBand, value: string | number) => {
    const updated = [...interpretationBands];
    updated[index] = { ...updated[index], [field]: value };
    setInterpretationBands(updated);
  };

  const removeBand = (index: number) => {
    setInterpretationBands(interpretationBands.filter((_, i) => i !== index));
  };

  // Question Functions
  const openQuestionModal = (question: Question | null = null) => {
    if (question) {
      setEditingQuestion(question);
    } else {
      setEditingQuestion({
        text: '',
        order: questions.length + 1,
        responseType: 'likert',
        options: [
          { value: 0, text: 'Not at all', order: 1 },
          { value: 1, text: 'Several days', order: 2 },
          { value: 2, text: 'More than half the days', order: 3 },
          { value: 3, text: 'Nearly every day', order: 4 },
        ]
      });
    }
    setQuestionModalOpen(true);
  };

  const saveQuestion = (question: Question) => {
    const nextQuestions = (() => {
      if (question.id) {
        const existing = questions.find((q) => q.id === question.id);
        if (existing) {
          return questions.map((q) => (q.id === question.id ? { ...question } : q));
        }
      }
      return [...questions, { ...question, id: question.id ?? `temp-${Date.now()}` }];
    })()
      .map((q, index) => ({ ...q, order: index + 1 }));

    setQuestions(nextQuestions);
    recalculateScoreRange(nextQuestions);

    setQuestionModalOpen(false);
    setEditingQuestion(null);
  };

  const deleteQuestion = (questionId: string | undefined) => {
    if (!questionId) return;
    const filtered = questions
      .filter((q) => q.id !== questionId)
      .map((q, index) => ({ ...q, order: index + 1 }));
    setQuestions(filtered);
    recalculateScoreRange(filtered);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[96vw] h-auto max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Header Section */}
        <DialogHeader className="flex-shrink-0 px-6 pt-4 pb-3 border-b bg-muted/20">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <ClipboardList className="h-5 w-5 text-primary" />
            {assessment?.id ? 'Edit Assessment' : 'Create New Assessment'}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Tabs Navigation Section */}
            <div className="flex-shrink-0 px-6 py-2.5 border-b bg-background">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
                <TabsList className="inline-flex h-9 items-center justify-center rounded-lg bg-muted/50 p-1 text-muted-foreground w-full">
                  <TabsTrigger value="basic" className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1">
                    Basic Info
                  </TabsTrigger>
                  <TabsTrigger value="scoring" className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1">
                    Scoring
                  </TabsTrigger>
                  <TabsTrigger value="questions" className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm flex-1">
                    Questions {questions.length > 0 && `(${questions.length})`}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 bg-muted/5" style={{ maxHeight: 'calc(90vh - 180px)' }}>
              <div className="px-6 py-4">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
                  <TabsContent value="basic" className="space-y-3 mt-0 data-[state=active]:block data-[state=inactive]:hidden">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium text-foreground">Assessment Name *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., General Anxiety Disorder (GAD-7)"
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-sm font-medium text-foreground">Type (Unique ID) *</Label>
                    <Input
                      id="type"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      placeholder="e.g., gad7"
                      disabled={!!assessment?.id}
                      className="h-10 text-sm"
                    />
                    {assessment?.id && (
                      <p className="text-xs text-muted-foreground italic">Type cannot be changed after creation</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-medium text-foreground">Category *</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger id="category" className="h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-sm">
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm font-medium text-foreground">Description *</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of what this assessment measures"
                      rows={3}
                      className="text-sm resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeEstimate" className="text-sm font-medium text-foreground">Time Estimate</Label>
                    <Input
                      id="timeEstimate"
                      value={timeEstimate}
                      onChange={(e) => setTimeEstimate(e.target.value)}
                      placeholder="e.g., 5 minutes"
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="timeframe" className="text-sm font-medium text-foreground">Timeframe Asked</Label>
                    <Input
                      id="timeframe"
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      placeholder="e.g., Over the last 2 weeks"
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="flex items-center space-x-2 py-2">
                    <Switch
                      id="isActive"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                    <Label htmlFor="isActive" className="text-sm font-medium cursor-pointer">Active (visible to users)</Label>
                  </div>

                  <div className="flex items-center space-x-2 py-2">
                    <Switch
                      id="isBasicOverallOnly"
                      checked={isBasicOverallOnly}
                      onCheckedChange={setIsBasicOverallOnly}
                    />
                    <div>
                      <Label htmlFor="isBasicOverallOnly" className="text-sm font-medium cursor-pointer">Basic Overall Component</Label>
                      <p className="text-xs text-muted-foreground">Make this available in the combined baseline wellness screening</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 py-2">
                    <Switch
                      id="visibleInMainList"
                      checked={visibleInMainList}
                      onCheckedChange={setVisibleInMainList}
                    />
                    <div>
                      <Label htmlFor="visibleInMainList" className="text-sm font-medium cursor-pointer">Visible in main list</Label>
                      <p className="text-xs text-muted-foreground">Show this individually in the standalone library list</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label className="text-sm font-medium text-foreground">Display Tags</Label>
                    <p className="text-xs text-muted-foreground">Select which tabs this assessment will appear in</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'required', label: 'Required' },
                        { value: 'recommended', label: 'Recommended' },
                        { value: 'optional', label: 'Optional' },
                        { value: 'advanced', label: 'Advanced' }
                      ].map((tag) => (
                        <div key={tag.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`tag-${tag.value}`}
                            checked={selectedTags.includes(tag.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTags([...selectedTags, tag.value]);
                              } else {
                                const newTags = selectedTags.filter(t => t !== tag.value);
                                // Always keep at least 'all' selected
                                setSelectedTags(newTags.length > 0 ? newTags : ['all']);
                              }
                            }}
                          />
                          <Label
                            htmlFor={`tag-${tag.value}`}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {tag.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="scoring" className="space-y-4 mt-0 data-[state=active]:block data-[state=inactive]:hidden">
                  <Card className="border-muted shadow-sm">
                    <CardHeader className="p-4 pb-3">
                      <CardTitle className="text-sm font-semibold">Scoring Method</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="scoringAlgorithm" className="text-sm font-medium">Algorithm</Label>
                          <Select
                            value={scoringAlgorithm}
                            onValueChange={(val: any) => setScoringAlgorithm(val)}
                          >
                            <SelectTrigger id="scoringAlgorithm" className="h-10 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SUM">Sum of all answers (Standard)</SelectItem>
                              <SelectItem value="AVERAGE">Average of answers</SelectItem>
                              <SelectItem value="WEIGHTED_SUM">Weighted Sum</SelectItem>
                              <SelectItem value="CUSTOM_HOOK">Custom Algorithm Hook (Advanced)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {scoringAlgorithm === 'CUSTOM_HOOK' && (
                          <div className="space-y-2">
                            <Label htmlFor="customHookId" className="text-sm font-medium">Custom Hook ID (Code Identifier)</Label>
                            <Input
                              id="customHookId"
                              value={customHookId}
                              onChange={(e) => setCustomHookId(e.target.value)}
                              placeholder="e.g. personality_mini_ipip"
                              className="h-10 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-muted shadow-sm">
                    <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-semibold">Sub-Parameters / Domains</CardTitle>
                      <Button
                        onClick={() => {
                          const newDomainId = `domain-${domains.length + 1}`;
                          setDomains([...domains, {
                            id: newDomainId,
                            label: `Domain ${domains.length + 1}`,
                            minScore: 0,
                            maxScore: 20,
                            interpretationBands: [{ max: 5, label: 'Low', color: '#10b981' }]
                          }]);
                        }}
                        size="sm"
                        variant="outline"
                        className="h-9 text-sm"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Domain
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-4">
                      {domains.map((dom, domIdx) => (
                        <div key={domIdx} className="p-4 border rounded-md bg-muted/20 space-y-3 relative">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDomains(domains.filter((_, idx) => idx !== domIdx));
                            }}
                            className="absolute top-2 right-2 h-8 w-8 p-0"
                            type="button"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Domain ID (Slug)</Label>
                              <Input
                                value={dom.id}
                                onChange={(e) => {
                                  const updated = [...domains];
                                  updated[domIdx].id = e.target.value.toLowerCase().replace(/\s+/g, '_');
                                  setDomains(updated);
                                }}
                                placeholder="e.g. extraversion"
                                className="h-9 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold">Label (Display Name)</Label>
                              <Input
                                value={dom.label}
                                onChange={(e) => {
                                  const updated = [...domains];
                                  updated[domIdx].label = e.target.value;
                                  setDomains(updated);
                                }}
                                placeholder="e.g. Extraversion"
                                className="h-9 text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs font-semibold">Min Score</Label>
                                <Input
                                  type="number"
                                  value={dom.minScore}
                                  onChange={(e) => {
                                    const updated = [...domains];
                                    updated[domIdx].minScore = Number(e.target.value);
                                    setDomains(updated);
                                  }}
                                  className="h-9 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs font-semibold">Max Score</Label>
                                <Input
                                  type="number"
                                  value={dom.maxScore}
                                  onChange={(e) => {
                                    const updated = [...domains];
                                    updated[domIdx].maxScore = Number(e.target.value);
                                    setDomains(updated);
                                  }}
                                  className="h-9 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {domains.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-3">
                          No sub-parameters/domains defined for this assessment.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-muted shadow-sm">
                    <CardHeader className="p-4 pb-3">
                      <CardTitle className="text-sm font-semibold">Score Range</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div className="flex flex-wrap items-center gap-4 py-2">
                        <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-md border text-sm">
                          <span className="text-muted-foreground font-medium">Min Score:</span>
                          <span className="font-semibold text-primary">{minScore}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 rounded-md border text-sm">
                          <span className="text-muted-foreground font-medium">Max Score:</span>
                          <span className="font-semibold text-primary">{maxScore}</span>
                          <span className="text-xs text-muted-foreground italic ml-1">
                            (Auto-calculated from questions)
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-muted shadow-sm">
                    <CardHeader className="p-4 pb-3 flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-sm font-semibold">Interpretation Bands</CardTitle>
                      <Button onClick={addBand} size="sm" variant="outline" className="h-9 text-sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Band
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      {interpretationBands.map((band, index) => (
                        <div key={index} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end p-3 border rounded-md bg-muted/30">
                          <div className="w-full sm:w-24 space-y-2 flex-shrink-0">
                            <Label className="text-sm font-medium">Max Score</Label>
                            <Input
                              type="number"
                              value={band.max}
                              onChange={(e) => updateBand(index, 'max', Number(e.target.value))}
                              className="w-full h-10 text-sm"
                            />
                          </div>
                          <div className="flex-[2] space-y-2">
                            <Label className="text-sm font-medium">Label</Label>
                            <Input
                              value={band.label}
                              onChange={(e) => updateBand(index, 'label', e.target.value)}
                              placeholder="e.g., Minimal, Mild, Moderate"
                              className="h-10 text-sm"
                            />
                          </div>
                          <div className="w-full sm:w-28 space-y-2 flex-shrink-0">
                            <Label className="text-sm font-medium">Color</Label>
                            <Select
                              value={band.color}
                              onValueChange={(value) => updateBand(index, 'color', value)}
                            >
                              <SelectTrigger className="h-10 text-sm">
                                <div
                                  className="w-4 h-4 rounded"
                                  style={{ backgroundColor: band.color }}
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {COLORS.map((color) => (
                                  <SelectItem key={color.value} value={color.value} className="text-sm">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-4 h-4 rounded"
                                        style={{ backgroundColor: color.value }}
                                      />
                                      {color.label}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBand(index)}
                            disabled={interpretationBands.length === 1}
                            className="mt-0 sm:mt-5 h-8"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {interpretationBands.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-3">
                          No bands. Click &quot;Add&quot; to create one.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="questions" className="space-y-3 mt-0 data-[state=active]:block data-[state=inactive]:hidden">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                      {questions.length} question{questions.length !== 1 ? 's' : ''}
                    </p>
                    <Button onClick={() => openQuestionModal()} size="sm" className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>

                  {questions.length === 0 ? (
                    <Card className="border-muted">
                      <CardContent className="flex flex-col items-center justify-center py-8">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                        <h3 className="text-sm font-semibold mb-1">No questions yet</h3>
                        <p className="text-xs text-muted-foreground mb-3">Add your first question to get started</p>
                        <Button onClick={() => openQuestionModal()} size="sm" className="h-7 text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Add Question
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={questions.map((q, i) => q.id || `question-${i}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {questions.map((question, index) => (
                            <SortableQuestionItem
                              key={question.id || `question-${index}`}
                              question={question}
                              index={index}
                              onEdit={openQuestionModal}
                              onDelete={deleteQuestion}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </TabsContent>
                </Tabs>
                </div>
            </div>

            {/* Footer Section */}
            <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-muted/20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
              <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
                <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex-1 sm:flex-initial h-10 text-sm min-w-[100px]">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="flex-1 sm:flex-initial h-10 text-sm min-w-[140px]">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Assessment
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}

        {/* Question Builder Modal */}
        {editingQuestion && (
          <QuestionBuilderModal
            question={editingQuestion}
            open={questionModalOpen}
            onClose={() => {
              setQuestionModalOpen(false);
              setEditingQuestion(null);
            }}
            onSave={saveQuestion}
            domains={domains}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

interface QuestionBuilderModalProps {
  question: Question;
  open: boolean;
  onClose: () => void;
  onSave: (question: Question) => void;
  domains?: any[];
}

const QuestionBuilderModal: React.FC<QuestionBuilderModalProps> = ({
  question,
  open,
  onClose,
  onSave,
  domains = []
}) => {
  const initialResponseType = RESPONSE_TYPE_VALUES.includes(question.responseType)
    ? question.responseType
    : 'likert';

  const [text, setText] = useState(question.text);
  const [responseType, setResponseType] = useState(initialResponseType);
  const [reverseScored, setReverseScored] = useState(question.reverseScored || false);
  const [options, setOptions] = useState<ResponseOption[]>(question.options);
  const [customizeOptions, setCustomizeOptions] = useState(false);
  const [domain, setDomain] = useState(question.domain || '');

  useEffect(() => {
    setText(question.text);
    setResponseType(RESPONSE_TYPE_VALUES.includes(question.responseType) ? question.responseType : 'likert');
    setReverseScored(question.reverseScored || false);
    setOptions(question.options);
    setDomain(question.domain || '');

    // Auto-detect standard presets
    const isStandardLikert = question.responseType === 'likert' &&
      question.options.length === 4 &&
      question.options[0]?.value === 0 && question.options[0]?.text === 'Not at all' &&
      question.options[1]?.value === 1 && question.options[1]?.text === 'Several days' &&
      question.options[2]?.value === 2 && question.options[2]?.text === 'More than half the days' &&
      question.options[3]?.value === 3 && question.options[3]?.text === 'Nearly every day';

    const isStandardLikert5 = question.responseType === 'likert_5' &&
      question.options.length === 5 &&
      question.options[0]?.value === 0 && question.options[0]?.text === 'Never' &&
      question.options[1]?.value === 1 && question.options[1]?.text === 'Almost never' &&
      question.options[2]?.value === 2 && question.options[2]?.text === 'Sometimes' &&
      question.options[3]?.value === 3 && question.options[3]?.text === 'Fairly often' &&
      question.options[4]?.value === 4 && question.options[4]?.text === 'Very often';

    const isStandardBinary = question.responseType === 'binary' &&
      question.options.length === 2 &&
      ((question.options[0]?.value === 1 && question.options[0]?.text === 'Yes' &&
        question.options[1]?.value === 0 && question.options[1]?.text === 'No') ||
       (question.options[0]?.value === 0 && question.options[0]?.text === 'No' &&
        question.options[1]?.value === 1 && question.options[1]?.text === 'Yes'));

    const isPreset = isStandardLikert || isStandardLikert5 || isStandardBinary;
    setCustomizeOptions(!isPreset && question.options.length > 0);
  }, [question]);

  const handleResponseTypeChange = (newType: string) => {
    setResponseType(newType);
    
    // Default preset options
    if (newType === 'likert') {
      setOptions([
        { value: 0, text: 'Not at all', order: 1 },
        { value: 1, text: 'Several days', order: 2 },
        { value: 2, text: 'More than half the days', order: 3 },
        { value: 3, text: 'Nearly every day', order: 4 }
      ]);
    } else if (newType === 'likert_5') {
      setOptions([
        { value: 0, text: 'Never', order: 1 },
        { value: 1, text: 'Almost never', order: 2 },
        { value: 2, text: 'Sometimes', order: 3 },
        { value: 3, text: 'Fairly often', order: 4 },
        { value: 4, text: 'Very often', order: 5 }
      ]);
    } else if (newType === 'binary') {
      setOptions([
        { value: 1, text: 'Yes', order: 1 },
        { value: 0, text: 'No', order: 2 }
      ]);
    } else if (newType === 'multiple_choice') {
      setOptions([
        { value: 0, text: 'Option 1', order: 1 },
        { value: 1, text: 'Option 2', order: 2 }
      ]);
    }
  };

  const addOption = () => {
    setOptions((prev) => {
      const newValue = prev.length;
      return [
        ...prev,
        { value: newValue, text: '', order: prev.length + 1 }
      ];
    });
  };

  const updateOption = (index: number, field: keyof ResponseOption, value: string | number) => {
    setOptions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeOption = (index: number) => {
    setOptions((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((option, idx) => ({ ...option, order: idx + 1 }))
    );
  };

  const handleSave = () => {
    if (!text.trim()) {
      return;
    }

    const sanitizedOptions = options
      .filter((opt) => opt.text.trim() !== '')
      .map((opt, index) => ({
        ...opt,
        text: opt.text.trim(),
        order: index + 1
      }));

    if (!sanitizedOptions.length) {
      return;
    }

    onSave({
      ...question,
      text: text.trim(),
      responseType,
      domain: (domain === '_none' || !domain) ? undefined : domain.trim(),
      reverseScored,
      options: sanitizedOptions
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[95vw] h-[85vh] max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header Section */}
        <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-4 border-b bg-muted/20">
          <DialogTitle className="text-lg font-semibold">
            {question.id ? 'Edit Question' : 'Add New Question'}
          </DialogTitle>
        </DialogHeader>

        {/* Content Section */}
        <div className="flex-1 overflow-hidden min-h-0 bg-muted/10">
          <ScrollArea className="h-full w-full">
            <div className="px-6 py-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="questionText" className="text-sm font-medium text-foreground">Question Text *</Label>
              <Textarea
                id="questionText"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter your question"
                rows={3}
                className="text-sm resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="responseType" className="text-sm font-medium text-foreground">Response Type</Label>
              <Select value={responseType} onValueChange={handleResponseTypeChange}>
                <SelectTrigger id="responseType" className="h-10 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESPONSE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-sm">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {domains && domains.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="questionDomain" className="text-sm font-medium text-foreground">Domain (Optional)</Label>
                <Select value={domain || '_none'} onValueChange={setDomain}>
                  <SelectTrigger id="questionDomain" className="h-10 text-sm">
                    <SelectValue placeholder="Select a domain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none" className="text-sm">None / Overall Only</SelectItem>
                    {domains.map((dom) => (
                      <SelectItem key={dom.id} value={dom.id} className="text-sm">
                        {dom.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center space-x-2 py-1">
              <Switch
                id="reverseScored"
                checked={reverseScored}
                onCheckedChange={setReverseScored}
              />
              <Label htmlFor="reverseScored" className="text-sm font-medium cursor-pointer">Reverse Scored (higher = better)</Label>
            </div>

            <div className="flex items-center space-x-2 py-1">
              <Checkbox
                id="customizeOptions"
                checked={customizeOptions}
                onCheckedChange={(checked) => setCustomizeOptions(Boolean(checked))}
              />
              <Label htmlFor="customizeOptions" className="text-sm font-medium cursor-pointer">Customize option text and values</Label>
            </div>

            {customizeOptions ? (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <Label className="text-sm font-medium text-foreground">Response Options</Label>
                  <Button onClick={addOption} size="sm" variant="outline" className="h-9 text-sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>

                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <div className="w-20">
                        <Input
                          type="number"
                          value={option.value ?? ''}
                          onChange={(e) => updateOption(index, 'value', Number(e.target.value))}
                          placeholder="Value"
                          className="text-sm h-10"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Input
                          value={option.text}
                          onChange={(e) => updateOption(index, 'text', e.target.value)}
                          placeholder="Option text (e.g., Not at all)"
                          className="text-sm h-10"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(index)}
                        disabled={options.length === 1}
                        className="flex-shrink-0 h-10 w-10 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-muted/40 border border-muted rounded-md text-xs text-muted-foreground italic">
                Using standard preset options for {RESPONSE_TYPES.find(r => r.value === responseType)?.label || responseType}.
              </div>
            )}
            </div>
          </ScrollArea>
        </div>

        {/* Footer Section */}
        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-muted/20 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
            <Button variant="outline" onClick={onClose} className="flex-1 sm:flex-initial h-10 text-sm min-w-[100px]">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!text.trim() || options.filter((opt) => opt.text.trim()).length === 0}
              className="flex-1 sm:flex-initial h-10 text-sm min-w-[130px]"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Question
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
