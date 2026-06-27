// Assessment Management UI - Updated
import {
  Plus,
  Brain,
  BookOpen,
  Shield,
  FileText,
  Headphones,
  Video,
  BookMarked,
  Mic,
  Heart,
  Loader2,
  AlertCircle,
  Clock,
  ClipboardList,
  BarChart3,
  Users,
  Stethoscope,
  Activity,
  HelpCircle,
  AlertTriangle,
  Inbox
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../components/ui/alert-dialog';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Skeleton } from '../components/ui/skeleton';

import { useAdminAuth } from '../contexts/AdminAuthContext';
import { adminApi, type ApiResponse } from '../services/api';
import { useNotificationStore } from '../stores/notificationStore';

import { ActivityLog } from './ActivityLog';
import { AdminOverview } from './AdminOverview';
import { AdminSectionCard } from './AdminSectionCard';
import { AdminShell } from './AdminShell';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { AssessmentBuilder } from './AssessmentBuilder';
import { AssessmentList, Assessment } from './AssessmentList';
import { AdvancedAnalyticsDashboard } from './components/AdvancedAnalyticsDashboard';
import { ContentForm, ContentRecord } from './ContentForm';
import { ContentList, ContentItem } from './ContentList';
import { CrisisResourceManagement } from './CrisisResourceManagement';
import { FAQManagement } from './FAQManagement';
import { PracticeForm, PracticeRecord } from './PracticeForm';
import { PracticesList, Practice } from './PracticesList';
import { SupportTicketManagement } from './SupportTicketManagement';
import { SystemDiagnostics } from './SystemDiagnostics';
import { TherapistManagement } from './TherapistManagement';
import { UserManagement } from './UserManagement';
import { useAdminContent, useAdminPractices } from './hooks/useAdminQueries';

const PRACTICE_LEVELS: Practice['level'][] = ['Beginner', 'Intermediate', 'Advanced'];

const normalizePracticeLevel = (level?: string | null): Practice['level'] => {
  if (level && PRACTICE_LEVELS.includes(level as Practice['level'])) {
    return level as Practice['level'];
  }
  return 'Beginner';
};

const normalizeTags = (raw?: string[] | string | null): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(tag => tag.trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);
  }
  return [];
};

const mapPractice = (rec: PracticeRecord): Practice => {
  const maybeDifficulty = (rec as unknown as { difficulty?: string | null }).difficulty;
  const levelOrDifficulty = rec.level ?? maybeDifficulty;
  return {
    id: rec.id,
    title: rec.title,
    category: rec.type,
    types: rec.type,
    type: rec.type,
    duration: rec.duration,
    level: normalizePracticeLevel(levelOrDifficulty),
    difficulty: normalizePracticeLevel(levelOrDifficulty),
    approach: rec.approach,
    format: rec.format,
    description: rec.description,
    audioUrl: rec.audioUrl,
    videoUrl: rec.videoUrl,
    youtubeUrl: rec.youtubeUrl,
    thumbnailUrl: rec.thumbnailUrl,
    tags: normalizeTags(rec.tags),
    isPublished: rec.isPublished,
    scheduledPublishAt: rec.scheduledPublishAt ?? null,
    createdAt:
      typeof (rec as unknown as { createdAt?: string }).createdAt === 'string'
        ? (rec as unknown as { createdAt?: string }).createdAt!
        : new Date().toISOString()
  };
};

const mapContent = (rec: ContentRecord): ContentItem => {
  return {
    id: rec.id,
    title: rec.title,
    type: rec.type,
    approach: rec.approach,
    category: rec.category,
    difficulty: rec.difficulty,
    isPublished: rec.isPublished,
    createdAt:
      typeof (rec as unknown as { createdAt?: string }).createdAt === 'string'
        ? (rec as unknown as { createdAt?: string }).createdAt!
        : new Date().toISOString(),
    description: rec.description || undefined,
    thumbnailUrl: rec.thumbnailUrl || undefined,
    tags: normalizeTags(rec.tags),
    scheduledPublishAt: rec.scheduledPublishAt ?? null
  };
};

type Tab =
  | 'overview'
  | 'practices'
  | 'content'
  | 'assessments'
  | 'therapists'
  | 'faqs'
  | 'crisis-resources'
  | 'support-tickets'
  | 'analytics'
  | 'advanced-analytics'
  | 'diagnostics'
  | 'users'
  | 'activity';

