import { Copy, ThumbsUp, ThumbsDown, RefreshCw, Check, Volume2 } from 'lucide-react';
import React, { useState } from 'react';

import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../ui/button';

interface MessageActionsProps {
  messageId: string;
  content: string;
  onLike?: (messageId: string) => void;
  onDislike?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onSpeak?: (content: string) => void;
  feedback?: 'liked' | 'disliked' | null;
}

export const MessageActions: React.FC<MessageActionsProps> = ({
  messageId,
  content,
  onLike,
  onDislike,
  onRegenerate,
  onSpeak,
  feedback = null,
}) => {
  const [copied, setCopied] = useState(false);
  const { push } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      push({
        title: 'Copied!',
        description: 'Message copied to clipboard',
        type: 'success',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      push({
        title: 'Failed to copy',
        description: 'Could not copy message to clipboard',
        type: 'error',
      });
    }
  };

  const handleLike = () => {
    if (onLike) {
      onLike(messageId);
      push({
        title: 'Feedback received',
        description: 'Thank you for your feedback!',
        type: 'success',
      });
    }
  };

  const handleDislike = () => {
    if (onDislike) {
      onDislike(messageId);
      push({
        title: 'Additional feedback',
        description: 'You can share details right below this message.',
        type: 'info',
      });
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(messageId);
    }
  };

  return (
    <div className="flex items-center gap-0.5 bg-card dark:bg-slate-900 border border-border/40 rounded-full p-0.5 shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-all duration-200 hover:shadow-md">
      {/* Copy Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-7 w-7 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shadow-none border-0"
        title="Copy message"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>

      {/* Speak Button */}
      {onSpeak && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSpeak(content)}
          className="h-7 w-7 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shadow-none border-0"
          title="Read aloud"
        >
          <Volume2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {/* Like Button */}
      {onLike && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={`h-7 w-7 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shadow-none border-0 ${
            feedback === 'liked' ? 'bg-green-500/10 text-green-600 dark:bg-green-950/20' : ''
          }`}
          title="This was helpful"
        >
          <ThumbsUp
            className={`h-3.5 w-3.5 ${
              feedback === 'liked'
                ? 'text-green-600 dark:text-green-400 fill-current'
                : ''
            }`}
          />
        </Button>
      )}

      {/* Dislike Button */}
      {onDislike && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDislike}
          className={`h-7 w-7 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shadow-none border-0 ${
            feedback === 'disliked' ? 'bg-red-500/10 text-red-600 dark:bg-red-950/20' : ''
          }`}
          title="This wasn't helpful"
        >
          <ThumbsDown
            className={`h-3.5 w-3.5 ${
              feedback === 'disliked'
                ? 'text-red-600 dark:text-red-400 fill-current'
                : ''
            }`}
          />
        </Button>
      )}

      {/* Regenerate Button */}
      {onRegenerate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          className="h-7 w-7 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors shadow-none border-0"
          title="Regenerate response"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};

export default MessageActions;
