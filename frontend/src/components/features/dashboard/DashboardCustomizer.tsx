import { Eye, EyeOff, Settings } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { Button } from '../../ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from '../../ui/dialog';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';

export type DashboardWidget = 
	| 'greeting-header'
	| 'mood-check'
	| 'stats-row'
	| 'crisis-follow-up'
	| 'checkins'
	| 'smart-nudges'
	| 'community-insights'
	| 'assessment-reminder'
	| 'gratitude'
	| 'habits'
	| 'intentions-sleep'
	| 'today-practice'
	| 'quick-actions'
	| 'recent-insights'
	| 'this-week'
	| 'navigation-shortcuts';

export interface WidgetVisibility {
	'greeting-header': boolean;
	'mood-check': boolean;
	'stats-row': boolean;
	'crisis-follow-up': boolean;
	'checkins': boolean;
	'smart-nudges': boolean;
	'community-insights': boolean;
	'assessment-reminder': boolean;
	'gratitude': boolean;
	'habits': boolean;
	'intentions-sleep': boolean;
	'today-practice': boolean;
	'quick-actions': boolean;
	'recent-insights': boolean;
	'this-week': boolean;
	'navigation-shortcuts': boolean;
}

const DEFAULT_VISIBILITY: WidgetVisibility = {
	'greeting-header': true,
	'mood-check': true,
	'stats-row': true,
	'crisis-follow-up': false,
	'checkins': false,
	'smart-nudges': false,
	'community-insights': false,
	'assessment-reminder': false,
	'gratitude': false,
	'habits': false,
	'intentions-sleep': false,
	'today-practice': true,
	'quick-actions': true,
	'recent-insights': true,
	'this-week': true,
	'navigation-shortcuts': true
};

const WIDGET_LABELS: Record<DashboardWidget, string> = {
	'greeting-header': 'Greeting Header',
	'mood-check': 'Quick Mood Check',
	'stats-row': 'Weekly Snapshot',
	'crisis-follow-up': 'Crisis Follow-up',
	'checkins': 'Morning/Evening Check-ins',
	'smart-nudges': 'Smart Nudges',
	'community-insights': 'Community Insights',
	'assessment-reminder': 'Assessment Reminder',
	'gratitude': 'Daily Gratitude Prompt',
	'habits': 'Habit Loops',
	'intentions-sleep': 'Intentions & Sleep',
	'today-practice': 'Recommended Practices',
	'quick-actions': 'Quick Actions',
	'recent-insights': 'Recent Insights',
	'this-week': 'This Week',
	'navigation-shortcuts': 'Navigation Shortcuts'
};

const WIDGET_GROUPS: Array<{ id: string; title: string; widgets: DashboardWidget[] }> = [
	{
		id: 'foundational',
		title: 'Foundation',
		widgets: ['greeting-header', 'mood-check', 'stats-row']
	},
	{
		id: 'adaptive-support',
		title: 'Adaptive Support',
		widgets: ['crisis-follow-up', 'checkins', 'smart-nudges', 'community-insights', 'assessment-reminder']
	},
	{
		id: 'growth',
		title: 'Growth & Habits',
		widgets: ['gratitude', 'habits', 'intentions-sleep', 'today-practice']
	},
	{
		id: 'insights',
		title: 'Insights & Progress',
		widgets: ['recent-insights', 'this-week']
	},
	{
		id: 'navigation',
		title: 'Navigation',
		widgets: ['quick-actions', 'navigation-shortcuts']
	}
];

const STORAGE_KEY = 'mw-dashboard-widget-visibility-v2';

const resolveStorageKey = (userId?: string | null): string => {
	if (!userId) {
		return STORAGE_KEY;
	}

	return `${STORAGE_KEY}:${userId}`;
};

export interface DashboardCustomizerProps {
	visibility: WidgetVisibility;
	onVisibilityChange: (visibility: WidgetVisibility) => void;
}