interface AdminDashboardProps {
  onNavigate?: (page: any) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { admin, adminLogout } = useAdminAuth();
  const { push } = useNotificationStore();
  const [tab, setTab] = useState<Tab>('overview');

  const [practices, setPractices] = useState<Practice[]>([]);
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const practicesQuery = useAdminPractices(Boolean(admin));
  const contentQuery = useAdminContent(Boolean(admin));

  const isLoading = practicesQuery.isLoading || contentQuery.isLoading;
  const isSyncing = practicesQuery.isFetching || contentQuery.isFetching;
  const queryError = practicesQuery.error ?? contentQuery.error;
  const error = queryError instanceof Error ? queryError.message : null;

  const refreshAll = useCallback(async () => {
    await Promise.all([practicesQuery.refetch(), contentQuery.refetch()]);
    setLastUpdated(new Date().toISOString());
  }, [contentQuery, practicesQuery]);

  const markUpdated = useCallback(() => {
    setLastUpdated(new Date().toISOString());
  }, []);

  useEffect(() => {
    if (!admin) {
      setPractices([]);
      setContentItems([]);
      setLastUpdated(null);
      return;
    }

    if (practicesQuery.data) {
      setPractices(
        practicesQuery.data.map((record) => mapPractice(record as unknown as PracticeRecord))
      );
      setLastUpdated(new Date().toISOString());
    }
  }, [admin, practicesQuery.data]);

  useEffect(() => {
    if (!admin) {
      return;
    }

    if (contentQuery.data) {
      setContentItems(
        contentQuery.data.map((record) => mapContent(record as unknown as ContentRecord))
      );
      setLastUpdated(new Date().toISOString());
    }
  }, [admin, contentQuery.data]);

  useEffect(() => {
    if (queryError instanceof Error) {
      push({
        type: 'error',
        title: 'Error',
        description: queryError.message
      });
    }
  }, [push, queryError]);

  const [selectedContentType, setSelectedContentType] = useState<string | null>(null);
  type EditablePractice = PracticeRecord | Practice;
  type EditableContent = ContentRecord | ContentItem;
  const [editingPractice, setEditingPractice] = useState<EditablePractice | null>(null);
  const [editingContent, setEditingContent] = useState<EditableContent | null>(null);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [assessmentBuilderOpen, setAssessmentBuilderOpen] = useState(false);
  const [assessmentRefreshToken, setAssessmentRefreshToken] = useState(0);
  const [activeModal, setActiveModal] = useState<'form' | 'add-practice' | 'add-content' | null>(null);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [assessmentCount, setAssessmentCount] = useState<number | null>(null);
  const [isLoadingAssessments, setIsLoadingAssessments] = useState(false);

  const openAssessmentBuilder = useCallback(() => {
    setTab('assessments');
    setEditingAssessment(null);
    setAssessmentBuilderOpen(true);
  }, []);

  const handleEditAssessment = useCallback((assessment: Assessment) => {
    setTab('assessments');
    setEditingAssessment(assessment);
    setAssessmentBuilderOpen(true);
  }, []);

  const goToAssessments = useCallback(() => {
    setTab('assessments');
  }, []);

  const closeForm = useCallback(() => {
    setActiveModal(null);
    setEditingPractice(null);
    setEditingContent(null);
    setSelectedContentType(null);
  }, []);

  useEffect(() => {
    if (!admin) {
      closeForm();
    }
  }, [admin, closeForm]);

  const openAdd = useCallback(() => {
    if (tab === 'assessments') {
      openAssessmentBuilder();
    } else {
      setSelectedContentType(null);
      setEditingPractice(null);
      setEditingContent(null);
      setActiveModal(tab === 'content' ? 'add-content' : 'add-practice');
    }
  }, [tab, openAssessmentBuilder]);

  const openAddForm = useCallback(
    (type?: string) => {
      setEditingPractice(null);
      setEditingContent(null);
      if (tab === 'content') {
        setSelectedContentType(type ?? null);
      }
      setActiveModal('form');
    },
    [tab]
  );

  const handleEditPractice = useCallback((practice: EditablePractice) => {
    setTab('practices');
    setEditingPractice(practice);
    setEditingContent(null);
    setActiveModal('form');
  }, []);

