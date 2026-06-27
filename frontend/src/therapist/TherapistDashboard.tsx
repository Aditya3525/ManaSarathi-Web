import {
    Calendar, CalendarDays, CheckCircle, Clock, Edit2, Heart,
    Loader2, MessageSquare, Save, Star, Users, X, RefreshCw, Plus
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import { Separator } from '../components/ui/separator';
import { Skeleton } from '../components/ui/skeleton';
import { Textarea } from '../components/ui/textarea';
import { BOOKING_DATE_RANGE_OPTIONS, BOOKING_STATUS_FILTERS, BookingDateRange, TherapistTab } from '../constants/therapist';
import { ClientProfile } from './ClientProfile';
import { ClientsList } from './ClientsList';
import { CrisisAlertsFeed } from './CrisisAlertsFeed';
import { SessionNotesEditor } from './SessionNotesEditor';
import { SessionNotesList } from './SessionNotesList';
import { TherapistCalendar } from './TherapistCalendar';
import {
    TherapistBooking,
    TherapistProfile,
    TherapistStats,
    useTherapistDashboardQueryBundle
} from './hooks/useTherapistQueries';
import { TherapistShell } from './TherapistShell';
import { therapistFetch } from './useTherapistAuth';

// ─── Props ──────────────────────────────────────────────────────────────────
interface TherapistDashboardProps {
    onLogout: () => void;
    therapistName?: string;
}

type DateRange = BookingDateRange;

// ─── Component ──────────────────────────────────────────────────────────────
export function TherapistDashboard({ onLogout, therapistName }: TherapistDashboardProps) {
    const [tab, setTab] = useState<TherapistTab>('overview');
    const [profile, setProfile] = useState<TherapistProfile | null>(null);
    const [originalProfile, setOriginalProfile] = useState<TherapistProfile | null>(null);
    const [saving, setSaving] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [dateRange, setDateRange] = useState<DateRange>('all');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [noteRefreshSignal, setNoteRefreshSignal] = useState(0);
    const [actionBookingId, setActionBookingId] = useState<string | null>(null);
    const [noteInput, setNoteInput] = useState('');
    const [updatingBookingId, setUpdatingBookingId] = useState<string | null>(null);

    const { statsQuery, bookingsQuery, profileQuery, isLoading: loading, refetchAll } = useTherapistDashboardQueryBundle();
    const stats = (statsQuery.data as TherapistStats | undefined) ?? null;
    const bookings = (bookingsQuery.data as TherapistBooking[] | undefined) ?? [];
    const fetchedProfile = (profileQuery.data as TherapistProfile | undefined) ?? null;

    const apiFetch = useCallback(async (path: string, opts: RequestInit = {}) => {
        const res = await therapistFetch(path, opts);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Request failed');
        }
        return res.json();
    }, []);

    const isProfileDirty = Boolean(
        profile && originalProfile && JSON.stringify(profile) !== JSON.stringify(originalProfile)
    );

    useEffect(() => {
        if (!fetchedProfile || isProfileDirty) {
            return;
        }

        setProfile(fetchedProfile);
        setOriginalProfile(JSON.parse(JSON.stringify(fetchedProfile)));
    }, [fetchedProfile, isProfileDirty]);

    useEffect(() => {
        const queryError = statsQuery.error || bookingsQuery.error || profileQuery.error;
        if (queryError instanceof Error) {
            toast.error(queryError.message || 'Unable to load therapist dashboard');
        }
    }, [bookingsQuery.error, profileQuery.error, statsQuery.error]);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isProfileDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isProfileDirty]);

    // ─ Booking actions
    const updateBookingStatus = async (
        id: string,
        status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED',
        note?: string
    ) => {
        if (updatingBookingId === id) {
            return;
        }

        try {
            const resolvedNote = (note ?? noteInput).trim();
            if (status === 'CANCELLED' && resolvedNote.length < 3) {
                toast.warning('Please add a short reason before declining.');
                return;
            }

            setUpdatingBookingId(id);
            const body: any = { status };
            if (resolvedNote) body.therapistNotes = resolvedNote;
            await apiFetch(`/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify(body) });
            toast.success(`Booking ${status.toLowerCase()}`);
            setActionBookingId(null);
            setNoteInput('');
            await refetchAll();
        } catch (e: any) {
            toast.error(e.message || 'Action failed');
        } finally {
            setUpdatingBookingId(null);
        }
    };

    const validateProfile = (): string[] => {
        const errors: string[] = [];
        if (!profile) return ['Profile not loaded'];
        if (!profile.name?.trim()) errors.push('Display name is required');
        if (profile.name && profile.name.length > 100) errors.push('Name must be under 100 characters');
        if (profile.phone && !/^\d{10}$/.test(profile.phone)) errors.push('Phone must be 10 digits');
        if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) errors.push('Invalid email format');
        if (profile.sessionFee !== null && profile.sessionFee !== undefined && profile.sessionFee < 0) {
            errors.push('Session fee cannot be negative');
        }
        if (profile.bio && profile.bio.length > 2000) errors.push('Bio must be under 2000 characters');
        return errors;
    };

    // ─ Profile save
    const saveProfile = async () => {
        if (!profile) return;

        const errors = validateProfile();
        if (errors.length > 0) {
            toast.error(errors[0]);
            return;
        }

        setSaving(true);
        try {
            await apiFetch('/profile', { method: 'PUT', body: JSON.stringify(profile) });
            setOriginalProfile(JSON.parse(JSON.stringify(profile)));
            await profileQuery.refetch();
            toast.success('Profile updated');
        } catch (e: any) {
            toast.error(e.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // ─ Filtered bookings
    const filtered = useMemo(() => {
        let result = statusFilter === 'ALL' ? bookings : bookings.filter((booking) => booking.status === statusFilter);

        if (dateRange !== 'all') {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const getRangeStart = () => {
                switch (dateRange) {
                    case 'today':
                        return startOfDay;
                    case 'this-week': {
                        const start = new Date(startOfDay);
                        start.setDate(start.getDate() - start.getDay());
                        return start;
                    }
                    case 'this-month':
                        return new Date(now.getFullYear(), now.getMonth(), 1);
                    default:
                        return new Date(0);
                }
            };

            const rangeStart = getRangeStart();
            result = result.filter((booking) => {
                const bookingDate = booking.preferredDate ? new Date(booking.preferredDate) : new Date(booking.createdAt);
                return bookingDate >= rangeStart;
            });
        }

        return result;
    }, [bookings, dateRange, statusFilter]);

    // helpers
    const statusColor = (s: string) => {
        switch (s) {
            case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'CONFIRMED': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
            case 'CANCELLED': return 'bg-red-100 text-red-800 border-red-300';
            case 'COMPLETED': return 'bg-blue-100 text-blue-800 border-blue-300';
            default: return '';
        }
    };

    const hasSharedAssessmentContext = (message?: string | null) =>
        typeof message === 'string' && message.includes('Shared Assessment Context:');

    const navItems = useMemo(() => ([
        { key: 'overview' as TherapistTab, label: 'Overview', icon: Star },
        { key: 'clients' as TherapistTab, label: 'Clients', icon: Users },
        { key: 'bookings' as TherapistTab, label: 'Bookings', icon: Calendar, badge: stats?.pending },
        { key: 'calendar' as TherapistTab, label: 'Calendar', icon: CalendarDays },
        { key: 'notes' as TherapistTab, label: 'Notes', icon: MessageSquare },
        { key: 'profile' as TherapistTab, label: 'Profile', icon: Edit2 },
    ]), [stats?.pending]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background">
                <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
                    <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                            <Heart className="h-6 w-6 text-emerald-600" />
                            <Skeleton className="h-6 w-32" />
                        </div>
                        <Skeleton className="h-8 w-20" />
                    </div>
                    <div className="max-w-6xl mx-auto px-4">
                        <div className="flex gap-1 -mb-px py-2">
                            {[1, 2, 3].map((item) => (
                                <Skeleton key={item} className="h-10 w-24" />
                            ))}
                        </div>
                    </div>
                </header>
                <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                        {[1, 2, 3, 4].map((item) => (
                            <Card key={item}>
                                <CardContent className="pt-5 pb-4">
                                    <Skeleton className="h-16 w-full" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <Card>
                        <CardContent className="p-6">
                            <Skeleton className="h-32 w-full" />
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <TherapistShell
            therapist={{
                name: therapistName || profile?.name || 'Therapist',
                email: profile?.email,
                credential: profile?.credential,
            }}
            onLogout={onLogout}
            activeItem={tab}
            onSelect={(value) => setTab(value as TherapistTab)}
            navItems={navItems.map((item) => ({
                value: item.key,
                label: item.label,
                icon: item.icon,
                badge: item.badge,
            }))}
        >
            <div className="space-y-6">

                {/* ── OVERVIEW TAB ─────────────────────────────────────── */}
                {tab === 'overview' && stats && (
                    <>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                            {[
                                { label: 'Pending', value: stats.pending, color: 'text-yellow-600', bg: 'bg-yellow-50' },
                                { label: 'Confirmed', value: stats.confirmed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                                { label: 'Completed', value: stats.completed, color: 'text-blue-600', bg: 'bg-blue-50' },
                                { label: 'Unique Clients', value: stats.uniqueClients, color: 'text-purple-600', bg: 'bg-purple-50' },
                            ].map(s => (
                                <Card key={s.label} className={s.bg}>
                                    <CardContent className="pt-5 pb-4 text-center">
                                        <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Quick actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Quick Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-3">
                                <Button size="sm" variant="outline" onClick={() => { setTab('bookings'); setStatusFilter('PENDING'); }}>
                                    <Clock className="h-4 w-4 mr-1.5" /> Review Pending ({stats.pending})
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setTab('clients')}>
                                    <Users className="h-4 w-4 mr-1.5" /> Open Clients
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setTab('profile')}>
                                    <Edit2 className="h-4 w-4 mr-1.5" /> Edit Profile
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => void refetchAll()}>
                                    <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Recent pending bookings preview */}
                        {bookings.filter(b => b.status === 'PENDING').length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Pending Requests</CardTitle>
                                    <CardDescription>These clients are waiting for your response</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {bookings.filter(b => b.status === 'PENDING').slice(0, 5).map(b => (
                                        <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                                            <div>
                                                <p className="font-medium text-sm">{b.user?.name || b.userEmail}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {b.preferredDate ? new Date(b.preferredDate).toLocaleDateString() : 'No date set'}
                                                    {b.preferredTime ? ` at ${b.preferredTime}` : ''}
                                                </p>
                                                {hasSharedAssessmentContext(b.message) && (
                                                    <Badge variant="secondary" className="mt-1 text-[10px] uppercase tracking-wide">
                                                        Shared assessment data
                                                    </Badge>
                                                )}
                                                {b.message && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{b.message}</p>}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8"
                                                    onClick={() => {
                                                        setTab('bookings');
                                                        setStatusFilter('PENDING');
                                                        setActionBookingId(b.id);
                                                        setNoteInput('');
                                                    }}
                                                >
                                                    Respond
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}

                        <CrisisAlertsFeed />
                    </>
                )}

                {/* ── CLIENTS TAB ──────────────────────────────────────── */}
                {tab === 'clients' && (
                    <div className="grid gap-4 xl:grid-cols-[370px_minmax(0,1fr)]">
                        <ClientsList selectedClientId={selectedClientId} onSelectClient={setSelectedClientId} />
                        <ClientProfile clientId={selectedClientId} />
                    </div>
                )}

                {/* ── CALENDAR TAB ─────────────────────────────────────── */}
                {tab === 'calendar' && <TherapistCalendar bookings={bookings} />}

                {/* ── NOTES TAB ────────────────────────────────────────── */}
                {tab === 'notes' && (
                    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
                        <ClientsList selectedClientId={selectedClientId} onSelectClient={setSelectedClientId} />
                        <div className="space-y-4">
                            <SessionNotesEditor
                                clientId={selectedClientId}
                                onSaved={() => setNoteRefreshSignal((value) => value + 1)}
                            />
                            <SessionNotesList clientId={selectedClientId} refreshSignal={noteRefreshSignal} />
                        </div>
                    </div>
                )}

                {/* ── BOOKINGS TAB ─────────────────────────────────────── */}
                {tab === 'bookings' && (
                    <>
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-2">
                                <h2 className="text-lg font-semibold">Booking Requests</h2>
                                <Button size="sm" variant="ghost" onClick={() => void refetchAll()} className="h-8 w-8 p-0" title="Refresh bookings">
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
                                    <SelectTrigger className="w-full sm:w-[140px]">
                                        <SelectValue placeholder="Date range" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BOOKING_DATE_RANGE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {BOOKING_STATUS_FILTERS.map(s => (
                                    <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'}
                                        className={statusFilter === s ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                                        onClick={() => setStatusFilter(s)}>
                                        {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {filtered.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
                                    <p>No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} bookings</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {filtered.map(b => (
                                    <Card key={b.id}>
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{b.user?.name || b.userEmail}</span>
                                                        <Badge className={`text-xs ${statusColor(b.status)}`}>{b.status}</Badge>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        <span>{b.userEmail}</span>
                                                        {b.userPhone && <span>{b.userPhone}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                        <span><Calendar className="h-3 w-3 inline mr-1" />{b.preferredDate ? new Date(b.preferredDate).toLocaleDateString() : 'No date'}</span>
                                                        {b.preferredTime && <span><Clock className="h-3 w-3 inline mr-1" />{b.preferredTime}</span>}
                                                        <span>Requested {new Date(b.createdAt).toLocaleDateString()}</span>
                                                    </div>
                                                    {b.message && (
                                                        <div className="mt-2 space-y-1">
                                                            {hasSharedAssessmentContext(b.message) && (
                                                                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                                                    Shared assessment context included
                                                                </Badge>
                                                            )}
                                                            <div className="rounded bg-muted/50 p-2 text-sm whitespace-pre-wrap break-words">
                                                                <MessageSquare className="h-3 w-3 inline mr-1 opacity-50" />{b.message}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {b.therapistNotes && (
                                                        <p className="text-xs italic text-muted-foreground mt-1">Your note: {b.therapistNotes}</p>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                {b.status === 'PENDING' && (
                                                    <div className="flex flex-col gap-1.5 shrink-0">
                                                        {actionBookingId === b.id ? (
                                                            <div className="space-y-2 w-56">
                                                                <Textarea
                                                                    placeholder="Add context for this decision (required for decline)..."
                                                                    value={noteInput}
                                                                    onChange={e => setNoteInput(e.target.value)}
                                                                    rows={2}
                                                                    className="text-xs"
                                                                />
                                                                <div className="flex gap-1.5">
                                                                    <Button
                                                                        size="sm"
                                                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-7 text-xs"
                                                                        disabled={updatingBookingId === b.id}
                                                                        onClick={() => updateBookingStatus(b.id, 'CONFIRMED')}
                                                                    >
                                                                        Approve
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="destructive"
                                                                        className="flex-1 h-7 text-xs"
                                                                        disabled={noteInput.trim().length < 3 || updatingBookingId === b.id}
                                                                        onClick={() => updateBookingStatus(b.id, 'CANCELLED')}
                                                                    >
                                                                        Decline
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="h-7 px-2"
                                                                        disabled={updatingBookingId === b.id}
                                                                        onClick={() => { setActionBookingId(null); setNoteInput(''); }}
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="text-xs"
                                                                disabled={updatingBookingId === b.id}
                                                                onClick={() => setActionBookingId(b.id)}
                                                            >
                                                                Respond
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}
                                                {b.status === 'CONFIRMED' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="text-xs"
                                                        disabled={updatingBookingId === b.id}
                                                        onClick={() => updateBookingStatus(b.id, 'COMPLETED')}
                                                    >
                                                        {updatingBookingId === b.id ? (
                                                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                        ) : (
                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                        )}
                                                        Complete
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* ── PROFILE TAB ──────────────────────────────────────── */}
                {tab === 'profile' && profile && (() => {
                    const specialties: string[] = (() => { try { return JSON.parse(profile.specialtiesJson || '[]'); } catch { return []; } })();
                    const availability: { day: string; startTime: string; endTime: string }[] = (() => { try { return JSON.parse(profile.availabilityJson || '[]'); } catch { return []; } })();
                    const insurancesList: string[] = (() => { try { return profile.insurances ? JSON.parse(profile.insurances) : []; } catch { return []; } })();

                    const SPECIALTIES = [
                        { value: 'ANXIETY', label: 'Anxiety' }, { value: 'DEPRESSION', label: 'Depression' },
                        { value: 'TRAUMA', label: 'Trauma' }, { value: 'PTSD', label: 'PTSD' },
                        { value: 'RELATIONSHIPS', label: 'Relationships' }, { value: 'FAMILY_THERAPY', label: 'Family Therapy' },
                        { value: 'ADDICTION', label: 'Addiction' }, { value: 'EATING_DISORDERS', label: 'Eating Disorders' },
                        { value: 'OCD', label: 'OCD' }, { value: 'BIPOLAR', label: 'Bipolar Disorder' },
                        { value: 'GRIEF', label: 'Grief & Loss' }, { value: 'STRESS_MANAGEMENT', label: 'Stress Management' },
                        { value: 'CBT', label: 'CBT' }, { value: 'DBT', label: 'DBT' },
                        { value: 'EMDR', label: 'EMDR' }, { value: 'MINDFULNESS', label: 'Mindfulness-Based Therapy' },
                        { value: 'PSYCHODYNAMIC', label: 'Psychodynamic Therapy' }, { value: 'COUPLES_THERAPY', label: 'Couples Therapy' }
                    ];

                    const CREDENTIALS = [
                        { value: 'PSYCHOLOGIST', label: 'Psychologist (PhD/PsyD)' },
                        { value: 'PSYCHIATRIST', label: 'Psychiatrist (MD)' },
                        { value: 'LCSW', label: 'Licensed Clinical Social Worker (LCSW)' },
                        { value: 'LMFT', label: 'Licensed Marriage & Family Therapist (LMFT)' },
                        { value: 'LPC', label: 'Licensed Professional Counselor (LPC)' },
                        { value: 'LMHC', label: 'Licensed Mental Health Counselor (LMHC)' }
                    ];

                    const COMMON_INSURANCES = [
                        'Aetna', 'Blue Cross Blue Shield', 'Cigna', 'United Healthcare',
                        'Humana', 'Kaiser Permanente', 'Medicare', 'Medicaid',
                        'Tricare', 'Anthem', 'Oscar Health', 'Out of Network'
                    ];

                    const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

                    const toggleSpecialty = (spec: string) => {
                        const updated = specialties.includes(spec) ? specialties.filter(s => s !== spec) : [...specialties, spec];
                        setProfile({ ...profile, specialtiesJson: JSON.stringify(updated) });
                    };

                    const toggleInsurance = (ins: string) => {
                        const updated = insurancesList.includes(ins) ? insurancesList.filter(i => i !== ins) : [...insurancesList, ins];
                        setProfile({ ...profile, insurances: JSON.stringify(updated) });
                    };

                    const addAvailabilitySlot = (day: string, startTime: string, endTime: string) => {
                        const isDuplicate = availability.some(
                            (slot) => slot.day === day && slot.startTime === startTime && slot.endTime === endTime
                        );
                        if (isDuplicate) {
                            toast.warning('This time slot already exists');
                            return;
                        }

                        const hasOverlap = availability.some(
                            (slot) => slot.day === day && startTime < slot.endTime && endTime > slot.startTime
                        );
                        if (hasOverlap) {
                            toast.warning(`This slot overlaps with an existing slot on ${day}`);
                            return;
                        }

                        if (startTime >= endTime) {
                            toast.warning('End time must be after start time');
                            return;
                        }

                        const updated = [...availability, { day, startTime, endTime }];
                        setProfile({ ...profile, availabilityJson: JSON.stringify(updated) });
                    };

                    const removeAvailabilitySlot = (index: number) => {
                        const updated = availability.filter((_, i) => i !== index);
                        setProfile({ ...profile, availabilityJson: JSON.stringify(updated) });
                    };

                    return (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Edit Profile</CardTitle>
                                    <CardDescription>Update your public therapist profile</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {profile.isVerified && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Verified</Badge>}
                                    {profile.isActive ? (
                                        <Badge className="bg-green-100 text-green-800 border-green-300">Active</Badge>
                                    ) : (
                                        <Badge className="bg-red-100 text-red-800 border-red-300">Inactive</Badge>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Basic Info */}
                            <div>
                                <h3 className="font-medium text-sm mb-3">Basic Information</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-name">Display Name</Label>
                                        <Input id="p-name" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-credential">Credential</Label>
                                        <Select value={profile.credential} onValueChange={v => setProfile({ ...profile, credential: v })}>
                                            <SelectTrigger><SelectValue placeholder="Select credential" /></SelectTrigger>
                                            <SelectContent>
                                                {CREDENTIALS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-title">Title</Label>
                                        <Input id="p-title" value={profile.title} onChange={e => setProfile({ ...profile, title: e.target.value })} placeholder="Licensed Clinical Psychologist" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-image">Profile Image URL</Label>
                                        <Input id="p-image" value={profile.profileImageUrl || ''} onChange={e => setProfile({ ...profile, profileImageUrl: e.target.value })} placeholder="https://example.com/photo.jpg" />
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2">
                                        <Label htmlFor="p-bio">Bio</Label>
                                        <Textarea id="p-bio" value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} rows={4} />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Specialties */}
                            <div>
                                <h3 className="font-medium text-sm mb-3">Specialties</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {SPECIALTIES.map(s => (
                                        <div key={s.value} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`p-spec-${s.value}`}
                                                checked={specialties.includes(s.value)}
                                                onCheckedChange={() => toggleSpecialty(s.value)}
                                            />
                                            <label htmlFor={`p-spec-${s.value}`} className="text-sm cursor-pointer">{s.label}</label>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            {/* Contact & Location */}
                            <div>
                                <h3 className="font-medium text-sm mb-3">Contact & Location</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-email">Email</Label>
                                        <Input id="p-email" type="email" value={profile.email || ''} onChange={e => setProfile({ ...profile, email: e.target.value })} placeholder="therapist@example.com" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-phone">Phone</Label>
                                        <Input
                                            id="p-phone"
                                            type="tel"
                                            inputMode="tel"
                                            maxLength={10}
                                            value={profile.phone || ''}
                                            onChange={e => setProfile({ ...profile, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                            placeholder="e.g. 9876543210"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-website">Website</Label>
                                        <Input id="p-website" value={profile.website || ''} onChange={e => setProfile({ ...profile, website: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5 md:col-span-2">
                                        <Label htmlFor="p-street">Street Address</Label>
                                        <Input id="p-street" value={profile.street || ''} onChange={e => setProfile({ ...profile, street: e.target.value })} placeholder="123 Main Street, Suite 100" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-city">City</Label>
                                        <Input id="p-city" value={profile.city || ''} onChange={e => setProfile({ ...profile, city: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-state">State</Label>
                                        <Input id="p-state" value={profile.state || ''} onChange={e => setProfile({ ...profile, state: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-zip">ZIP Code</Label>
                                        <Input id="p-zip" value={profile.zipCode || ''} onChange={e => setProfile({ ...profile, zipCode: e.target.value })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-country">Country</Label>
                                        <Input id="p-country" value={profile.country || 'US'} onChange={e => setProfile({ ...profile, country: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            {/* Fees & Insurance */}
                            <div>
                                <h3 className="font-medium text-sm mb-3">Session Fees & Insurance</h3>
                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-fee">Session Fee ($)</Label>
                                        <Input id="p-fee" type="number" value={profile.sessionFee ?? ''} onChange={e => setProfile({ ...profile, sessionFee: e.target.value ? Number(e.target.value) : null })} />
                                    </div>
                                    <div className="flex items-center gap-2 pt-6">
                                        <input type="checkbox" id="p-sliding" checked={profile.offersSliding} onChange={e => setProfile({ ...profile, offersSliding: e.target.checked })} />
                                        <Label htmlFor="p-sliding">Sliding scale</Label>
                                    </div>
                                    <div className="flex items-center gap-2 pt-6">
                                        <input type="checkbox" id="p-insurance" checked={profile.acceptsInsurance} onChange={e => setProfile({ ...profile, acceptsInsurance: e.target.checked })} />
                                        <Label htmlFor="p-insurance">Accepts insurance</Label>
                                    </div>
                                </div>
                                {profile.acceptsInsurance && (
                                    <div className="mt-4 p-3 border rounded-md bg-muted/50">
                                        <Label className="text-sm mb-2 block">Accepted Insurance Providers</Label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                            {COMMON_INSURANCES.map(ins => (
                                                <div key={ins} className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`p-ins-${ins}`}
                                                        checked={insurancesList.includes(ins)}
                                                        onCheckedChange={() => toggleInsurance(ins)}
                                                    />
                                                    <label htmlFor={`p-ins-${ins}`} className="text-sm cursor-pointer">{ins}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Availability */}
                            <div>
                                <h3 className="font-medium text-sm mb-3">Availability Schedule</h3>
                                {availability.length > 0 && (
                                    <div className="space-y-2 mb-3">
                                        {availability.map((slot, index) => (
                                            <div key={index} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                                                <Badge variant="outline">{slot.day}</Badge>
                                                <span className="text-sm">{slot.startTime} - {slot.endTime}</span>
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => removeAvailabilitySlot(index)}>
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <AvailabilityAdder onAdd={addAvailabilitySlot} days={DAYS_OF_WEEK} />
                            </div>

                            <Separator />

                            {/* Experience */}
                            <div>
                                <h3 className="font-medium text-sm mb-3">Experience</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-exp">Years of Experience</Label>
                                        <Input id="p-exp" type="number" value={profile.yearsExperience ?? ''} onChange={e => setProfile({ ...profile, yearsExperience: e.target.value ? Number(e.target.value) : null })} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="p-lang">Languages</Label>
                                        <Input id="p-lang" value={profile.languages || ''} onChange={e => setProfile({ ...profile, languages: e.target.value })} placeholder="English, Hindi" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2">
                                <div className="flex items-center gap-2">
                                    {isProfileDirty && (
                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                            Unsaved changes
                                        </Badge>
                                    )}
                                    <Button onClick={saveProfile} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    {saving ? 'Saving…' : 'Save Changes'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    );
                })()}
            </div>
        </TherapistShell>
    );
}

// ─── Availability Adder Sub-Component ────────────────────────────────────────
function AvailabilityAdder({ onAdd, days }: { onAdd: (day: string, startTime: string, endTime: string) => void; days: string[] }) {
    const [day, setDay] = useState('Monday');
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('17:00');

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <div className="min-w-0 space-y-1">
                <Label className="text-xs">Day</Label>
                <Select value={day} onValueChange={setDay}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="min-w-0 space-y-1">
                <Label className="text-xs">Start</Label>
                <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full" />
            </div>
            <div className="min-w-0 space-y-1">
                <Label className="text-xs">End</Label>
                <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full" />
            </div>
            <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => onAdd(day, startTime, endTime)}>
                <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
        </div>
    );
}
