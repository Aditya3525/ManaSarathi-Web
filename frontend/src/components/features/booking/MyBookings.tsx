import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Calendar,
    Clock,
    User,
    X,
    CalendarCheck,
    Video,
    Phone,
    MapPin,
    MessageSquare,
    RefreshCw,
} from 'lucide-react';
import React from 'react';

import { LoadingSpinner } from '../../ui/loading-spinner';

import { useToast } from '../../../contexts/ToastContext';
import { therapistApi } from '../../../services/helpSafetyApi';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '../../ui/alert-dialog';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';


import './booking.css';

function getStatusClass(status: string): string {
    switch (status) {
        case 'PENDING': return 'pending';
        case 'CONFIRMED': return 'confirmed';
        case 'CANCELLED': return 'cancelled';
        case 'COMPLETED': return 'completed';
        default: return '';
    }
}

function getStatusLabel(status: string): string {
    switch (status) {
        case 'PENDING': return 'Pending';
        case 'CONFIRMED': return 'Confirmed';
        case 'CANCELLED': return 'Cancelled';
        case 'COMPLETED': return 'Completed';
        default: return status;
    }
}

function parseConsultationType(message?: string | null): { type: string; icon: React.ReactNode } | null {
    if (!message) return null;
    if (message.includes('Video Call')) return { type: 'Video Call', icon: <Video className="h-3 w-3" /> };
    if (message.includes('Phone Call')) return { type: 'Phone Call', icon: <Phone className="h-3 w-3" /> };
    if (message.includes('In-Person')) return { type: 'In-Person', icon: <MapPin className="h-3 w-3" /> };
    return null;
}

function formatDate(dateStr: string): string {
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return dateStr;
    }
}

function formatTime(time: string): string {
    if (!time) return '';
    const parts = time.split(':');
    if (parts.length < 2) return time;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 || 12;
    return `${hr}:${m} ${ampm}`;
}

export function MyBookings() {
    const { push } = useToast();
    const queryClient = useQueryClient();

    const { data: bookings = [], isLoading, isError, isFetching, refetch } = useQuery({
        queryKey: ['myBookings'],
        queryFn: () => therapistApi.getMyBookings(),
        refetchInterval: 15000,
        refetchOnWindowFocus: true,
    });

    const cancelMutation = useMutation({
        mutationFn: (id: string) => therapistApi.cancelBooking(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['myBookings'] });
            push({
                type: 'success',
                title: 'Booking Cancelled',
                description: 'Your consultation request has been cancelled.',
            });
        },
        onError: () => {
            push({
                type: 'error',
                title: 'Error',
                description: 'Failed to cancel booking. Please try again.',
            });
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" className="text-primary" />
            </div>
        );
    }

    if (isError) {
        return (
            <Card>
                <CardContent className="p-6 text-center">
                    <p className="text-muted-foreground">Failed to load your bookings. Please try again later.</p>
                </CardContent>
            </Card>
        );
    }

    if (bookings.length === 0) {
        return (
            <div className="bookings-empty">
                <div className="bookings-empty-icon">
                    <CalendarCheck className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Bookings Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    You haven&apos;t booked any consultations yet. Browse therapists and request a session to get started.
                </p>
            </div>
        );
    }

    // Sort: pending first, then confirmed, then completed, then cancelled
    const sortedBookings = [...bookings].sort((a, b) => {
        const order: Record<string, number> = { PENDING: 0, CONFIRMED: 1, COMPLETED: 2, CANCELLED: 3 };
        return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Your Consultations ({bookings.length})
                </h3>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    title="Refresh bookings"
                >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isFetching ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {sortedBookings.map((booking) => {
                const consultInfo = parseConsultationType(booking.message);
                const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED';
                const wasRejectedByTherapist = booking.status === 'CANCELLED' && Boolean(booking.processedBy);
                const statusLabel = wasRejectedByTherapist ? 'Rejected' : getStatusLabel(booking.status);

                return (
                    <div key={booking.id} className="booking-card">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <User className="h-5 w-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-medium text-sm truncate">
                                        {booking.therapist?.name || 'Therapist'}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {formatDate(booking.preferredDate)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            {formatTime(booking.preferredTime)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`booking-status-badge ${getStatusClass(booking.status)}`}>
                                    <span className="booking-status-dot" />
                                    {statusLabel}
                                </span>
                            </div>
                        </div>

                        {/* Therapist notes (shown after approval/rejection) */}
                        {booking.therapistNotes && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                                <div className="flex items-start gap-2 text-sm">
                                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                            {wasRejectedByTherapist ? 'Rejection Reason' : 'Therapist Note'}
                                        </p>
                                        <p className="text-sm text-foreground">{booking.therapistNotes}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Extra info row */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2">
                                {consultInfo && (
                                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                                        {consultInfo.icon}
                                        {consultInfo.type}
                                    </span>
                                )}
                            </div>

                            {canCancel && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
                                            disabled={cancelMutation.isPending}
                                        >
                                            {cancelMutation.isPending ? (
                                                <LoadingSpinner size="xs" />
                                            ) : (
                                                <>
                                                    <X className="h-3 w-3 mr-1" />
                                                    Cancel
                                                </>
                                            )}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Are you sure you want to cancel your consultation with{' '}
                                                <strong>{booking.therapist?.name || 'this therapist'}</strong> on{' '}
                                                {formatDate(booking.preferredDate)} at {formatTime(booking.preferredTime)}?
                                                This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => cancelMutation.mutate(booking.id)}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                                Yes, Cancel Booking
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