  const handleEditContent = useCallback((content: EditableContent) => {
    setTab('content');
    setEditingContent(content);
    setEditingPractice(null);
    setActiveModal('form');
  }, []);

  const triggerAssessmentRefresh = useCallback(() => {
    setAssessmentRefreshToken((prev) => prev + 1);
  }, []);

  const handleLogout = useCallback(() => {
    setLogoutDialogOpen(true);
  }, []);

  const handleConfirmLogout = useCallback(async () => {
    try {
      await adminLogout();
      push({ type: 'success', title: 'Success', description: 'Successfully logged out' });
    } catch (error) {
      push({
        type: 'error',
        title: 'Logout failed',
        description: error instanceof Error ? error.message : 'Unable to log out right now'
      });
    } finally {
      setLogoutDialogOpen(false);
    }
  }, [adminLogout, push]);

  const handleRefresh = useCallback(() => {
    void refreshAll();
    triggerAssessmentRefresh();
  }, [refreshAll, triggerAssessmentRefresh]);

  const handlePracticeSaved = useCallback(
    (saved: PracticeRecord) => {
      const mapped = mapPractice(saved);
      setPractices(prev => {
        const index = prev.findIndex(item => item.id === mapped.id);
        if (index >= 0) {
          const copy = [...prev];
          copy[index] = mapped;
          return copy;
        }
        return [mapped, ...prev];
      });
      markUpdated();
      closeForm();
    },
    [setPractices, markUpdated, closeForm]
  );

  const handleContentSaved = useCallback(
    (saved: ContentRecord) => {
      const mapped = mapContent(saved);
      setContentItems(prev => {
        const index = prev.findIndex(item => item.id === mapped.id);
        if (index >= 0) {
          const copy = [...prev];
          copy[index] = mapped;
          return copy;
        }
        return [mapped, ...prev];
      });
      markUpdated();
      closeForm();
    },
    [setContentItems, markUpdated, closeForm]
  );

  const loadAssessmentStats = useCallback(async () => {
    if (!admin) {
      setAssessmentCount(null);
      return;
    }

    try {
      setIsLoadingAssessments(true);
      const response = await adminApi.listAssessments() as ApiResponse<Assessment[]>;
      if (response.success && response.data) {
        setAssessmentCount(response.data.length);
      } else {
        setAssessmentCount(null);
      }
    } catch (err) {
      console.error('Failed to load assessment stats:', err);
      setAssessmentCount(null);
      push({
        type: 'error',
        title: 'Assessment sync failed',
        description: err instanceof Error ? err.message : 'Unable to load assessments summary'
      });
    } finally {
      setIsLoadingAssessments(false);
    }
  }, [admin, push]);

  useEffect(() => {
    void loadAssessmentStats();
  }, [loadAssessmentStats, assessmentRefreshToken]);

  const formattedLastUpdated = useMemo(() => {
    if (!lastUpdated) return null;
    try {
      return new Date(lastUpdated).toLocaleString();
    } catch {
      return lastUpdated;
    }
  }, [lastUpdated]);

  const navItems = useMemo(
    () => [
      {
        value: 'overview' as const,
        label: 'Overview',
        icon: Activity,
        group: 'General'
      },
      {
        value: 'practices' as const,
        label: 'Practices',
        icon: Brain,
        badge: practices.length.toString(),
        group: 'Content'
      },
      {
        value: 'content' as const,
        label: 'Content',
        icon: BookOpen,
        badge: contentItems.length.toString(),
        group: 'Content'
      },
      {
        value: 'assessments' as const,
        label: 'Assessments',
        icon: ClipboardList,
        badge: isLoadingAssessments
          ? '…'
          : typeof assessmentCount === 'number'
            ? assessmentCount.toString()
            : undefined,
        group: 'Content'
      },
      {
        value: 'therapists' as const,
        label: 'Therapists',
        icon: Stethoscope,
        group: 'People'
      },
      {
        value: 'faqs' as const,
        label: 'FAQs',
        icon: HelpCircle,
        group: 'Support'
      },
      {
        value: 'crisis-resources' as const,
        label: 'Crisis Resources',
        icon: AlertTriangle,
        group: 'Support'
      },
      {
        value: 'support-tickets' as const,
        label: 'Support Tickets',
        icon: Inbox,
        group: 'Support'
      },
      {
        value: 'analytics' as const,
        label: 'Analytics',
        icon: BarChart3,
        group: 'Analytics'
      },
      {
        value: 'advanced-analytics' as const,
        label: 'Advanced Analytics',
        icon: Brain,
        group: 'Analytics'
      },
      {
        value: 'diagnostics' as const,
        label: 'System Diagnostics',
        icon: Activity,
        group: 'System'
      },
      {
        value: 'users' as const,
        label: 'Users',
        icon: Users,
        group: 'People'
      },
      {
        value: 'activity' as const,
        label: 'Activity Log',
        icon: Shield,
        group: 'System'
      }
    ],
    [practices.length, contentItems.length, isLoadingAssessments, assessmentCount]
  );