export const DashboardCustomizer: React.FC<DashboardCustomizerProps> = ({
	visibility,
	onVisibilityChange
}) => {
	const [open, setOpen] = useState(false);
	const [localVisibility, setLocalVisibility] = useState<WidgetVisibility>(visibility);

	useEffect(() => {
		setLocalVisibility(visibility);
	}, [visibility]);

	const handleToggle = useCallback((widget: DashboardWidget) => {
		setLocalVisibility(prev => ({
			...prev,
			[widget]: !prev[widget]
		}));
	}, []);

	const handleSave = useCallback(() => {
		onVisibilityChange(localVisibility);
		setOpen(false);
	}, [localVisibility, onVisibilityChange]);

	const handleReset = useCallback(() => {
		setLocalVisibility(DEFAULT_VISIBILITY);
	}, []);

	const handleCancel = useCallback(() => {
		setLocalVisibility(visibility);
		setOpen(false);
	}, [visibility]);

	const visibleCount = Object.values(localVisibility).filter(Boolean).length;
	const totalCount = Object.keys(localVisibility).length;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="gap-2">
					<Settings className="h-4 w-4" />
					Customize Dashboard
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
				<DialogHeader>
					<DialogTitle>Customize Your Dashboard</DialogTitle>
					<DialogDescription>
						Show or hide widgets to personalize your dashboard. Your preferences will be saved automatically.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					<div className="flex items-center justify-between pb-4 border-b">
						<div className="space-y-1">
							<p className="text-sm font-medium">Visible Widgets</p>
							<p className="text-xs text-muted-foreground">
								{visibleCount} of {totalCount} widgets shown
							</p>
						</div>
						<Button variant="ghost" size="sm" onClick={handleReset}>
							Reset to Default
						</Button>
					</div>

					<div className="space-y-4">
						{WIDGET_GROUPS.map((group) => (
							<div key={group.id} className="space-y-3">
								<h4 className="text-sm font-semibold text-muted-foreground">{group.title}</h4>
								{group.widgets.map((widget) => (
									<div key={widget} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
										<Label htmlFor={widget} className="flex items-center gap-3 cursor-pointer flex-1">
											{localVisibility[widget] ? (
												<Eye className="h-4 w-4 text-primary" />
											) : (
												<EyeOff className="h-4 w-4 text-muted-foreground" />
											)}
											<span>{WIDGET_LABELS[widget]}</span>
										</Label>
										<Switch
											id={widget}
											checked={localVisibility[widget]}
											onCheckedChange={() => handleToggle(widget)}
										/>
									</div>
								))}
							</div>
						))}
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
					<Button onClick={handleSave}>
						Save Changes
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export const useWidgetVisibility = (userId?: string | null) => {
	const storageKey = resolveStorageKey(userId);

	const readVisibilityFromStorage = useCallback((): WidgetVisibility => {
		if (typeof window === 'undefined') {
			return DEFAULT_VISIBILITY;
		}
		try {
			const stored = localStorage.getItem(storageKey);
			if (!stored) {
				return DEFAULT_VISIBILITY;
			}
			const parsed = JSON.parse(stored) as Partial<WidgetVisibility>;
			return { ...DEFAULT_VISIBILITY, ...parsed };
		} catch (error) {
			console.warn('Failed to load dashboard widget visibility:', error);
			return DEFAULT_VISIBILITY;
		}
	}, [storageKey]);

	const [visibility, setVisibility] = useState<WidgetVisibility>(() => readVisibilityFromStorage());

	useEffect(() => {
		setVisibility(readVisibilityFromStorage());
	}, [readVisibilityFromStorage]);

	const updateVisibility = useCallback((newVisibility: WidgetVisibility) => {
		setVisibility(newVisibility);
		try {
			localStorage.setItem(storageKey, JSON.stringify(newVisibility));
		} catch (error) {
			console.warn('Failed to persist dashboard widget visibility:', error);
		}
	}, [storageKey]);

	return {
		visibility,
		updateVisibility,
		isVisible: useCallback((widget: DashboardWidget) => visibility[widget], [visibility])
	};
};
