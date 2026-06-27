import { X, Play, Volume2, FileText, Clock, Tag } from 'lucide-react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { ScrollArea } from '../components/ui/scroll-area';

interface ContentItem {
  id: string;
  title: string;
  type: 'article' | 'video' | 'audio' | 'playlist' | 'story';
  approach: string;
  category?: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  description?: string;
  content?: string;
  thumbnailUrl?: string;
  youtubeUrl?: string;
  duration?: number;
  tags?: string[];
}

interface PreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: ContentItem | null;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  open,
  onOpenChange,
  content
}) => {
  if (!content) return null;

  const renderContentByType = () => {
    switch (content.type) {
      case 'video':
        return (
          <div className="space-y-4">
            {/* Video Player */}
            {content.youtubeUrl ? (
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${extractYoutubeId(content.youtubeUrl)}`}
                  title={content.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
            ) : content.thumbnailUrl ? (
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted flex items-center justify-center relative">
                <img
                  src={content.thumbnailUrl}
                  alt={content.title}
                  className="object-cover w-full h-full"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="bg-white/90 rounded-full p-4">
                    <Play className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center">
                <div className="text-center">
                  <Play className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Video preview not available</p>
                </div>
              </div>
            )}

            {/* Video Description */}
            {content.description && (
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground">{content.description}</p>
              </div>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="space-y-4">
            {/* Audio Player Placeholder */}
            <div className="rounded-lg border bg-card p-8">
              <div className="flex items-center gap-4">
                <div className="bg-primary/10 rounded-full p-4">
                  <Volume2 className="h-8 w-8 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium">{content.title}</h3>
                  {content.duration && (
                    <p className="text-sm text-muted-foreground">
                      Duration: {Math.floor(content.duration / 60)}:{(content.duration % 60).toString().padStart(2, '0')}
                    </p>
                  )}
                </div>
                <Button size="lg" className="rounded-full">
                  <Play className="h-5 w-5 mr-2" />
                  Play
                </Button>
              </div>
            </div>

            {/* Audio Description */}
            {content.description && (
              <div className="prose prose-sm max-w-none">
                <p className="text-muted-foreground">{content.description}</p>
              </div>
            )}

            {/* Transcript or Content */}
            {content.content && (
              <div className="rounded-lg border bg-muted/50 p-4">
                <h4 className="font-medium mb-2">Transcript</h4>
                <ScrollArea className="h-[200px]">
                  <div className="prose prose-sm max-w-none">
                    <p className="text-sm whitespace-pre-wrap">{content.content}</p>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        );

      case 'article':
        return (
          <div className="space-y-4">
            {/* Article Thumbnail */}
            {content.thumbnailUrl && (
              <div className="w-full h-48 overflow-hidden rounded-lg">
                <img
                  src={content.thumbnailUrl}
                  alt={content.title}
                  className="object-cover w-full h-full"
                />
              </div>
            )}

            {/* Article Content */}
            <div className="prose prose-sm max-w-none">
              {content.description && (
                <p className="text-lg text-muted-foreground italic border-l-4 border-primary pl-4 mb-4">
                  {content.description}
                </p>
              )}
              
              {content.content ? (
                <div className="whitespace-pre-wrap">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    skipHtml
                    components={{
                      a: ({ children, href }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {content.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground">No content available</p>
              )}
            </div>
          </div>
        );

      case 'story':
        return (
          <div className="space-y-4">
            {/* Story Header */}
            <div className="text-center space-y-2">
              {content.thumbnailUrl && (
                <div className="w-24 h-24 mx-auto overflow-hidden rounded-full">
                  <img
                    src={content.thumbnailUrl}
                    alt={content.title}
                    className="object-cover w-full h-full"
                  />
                </div>
              )}
            </div>

            {/* Story Content */}
            <div className="prose prose-sm max-w-none">
              {content.description && (
                <p className="text-center text-muted-foreground italic mb-6">
                  {content.description}
                </p>
              )}
              
              {content.content ? (
                <div className="whitespace-pre-wrap leading-relaxed">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    skipHtml
                    components={{
                      a: ({ children, href }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          {children}
                        </a>
                      ),
                    }}
                  >
                    {content.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">Story content not available</p>
              )}
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Preview not available for this content type</p>
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-8">
              <DialogTitle className="text-2xl font-bold mb-2">
                {content.title}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap gap-2 items-center">
                {content.category && (
                  <Badge variant="outline">{content.category}</Badge>
                )}
                {content.difficulty && (
                  <Badge variant="secondary">{content.difficulty}</Badge>
                )}
                <Badge variant="default" className="capitalize">
                  {content.type}
                </Badge>
                <Badge variant="outline" className="capitalize">
                  {content.approach}
                </Badge>
                {content.duration && (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {content.duration < 60 
                      ? `${content.duration}s`
                      : `${Math.floor(content.duration / 60)}m`
                    }
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Area */}
        <ScrollArea className="flex-1 pr-4">
          <div className="py-4">
            {renderContentByType()}

            {/* Tags */}
            {content.tags && content.tags.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Tags</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {content.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="pt-4 border-t flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Close Preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper function to extract YouTube video ID
const extractYoutubeId = (url: string): string => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : '';
};

export default PreviewModal;
