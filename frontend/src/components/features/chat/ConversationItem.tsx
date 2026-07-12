import { MoreHorizontal, Edit2, Archive, Trash, Download } from 'lucide-react';
import React, { useState } from 'react';

import type { Conversation } from '../../../services/api';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Input } from '../../ui/input';

import { ExportDialog } from './ExportDialog';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onRename: (id: string, newTitle: string) => void;
  onDelete: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}

export function ConversationItem({
  conversation,
  isActive,
  onClick,
  onRename,
  onDelete,
  onPermanentDelete,
}: ConversationItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(conversation.title || 'Untitled');
  const [showExportDialog, setShowExportDialog] = useState(false);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const handleRename = () => {
    if (editValue.trim() && editValue !== conversation.title) {
      onRename(conversation.id, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setEditValue(conversation.title || 'Untitled');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="group relative px-3 py-2">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={handleKeyDown}
          className="h-8 w-full text-sm"
          maxLength={100}
        />
      </div>
    );
  }

  return (
    <div
      className={`
        group relative cursor-pointer rounded-xl px-3 py-2.5 mx-1 mb-1 border border-transparent
        transition-all duration-200 hover:bg-slate-200/40 dark:hover:bg-slate-900/40
        ${isActive ? 'bg-teal-500/10 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border-l-2 border-l-teal-500 rounded-l-none pl-2.5 shadow-sm' : 'text-slate-700 dark:text-slate-300'}
      `}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-sm truncate leading-tight ${isActive ? 'font-semibold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-800 dark:text-slate-200'}`}>
              {conversation.title || 'Untitled'}
            </h4>
            {conversation.messageCount > 0 && (
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/40 dark:bg-slate-800/60 shrink-0 px-2 py-0.5 rounded-full">
                {conversation.messageCount}
              </span>
            )}
          </div>
          
          {conversation.lastMessage && (
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-1">
              {conversation.lastMessage}
            </p>
          )}
          
          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 dark:text-slate-500">
            <span>{formatTimestamp(conversation.lastMessageAt)}</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 shrink-0 bg-transparent hover:bg-slate-200 dark:hover:bg-slate-800 p-0 text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 rounded-lg transition-opacity duration-150 shadow-none border-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[min(12rem,calc(100vw-2rem))] rounded-xl shadow-md border-border/40">
            <DropdownMenuItem
              className="rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
 
            <DropdownMenuItem
              className="rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                setShowExportDialog(true);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem
              className="rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Hide this conversation from sidebar? (You can restore it later)')) {
                  onDelete(conversation.id);
                }
              }}
            >
              <Archive className="h-4 w-4 mr-2" />
              Delete (Hide)
            </DropdownMenuItem>
            
            <DropdownMenuItem
              className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('⚠️ PERMANENTLY delete this conversation?\n\nThis will remove all messages forever and cannot be undone!')) {
                  onPermanentDelete(conversation.id);
                }
              }}
            >
              <Trash className="h-4 w-4 mr-2" />
              Permanent Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {conversation.isArchived && (
        <div className="absolute top-2 right-2 opacity-50">
          <Archive className="h-3 w-3" />
        </div>
      )}

      {/* Export Dialog */}
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        conversationId={conversation.id}
        conversationTitle={conversation.title || 'Untitled Conversation'}
        messageCount={conversation.messageCount}
      />
    </div>
  );
}