  const headerActions = (
    <div className="flex items-center gap-2.5">
      {onNavigate && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('dashboard')}
        >
          Web App View
        </Button>
      )}
      <Button
        variant="outline"
        onClick={handleRefresh}
        disabled={isSyncing}
        className="flex items-center gap-2"
        size="sm"
      >
        <Loader2 className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">Refresh</span>
        <span className="sm:hidden">Sync</span>
      </Button>
    </div>
  );

  const lastUpdatedLabel = formattedLastUpdated ? (
    <>
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Updated {formattedLastUpdated}</span>
    </>
  ) : null;

  const stats = useMemo(() => {
    return [
      {
        title: 'Total Practices',
        description: 'Guided exercises available for clinicians to assign',
        value: practices.length,
        icon: Brain,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50'
      },
      {
        title: 'Content Items',
        description: 'Articles, audio and video resources in the library',
        value: contentItems.length,
        icon: BookOpen,
        color: 'text-green-600',
        bgColor: 'bg-green-50'
      },
      {
        title: 'Published',
        description: 'Live resources visible to users',
        value: [...practices, ...contentItems].filter(item => item.isPublished).length,
        icon: Shield,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50'
      },
      {
        title: 'Assessments',
        description: 'Dynamic assessment forms available to assign',
        value: isLoadingAssessments
          ? '…'
          : typeof assessmentCount === 'number'
            ? assessmentCount
            : '—',
        icon: ClipboardList,
        color: 'text-teal-600',
        bgColor: 'bg-teal-50'
      }
    ];
  }, [practices, contentItems, assessmentCount, isLoadingAssessments]);

  const hasData = practices.length > 0 || contentItems.length > 0;
  const isInitialLoading = isLoading && !hasData;

  const isFormOpen = activeModal === 'form';
  const isPracticePickerOpen = activeModal === 'add-practice';
  const isContentPickerOpen = activeModal === 'add-content';
  const isEditingPractice = editingPractice !== null;
  const formTitle = isEditingPractice
    ? 'Update Practice'
    : editingContent
      ? 'Update Content'
      : tab === 'practices'
        ? 'Add Practice'
        : 'Add Content';

  const renderActiveSection = () => {
    if (tab === 'overview') {
      return <AdminOverview onNavigate={(value) => setTab(value as Tab)} />;
    }

    if (tab === 'practices') {
      return (
        <AdminSectionCard
          icon={Brain}
          title="Practices Management"
          description="Curate guided exercises for clinicians to assign and maintain tailored practice libraries."
          actions={
            <Button size="sm" className="gap-2" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add Practice
            </Button>
          }
        >
          <PracticesList
            embedded
            onAdd={openAdd}
            onEdit={handleEditPractice}
            itemsExternal={practices}
            setItemsExternal={setPractices}
          />
        </AdminSectionCard>
      );
    }

    if (tab === 'content') {
      return (
        <AdminSectionCard
          icon={BookOpen}
          title="Content Management"
          description="Publish articles, audio sessions, and multimedia resources that enrich the wellbeing library."
          actions={
            <Button size="sm" className="gap-2" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add Content
            </Button>
          }
        >
          <ContentList
            embedded
            onAdd={openAdd}
            onEdit={handleEditContent}
            itemsExternal={contentItems}
            setItemsExternal={setContentItems}
          />
        </AdminSectionCard>
      );
    }

    if (tab === 'assessments') {
      return (
        <AdminSectionCard
          icon={ClipboardList}
          title="Assessment Management"
          description="Design, revise, and monitor adaptive assessments to track participant progress."
          actions={
            <Button size="sm" className="gap-2" onClick={openAssessmentBuilder}>
              <Plus className="h-4 w-4" />
              New Assessment
            </Button>
          }
        >
          <AssessmentList
            refreshToken={assessmentRefreshToken}
            onAdd={openAssessmentBuilder}
            onEdit={handleEditAssessment}
          />
        </AdminSectionCard>
      );
    }

    if (tab === 'therapists') {
      return <TherapistManagement onRefresh={refreshAll} />;
    }

    if (tab === 'faqs') {
      return <FAQManagement />;
    }

    if (tab === 'crisis-resources') {
      return <CrisisResourceManagement />;
    }

    if (tab === 'support-tickets') {
      return <SupportTicketManagement />;
    }

    if (tab === 'analytics') {
      return <AnalyticsDashboard />;
    }

    if (tab === 'advanced-analytics') {
      return <AdvancedAnalyticsDashboard />;
    }

    if (tab === 'diagnostics') {
      return <SystemDiagnostics />;
    }

    if (tab === 'users') {
      return <UserManagement />;
    }

    if (tab === 'activity') {
      return <ActivityLog />;
    }

    return null;
  };

  return (
    <>
        <AdminShell
          admin={admin}
          onLogout={handleLogout}
          navItems={navItems}
          activeItem={tab}
          onSelect={(value) => setTab(value as Tab)}
          headerActions={headerActions}
          lastUpdatedLabel={lastUpdatedLabel}
        >
          <div className="space-y-6" aria-busy={isLoading}>
            <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {isInitialLoading
                ? Array.from({ length: 4 }).map((_, index) => (
                    <Card key={`stat-skeleton-${index}`}>
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center space-x-4">
                          <Skeleton className="h-12 w-12 rounded-lg" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-6 w-16" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                : stats.map((stat, index) => (
                    <Card key={index}>
                      <CardContent className="p-4 sm:p-6">
                        <div className="flex items-center space-x-3 sm:space-x-4">
                          <div className={`p-2 sm:p-3 rounded-lg ${stat.bgColor}`}>
                            <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                              {stat.title}
                            </p>
                            <p className="text-xl sm:text-2xl font-bold">
                              {stat.value}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
            </div>

            {tab !== 'assessments' && (
              <Card className="border-dashed border-teal-200 bg-teal-50/30">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ClipboardList className="h-5 w-5 text-teal-600" />
                      Assessment Tools
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Build, review, and assign dynamic assessments without leaving the dashboard.
                    </p>
                  </div>
                  <Badge variant="outline" className="px-3 py-1 text-sm">
                    {isLoadingAssessments
                      ? 'Syncing…'
                      : typeof assessmentCount === 'number'
                        ? `${assessmentCount} active`
                        : '—'}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Access the assessment builder or browse the full catalogue.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" onClick={goToAssessments} className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Manage Assessments
                    </Button>
                    <Button onClick={openAssessmentBuilder} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      New Assessment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {error && (
              <div
                className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                role="alert"
                aria-live="assertive"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  className="mt-3"
                >
                  Retry sync
                </Button>
              </div>
            )}

            {isSyncing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Syncing latest data…
              </div>
            )}

            <div className="space-y-6">
              {renderActiveSection()}
            </div>
          </div>
        </AdminShell>

        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeForm();
            } else {
              setActiveModal('form');
            }
          }}
        >
          <DialogContent className="admin-dialog-content">
            <DialogHeader className="admin-dialog-header px-6 pt-6 pb-4 border-b">
              <div className="flex items-center gap-3">
                {tab === 'practices' ? (
                  <Brain className="h-5 w-5 text-primary" />
                ) : (
                  <BookOpen className="h-5 w-5 text-primary" />
                )}
                <DialogTitle className="text-lg sm:text-xl font-semibold">{formTitle}</DialogTitle>
              </div>
              <DialogDescription>
                {tab === 'practices'
                  ? 'Create or update mindfulness practices and exercises.'
                  : 'Create or update content entries for your wellbeing library.'}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="admin-dialog-scroll">
              <div className="admin-dialog-body px-6 py-6">
                {tab === 'practices' ? (
                  <PracticeForm
                    existing={editingPractice ?? undefined}
                    onSaved={handlePracticeSaved}
                    onClose={closeForm}
                  />
                ) : (
                  <ContentForm
                    existing={editingContent ?? undefined}
                    selectedType={selectedContentType}
                    onSaved={handleContentSaved}
                    onClose={closeForm}
                  />
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

      <Dialog
        open={isContentPickerOpen}
        onOpenChange={(open) => {
          if (open) {
            setActiveModal('add-content');
          } else {
            setActiveModal(prev => (prev === 'add-content' ? null : prev));
          }
        }}
      >
        <DialogContent className="max-w-xl w-full space-y-6">
          <DialogHeader className="space-y-2 text-center">
            <div className="flex justify-center">
              <BookOpen className="h-12 w-12 text-primary" />
            </div>
            <DialogTitle className="text-2xl font-semibold">Add New Content</DialogTitle>
            <DialogDescription>Choose the type of content you want to create</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              className="w-full justify-start h-auto p-4"
              variant="outline"
              onClick={() => openAddForm('article')}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Article</div>
                  <div className="text-sm text-muted-foreground">Written content and guides</div>
                </div>
              </div>
            </Button>

            <Button
              className="w-full justify-start h-auto p-4"
              variant="outline"
              onClick={() => openAddForm('audio')}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Headphones className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Audio</div>
                  <div className="text-sm text-muted-foreground">Podcasts and audio content</div>
                </div>
              </div>
            </Button>

            <Button
              className="w-full justify-start h-auto p-4"
              variant="outline"
              onClick={() => openAddForm('video')}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Video className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Video</div>
                  <div className="text-sm text-muted-foreground">Video tutorials and sessions</div>
                </div>
              </div>
            </Button>

            <Button
              className="w-full justify-start h-auto p-4"
              variant="outline"
              onClick={() => openAddForm('playlist')}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Video className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Playlist</div>
                  <div className="text-sm text-muted-foreground">Curated content collections</div>
                </div>
              </div>
            </Button>

            <Button
              className="w-full justify-start h-auto p-4"
              variant="outline"
              onClick={() => openAddForm('story')}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <BookMarked className="h-6 w-6 text-orange-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Story</div>
                  <div className="text-sm text-muted-foreground">Inspirational stories and experiences</div>
                </div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPracticePickerOpen}
        onOpenChange={(open) => {
          if (open) {
            setActiveModal('add-practice');
          } else {
            setActiveModal(prev => (prev === 'add-practice' ? null : prev));
          }
        }}
      >
        <DialogContent className="max-w-md w-full space-y-4">
          <DialogHeader className="space-y-2 text-center">
            <div className="flex justify-center">
              <Brain className="h-10 w-10 text-primary" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-semibold">Add New Practice</DialogTitle>
            <DialogDescription>Choose the type of practice you want to create</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              className="w-full justify-start h-auto p-3 sm:p-4"
              variant="outline"
              onClick={() => openAddForm('meditation')}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
                  <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm sm:text-base">Meditation</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Guided meditation sessions</div>
                </div>
              </div>
            </Button>

            <Button
              className="w-full justify-start h-auto p-3 sm:p-4"
              variant="outline"
              onClick={() => openAddForm('breathing')}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                  <Mic className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm sm:text-base">Breathing Exercise</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Breathwork and breathing techniques</div>
                </div>
              </div>
            </Button>

            <Button
              className="w-full justify-start h-auto p-3 sm:p-4"
              variant="outline"
              onClick={() => openAddForm('mindfulness')}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                  <Heart className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm sm:text-base">Mindfulness</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Mindfulness and awareness practices</div>
                </div>
              </div>
            </Button>

            <Button
              className="w-full justify-start h-auto p-3 sm:p-4"
              variant="outline"
              onClick={() => openAddForm('cbt')}
            >
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
                  <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm sm:text-base">CBT Exercise</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Cognitive behavioral therapy techniques</div>
                </div>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assessment Builder Dialog */}
      <AssessmentBuilder
        assessment={editingAssessment}
        open={assessmentBuilderOpen}
        onClose={() => {
          setAssessmentBuilderOpen(false);
          setEditingAssessment(null);
        }}
        onSave={() => {
          triggerAssessmentRefresh();
        }}
      />

      <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to log out of the admin console?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { void handleConfirmLogout(); }}>
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AdminDashboard;
