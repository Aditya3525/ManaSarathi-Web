import { Search, Plus, FolderOpen, AlertCircle, X, RefreshCw } from 'lucide-react';
import React, { useState, useMemo } from 'react';

import {
  useConversations,
  useDeleteConversation,
  useRenameConversation,
  useArchiveConversation,
  useSearchConversations,
} from '../../../hooks/useConversations';
import type { Conversation } from '../../../services/api';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { LoadingSpinner } from '../../ui/loading-spinner';
import { ScrollArea } from '../../ui/scroll-area';
import { Skeleton } from '../../ui/skeleton';

import { ConversationItem } from './ConversationItem';

interface ConversationHistorySidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
  className?: string;
  showCloseButton?: boolean;
  onCloseSidebar?: () => void;
}

// Helper function to group conversations by date
function groupConversationsByDate(conversations: Conversation[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setDate(lastMonth.getDate() - 30);

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'Last 7 Days': [],
    'Last 30 Days': [],
    Older: [],
  };

  conversations.forEach((conv) => {
    const convDate = new Date(conv.lastMessageAt);
    const convDateOnly = new Date(convDate.getFullYear(), convDate.getMonth(), convDate.getDate());

    if (convDateOnly.getTime() === today.getTime()) {
      groups.Today.push(conv);
    } else if (convDateOnly.getTime() === yesterday.getTime()) {
      groups.Yesterday.push(conv);
    } else if (convDate >= lastWeek) {
      groups['Last 7 Days'].push(conv);
    } else if (convDate >= lastMonth) {
      groups['Last 30 Days'].push(conv);
    } else {
      groups.Older.push(conv);
    }
  });

  // Filter out empty groups
  return Object.entries(groups).filter(([, convs]) => convs.length > 0);
}

export function ConversationHistorySidebar({
  activeConversationId,
  onSelectConversation,
  className = '',
  showCloseButton = false,
  onCloseSidebar,
}: ConversationHistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch conversations
  const {
    data: conversations = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useConversations(false);
  const { data: searchResults = [] } = useSearchConversations(searchQuery);

  // Mutations
  const deleteConversation = useDeleteConversation();
  const renameConversation = useRenameConversation();
  const archiveConversation = useArchiveConversation();

  // Use search results if searching, otherwise use all conversations
  const displayedConversations = searchQuery.trim() ? searchResults : conversations;
  const showLoadingState = (isLoading || (isFetching && conversations.length === 0)) && !searchQuery.trim();
  const showRetryingState = !showLoadingState && Boolean(error) && conversations.length === 0 && !searchQuery.trim();

  // Group conversations by date
  const groupedConversations = useMemo(
    () => groupConversationsByDate(displayedConversations),
    [displayedConversations]
  );

  const handleNewChat = () => {
    // Clear active conversation to start fresh
    onSelectConversation(null);
  };

  const handleRename = (conversationId: string, newTitle: string) => {
    renameConversation.mutate(conversationId, newTitle);
  };

  const handleDelete = (conversationId: string) => {
    // Soft delete - just archive the conversation
    archiveConversation.mutate({ conversationId, isArchived: true }, {
      onSuccess: () => {
        // If deleted conversation was active, clear selection
        if (conversationId === activeConversationId) {
          onSelectConversation(null);
        }
      },
    });
  };

  const handlePermanentDelete = (conversationId: string) => {
    // Hard delete - permanently remove from database
    deleteConversation.mutate(conversationId, {
      onSuccess: () => {
        // If deleted conversation was active, clear selection
        if (conversationId === activeConversationId) {
          onSelectConversation(null);
        }
      },
    });
  };

  return (
    <div className={`flex h-full min-w-0 flex-col bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md border-r border-border/40 ${className}`}>
      {/* Header with New Chat button */}
      <div className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-200">History</h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1 flex-shrink-0 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-full text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
              aria-label="Refresh history"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin opacity-50' : ''}`} />
            </Button>
          </div>
          {showCloseButton && onCloseSidebar ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-full"
              aria-label="Minimize sidebar"
              onClick={onCloseSidebar}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <Button
          onClick={handleNewChat}
          className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold shadow-sm hover:shadow-md hover:shadow-teal-500/5 hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 rounded-xl border-0 h-10"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>

        {/* Search Input */}
        <div className="relative">
          <Search 
            className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400/80 pointer-events-none" 
          />
          <Input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 h-9 bg-slate-200/50 dark:bg-slate-900/60 border-0 focus-visible:ring-1 focus-visible:ring-teal-500/30 rounded-xl text-sm placeholder:text-slate-400/70"
          />
        </div>
      </div>

      {/* Conversation List */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 pb-4">
          {showLoadingState ? (
            // Loading skeleton
            <div className="space-y-2">
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <LoadingSpinner size="sm" className="text-teal-500" />
                Loading conversations...
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-3 py-2 bg-card/25 rounded-lg border border-border/20 mb-1 animate-pulse">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : showRetryingState ? (
            // Retry state when initial retrieval failed
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <AlertCircle className="h-12 w-12 text-amber-500 mb-3 animate-pulse" />
              <p className="text-sm text-muted-foreground">
                Loading conversations...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                We could not retrieve history yet. Try again.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 rounded-xl hover:bg-primary/5 transition-all"
                onClick={() => {
                  void refetch();
                }}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Retry
              </Button>
            </div>
          ) : displayedConversations.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <FolderOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-slate-500">
                {searchQuery.trim() ? 'No conversations found' : 'No history yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">
                {searchQuery.trim()
                  ? 'Try a different search term'
                  : 'Start a new chat to begin'}
              </p>
            </div>
          ) : (
            // Conversation list grouped by date
            <div className="space-y-4">
              {groupedConversations.map(([group, convs]) => (
                <div key={group}>
                  <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-teal-500/40" />
                    {group}
                  </h3>
                  <div className="space-y-1">
                    {convs.map((conversation) => (
                      <ConversationItem
                        key={conversation.id}
                        conversation={conversation}
                        isActive={conversation.id === activeConversationId}
                        onClick={() => onSelectConversation(conversation.id)}
                        onRename={handleRename}
                        onDelete={handleDelete}
                        onPermanentDelete={handlePermanentDelete}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer with conversation count */}
      {!showLoadingState && conversations.length > 0 && (
        <div className="border-t p-3">
          <p className="text-xs text-muted-foreground text-center">
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
