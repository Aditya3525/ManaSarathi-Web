import { 
  Send,
  ArrowLeft,
  MessageCircle,
  User,
  AlertTriangle,
  Phone,
  X,
  Mic,
  MoreHorizontal,
  Menu,
  Download,
  LifeBuoy
} from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Logo } from '../../common/Logo';
import { LoadingSpinner } from '../../ui/loading-spinner';

import { useAccessibility } from '../../../contexts/AccessibilityContext';
import { chatApi, conversationsApi, type ChatSendMessageResponse } from '../../../services/api';
import {
  parseAssessmentPromptMeta,
  parseExerciseCardMeta,
  type AssessmentPromptMeta,
  type ExerciseCardMeta,
} from '../../../types/chat';
import {
  clearAssessmentShareContext,
  readAssessmentShareContext,
  type AssessmentShareContext,
} from '../../../utils/assessmentSharingContext';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import { Input } from '../../ui/input';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../../ui/sheet';
import { StaggerContainer, StaggerItem } from '../../ui/motion-wrapper';

import { ConversationHistorySidebar } from './ConversationHistorySidebar';
import { EmptyState } from './EmptyState';
import { BreathingAnimation, CBTThoughtRecord, GroundingChecklist } from './exercises';
import { ExportDialog } from './ExportDialog';
import { InlineFeedback } from './InlineFeedback';
import { MarkdownMessage } from './MarkdownMessage';
import { MessageActions } from './MessageActions';
import { QuickActionsBar } from './QuickActionsBar';

interface ChatbotProps {
  user: {
    firstName?: string;
    lastName?: string;
    name?: string;
  } | null;
  onNavigate: (page: string) => void;
  isModal?: boolean;
  onClose?: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'bot' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown> | string | null;
  suggestions?: string[];
  isTyping?: boolean;
  feedback?: 'liked' | 'disliked' | null;
  enableTypewriter?: boolean;
  assessmentPrompt?: AssessmentPromptMeta | null;
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

type SendMessageContentFn = (
  content: string,
  options?: { showUserMessage?: boolean; conversationId?: string }
) => Promise<void>;

const EMPTY_ASSISTANT_FALLBACK = "I'm here. Tell me more whenever you're ready.";

const resolveNonEmptyContent = (value: unknown, fallback = EMPTY_ASSISTANT_FALLBACK): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const buildAssessmentDiscussPrompt = (context: AssessmentShareContext): string => {
  const lines: string[] = [
    `I want to discuss my latest ${context.assessmentLabel} assessment results.`,
  ];

  if (typeof context.latestScore === 'number') {
    lines.push(`Latest score: ${Math.round(context.latestScore)}%.`);
  }

  if (typeof context.wellnessScore === 'number') {
    lines.push(`Overall wellness score: ${Math.round(context.wellnessScore)}%.`);
  }

  if (context.trend) {
    lines.push(`Trend: ${context.trend}.`);
  }

  if (context.interpretation) {
    lines.push(`Interpretation: ${context.interpretation}`);
  }

  if (Array.isArray(context.recommendations) && context.recommendations.length > 0) {
    lines.push(`Recommendations provided: ${context.recommendations.slice(0, 4).join('; ')}`);
  }

  lines.push('Please explain what this means and give me a practical plan I can follow today.');
  return lines.join('\n');
};

interface MessagesListProps {
  messages: Message[];
  isTyping: boolean;
  currentlyTypingMessageId: string | null;
  conversationStarters: string[];
  messageFeedback: Record<string, 'liked' | 'disliked' | null>;
  feedbackMessageId: string | null;
  setFeedbackMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  handleTypewriterComplete: () => void;
  handleSuggestionClick: (suggestion: string) => void;
  handleLike: (messageId: string) => Promise<void>;
  handleDislike: (messageId: string) => void;
  handleRegenerate: (messageId: string) => Promise<void>;
  speakText: (text: string) => void;
  handleFeedbackSubmit: (messageId: string, rating: 'positive' | 'negative', notes?: string) => Promise<void>;
  onNavigate: (page: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

const MessagesList = React.memo(({
  messages,
  isTyping,
  currentlyTypingMessageId,
  conversationStarters,
  messageFeedback,
  feedbackMessageId,
  setFeedbackMessageId,
  handleTypewriterComplete,
  handleSuggestionClick,
  handleLike,
  handleDislike,
  handleRegenerate,
  speakText,
  handleFeedbackSubmit,
  onNavigate,
  messagesEndRef,
}: MessagesListProps) => {
  const renderMessageBubble = (message: Message) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const exerciseMeta = !isUser && !isSystem ? parseExerciseCardMeta(message.metadata) : null;
    const assessmentPrompt = !isUser && !isSystem
      ? (message.assessmentPrompt ?? parseAssessmentPromptMeta(message.metadata))
      : null;

    const renderExerciseCard = (meta: ExerciseCardMeta) => {
      switch (meta.exerciseCard) {
        case 'breathing-animation':
          return (
            <BreathingAnimation
              title={meta.title}
              pattern={meta.pattern}
              rounds={meta.rounds}
            />
          );
        case 'grounding-checklist':
          return <GroundingChecklist title={meta.title} steps={meta.steps} />;
        case 'cbt-thought-record':
          return <CBTThoughtRecord title={meta.title} steps={meta.cbtSteps} />;
        case 'body-scan-visual':
        case 'worry-dump-timer':
          return (
            <MarkdownMessage
              content={message.content}
              enableTypewriter={message.enableTypewriter && message.id === currentlyTypingMessageId}
              typewriterSpeed={20}
              onTypewriterComplete={handleTypewriterComplete}
            />
          );
        default:
          return (
            <MarkdownMessage
              content={message.content}
              enableTypewriter={message.enableTypewriter && message.id === currentlyTypingMessageId}
              typewriterSpeed={20}
              onTypewriterComplete={handleTypewriterComplete}
            />
          );
      }
    };

    return (
      <div className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} mb-5 group message-enter`}>
        {!isUser && (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-border/20 ${
            isSystem ? 'bg-amber-100 dark:bg-amber-950/30' : 'bg-gradient-to-tr from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20'
          }`}>
            {isSystem ? (
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <Logo className="h-7 w-7" />
            )}
          </div>
        )}
        
        <div className="max-w-[90%] sm:max-w-[80%]">
          <div
            className={exerciseMeta
              ? 'rounded-2xl p-0 overflow-hidden shadow-md'
              : `rounded-2xl px-4 py-3.5 ${
                  isUser
                    ? 'bg-gradient-to-br from-teal-600 to-teal-700 text-white ml-auto rounded-2xl rounded-tr-none shadow-sm'
                    : isSystem
                      ? 'bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 rounded-xl px-4 py-2 text-center text-xs'
                      : 'bg-card border border-border/40 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-none shadow-sm hover:shadow-md transition-shadow'
                }`
            }
          >
            {exerciseMeta ? (
              <div className="w-full sm:min-w-[280px] max-w-[420px]">
                {renderExerciseCard(exerciseMeta)}
              </div>
            ) : (
              <MarkdownMessage
                content={message.content}
                enableTypewriter={message.enableTypewriter && message.id === currentlyTypingMessageId}
                typewriterSpeed={20}
                onTypewriterComplete={handleTypewriterComplete}
              />
            )}
          </div>

          {assessmentPrompt && (
            <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 shadow-sm">
              <p className="text-sm text-foreground font-medium">{assessmentPrompt.prompt}</p>
              {typeof assessmentPrompt.daysSinceLastAssessment === 'number' && (
                <p className="text-xs text-muted-foreground">
                  Last anxiety assessment was {assessmentPrompt.daysSinceLastAssessment} day(s) ago.
                </p>
              )}
              <Button size="sm" className="rounded-full shadow-sm" onClick={() => onNavigate('assessments')}>
                {assessmentPrompt.ctaLabel}
              </Button>
            </div>
          )}
          
          <div className={`flex items-center gap-2.5 mt-1.5 text-xs text-muted-foreground ${
            isUser ? 'justify-end' : 'justify-start'
          }`}>
            <span className="opacity-80">{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            
            {/* Message Actions - Only show for bot messages */}
            {!isUser && !isSystem && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <MessageActions
                  messageId={message.id}
                  content={message.content}
                  onLike={handleLike}
                  onDislike={handleDislike}
                  onRegenerate={handleRegenerate}
                  onSpeak={speakText}
                  feedback={messageFeedback[message.id] || null}
                />
              </div>
            )}
          </div>

          {!isUser && !isSystem && feedbackMessageId === message.id && (
            <div className="mt-2 bg-muted/40 border rounded-xl p-3 shadow-sm">
              <InlineFeedback
                messageId={message.id}
                onSubmit={handleFeedbackSubmit}
                onDismiss={() => setFeedbackMessageId(null)}
              />
            </div>
          )}

          {/* Suggestions */}
          {message.suggestions && message.suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {message.suggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-full border-border/50 hover:bg-primary/5 hover:border-primary/40 hover:text-primary transition-all duration-200"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
        </div>

        {isUser && (
          <div className="w-9 h-9 bg-gradient-to-tr from-teal-500 to-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border border-teal-600/10">
            <User className="h-5 w-5 text-white" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-6 bg-slate-50/30 dark:bg-slate-950/10">
      {messages.length === 0 ? (
        <EmptyState 
          onStarterClick={handleSuggestionClick}
          starters={conversationStarters.length > 0 ? conversationStarters : undefined}
        />
      ) : (
        <>
          <StaggerContainer staggerDelay={0.06}>
            {messages.map((message) => (
              <StaggerItem key={message.id}>
                {renderMessageBubble(message)}
              </StaggerItem>
            ))}
          </StaggerContainer>

          {/* Conversation Starters - Show when just initial greeting */}
          {messages.length === 1 && conversationStarters.length > 0 && (
            <div className="mt-8 max-w-2xl mx-auto bg-card/50 backdrop-blur-sm border rounded-2xl p-5 shadow-sm">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-4 text-center">
                Select a topic below to begin checking in:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <StaggerContainer staggerDelay={0.05}>
                  {conversationStarters.map((starter, index) => (
                    <StaggerItem key={index}>
                      <Button
                        variant="outline"
                        className="w-full h-auto py-3 px-4 text-left justify-start text-sm rounded-xl hover:bg-teal-500/5 hover:border-teal-500/40 hover:text-teal-600 transition-all duration-200 border-border/60 shadow-sm"
                        onClick={() => handleSuggestionClick(starter)}
                      >
                        <span className="mr-2 text-teal-500">✦</span>
                        {starter}
                      </Button>
                    </StaggerItem>
                  ))}
                </StaggerContainer>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Typing Indicator */}
      {isTyping && (
        <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border/50 rounded-2xl w-fit max-w-[80%] shadow-sm animate-pulse message-enter">
          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-gradient-to-tr from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20 border border-teal-500/10">
            <Logo className="h-5 w-5" />
          </div>
          <span className="text-sm text-slate-500 dark:text-slate-400 italic">
            {(() => {
              const phrases = ['typing...', 'thinking...', 'ManaSarathi is typing...'];
              return phrases[Math.floor(Date.now() / 1000) % phrases.length];
            })()}
          </span>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
});
MessagesList.displayName = 'MessagesList';

export function Chatbot({ user, onNavigate, isModal = false, onClose }: ChatbotProps) {
  const { t } = useTranslation();
  const { settings: accessibilitySettings } = useAccessibility();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showCrisisWarning, setShowCrisisWarning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false); // Manual voice control - off by default
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'liked' | 'disliked' | null>>({});
  const [currentlyTypingMessageId, setCurrentlyTypingMessageId] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const initializedForUserRef = useRef<string | null>(null);
  const isRequestInFlightRef = useRef(false);
  const pendingDiscussContextRef = useRef<AssessmentShareContext | null>(null);
  const autoDiscussInjectedRef = useRef(false);
  const sendMessageContentRef = useRef<SendMessageContentFn | null>(null);

  const userSignature = [user?.firstName, user?.lastName, user?.name]
    .filter(Boolean)
    .join('|') || 'anonymous';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load conversation starters and initial greeting
  useEffect(() => {
    if (initializedForUserRef.current === userSignature) {
      return;
    }
    initializedForUserRef.current = userSignature;

    const loadInitialData = async () => {
      try {
        // Load personalized greeting
        const greetingResponse = await chatApi.getMoodBasedGreeting();
        let greetingText = `Hey ${([user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'there')}! How are you doing today?`;
        
        if (greetingResponse.success && greetingResponse.data?.greeting) {
          greetingText = greetingResponse.data.greeting;
        }

        // Set initial greeting
        const greeting: Message = {
          id: '1',
          type: 'bot',
          content: greetingText,
          timestamp: new Date(),
          suggestions: []
        };
        setMessages([greeting]);

        // Load conversation starters
        const startersResponse = await chatApi.getConversationStarters();
        if (startersResponse.success && startersResponse.data) {
          setConversationStarters(startersResponse.data);
        }

        // Check for proactive check-in
        const checkInResponse = await chatApi.getProactiveCheckIn();
        if (checkInResponse.success && checkInResponse.data?.shouldCheckIn) {
          const checkIn = checkInResponse.data;
          // Add check-in message after a short delay
          setTimeout(() => {
            const checkInMessage: Message = {
              id: `checkin-${Date.now()}`,
              type: 'bot',
              content: checkIn.message,
              timestamp: new Date(),
              suggestions: ['Tell me more', 'I\'m doing okay', 'Not right now']
            };
            setMessages(prev => [...prev, checkInMessage]);
          }, 2000);
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
        // Fallback greeting
        const fallbackGreeting: Message = {
          id: '1',
          type: 'bot',
          content: `Hey there! How are you feeling today?`,
          timestamp: new Date(),
          suggestions: []
        };
        setMessages([fallbackGreeting]);
      }
    };

    loadInitialData();
  }, [user, userSignature]);

  useEffect(() => {
    autoDiscussInjectedRef.current = false;
    pendingDiscussContextRef.current = null;

    const context = readAssessmentShareContext();
    if (context?.source === 'insights-discuss') {
      pendingDiscussContextRef.current = context;
      clearAssessmentShareContext();
    }
  }, [userSignature]);

  // Initialize speech recognition
  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setVoiceInputSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setVoiceInputSupported(false);
    }

    // Initialize speech synthesis
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current || !voiceInputSupported) {
      console.warn('Voice input is not supported in this browser');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        if (isSpeaking) {
          stopSpeaking();
        }
        recognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        console.error('Failed to start speech recognition:', error);
        setIsListening(false);
      }
    }
  };

  const speakText = useCallback((text: string) => {
    if (!synthRef.current) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const applyChatPayload = useCallback((
    messagePayload: ChatSendMessageResponse,
    options?: {
      enableTypewriter?: boolean;
      replaceMessageId?: string;
      streamedContent?: string;
    }
  ) => {
    if (messagePayload.conversationId && messagePayload.conversationId !== currentConversationId) {
      setCurrentConversationId(messagePayload.conversationId);
    }

    const structuredMessage =
      typeof messagePayload.message === 'object' && messagePayload.message !== null
        ? (messagePayload.message as Record<string, unknown>)
        : null;
    const structuredContent =
      structuredMessage && typeof structuredMessage.content === 'string'
        ? structuredMessage.content
        : undefined;
    const structuredMetadata =
      structuredMessage && 'metadata' in structuredMessage
        ? ((structuredMessage.metadata as Record<string, unknown> | string | null) ?? null)
        : null;
    const assessmentPrompt = parseAssessmentPromptMeta(
      (messagePayload.assessmentPrompt as Record<string, unknown> | null | undefined) ?? structuredMetadata
    );
    const resolvedContent =
      options?.streamedContent && options.streamedContent.trim().length > 0
        ? options.streamedContent
        : resolveNonEmptyContent(
            structuredContent,
            'I apologize, but I encountered an issue generating a response.'
          );

    const smartReplies = messagePayload.smartReplies || [];
    const persistedBotMessageId =
      typeof messagePayload.message === 'object' &&
      messagePayload.message !== null &&
      'id' in messagePayload.message &&
      messagePayload.message.id
        ? String(messagePayload.message.id)
        : (Date.now() + 2).toString();

    const botResponse: Message = {
      id: persistedBotMessageId,
      type: 'bot',
      content: resolvedContent,
      metadata: structuredMetadata,
      timestamp: new Date(),
      suggestions: smartReplies,
      enableTypewriter: options?.enableTypewriter ?? true,
      assessmentPrompt,
    };

    setCurrentlyTypingMessageId((options?.enableTypewriter ?? true) ? persistedBotMessageId : null);
    setMessages((prev) => {
      const withoutStreamingPlaceholder = options?.replaceMessageId
        ? prev.filter((msg) => msg.id !== options.replaceMessageId)
        : prev;
      return [...withoutStreamingPlaceholder, botResponse];
    });

    if (messagePayload.crisis) {
      setShowCrisisWarning(true);
    }

    if (voiceEnabled) {
      speakText(resolvedContent);
    }
  }, [currentConversationId, voiceEnabled, speakText]);

  const sendMessageContent = useCallback(async (
    content: string,
    options?: { showUserMessage?: boolean; conversationId?: string }
  ) => {
    const messageContent = content.trim();
    if (!messageContent) return;
    if (isRequestInFlightRef.current) return;

    isRequestInFlightRef.current = true;

    const shouldShowUserMessage = options?.showUserMessage !== false;
    if (shouldShowUserMessage) {
      const userMessage: Message = {
        id: Date.now().toString(),
        type: 'user',
        content: messageContent,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setInputValue('');
    }

    setIsTyping(true);

    try {
      const targetConversationId = options?.conversationId ?? currentConversationId ?? undefined;

      const sendWithLegacyEndpoint = async () => {
        const response = await chatApi.sendMessage(messageContent, targetConversationId, {
          simpleLanguage: accessibilitySettings.simpleLanguage,
        });

        if (response.success && response.data) {
          applyChatPayload(response.data, { enableTypewriter: true });
          return;
        }

        console.error('❌ Chat API failed:', response.error);
        const fallbackMessage: Message = {
          id: (Date.now() + 2).toString(),
          type: 'bot',
          content: 'Hmm, I\'m having a bit of trouble on my end. Can you try saying that again?',
          timestamp: new Date()
        };
        setMessages((prev) => [...prev, fallbackMessage]);
      };

      const streamingMessageId = `stream-${Date.now()}`;
      let streamStarted = false;
      let streamReceivedToken = false;
      let streamedContent = '';

      try {
        const streamPayload = await chatApi.streamMessage(
          messageContent,
          targetConversationId,
          { simpleLanguage: accessibilitySettings.simpleLanguage },
          (event) => {
            if (event.type === 'token') {
              streamReceivedToken = true;
              streamedContent += event.token;

              if (!streamStarted) {
                streamStarted = true;
                setIsTyping(false);
                setCurrentlyTypingMessageId(null);
                setMessages((prev) => [
                  ...prev,
                  {
                    id: streamingMessageId,
                    type: 'bot',
                    content: '',
                    timestamp: new Date(),
                    suggestions: [],
                    enableTypewriter: false,
                  }
                ]);
              }

              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === streamingMessageId
                    ? {
                        ...msg,
                        content: streamedContent,
                      }
                    : msg
                )
              );
            }
          }
        );

        applyChatPayload(streamPayload, {
          enableTypewriter: false,
          replaceMessageId: streamStarted ? streamingMessageId : undefined,
          streamedContent,
        });
      } catch (streamError) {
        console.error('❌ Chat stream error:', streamError);

        if (!streamReceivedToken) {
          await sendWithLegacyEndpoint();
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `stream-warning-${Date.now()}`,
              type: 'system',
              content: 'The response stream was interrupted. You can ask me to continue from where we left off.',
              timestamp: new Date(),
            }
          ]);
        }
      }
    } catch (error) {
      console.error('❌ Chat API error:', error);

      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: 'bot',
        content: 'Sorry about that — something went wrong on my side. Mind trying again?',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      isRequestInFlightRef.current = false;
    }
  }, [currentConversationId, accessibilitySettings.simpleLanguage, voiceEnabled, speakText, applyChatPayload]);

  const handleSendMessage = useCallback(async () => {
    if (isTyping || isRequestInFlightRef.current) {
      return;
    }
    await sendMessageContent(inputValue);
  }, [inputValue, isTyping, sendMessageContent]);

  sendMessageContentRef.current = sendMessageContent;

  useEffect(() => {
    if (autoDiscussInjectedRef.current) {
      return;
    }

    const context = pendingDiscussContextRef.current;
    if (!context) {
      return;
    }

    if (messages.length === 0 || isTyping || isRequestInFlightRef.current) {
      return;
    }

    autoDiscussInjectedRef.current = true;
    void sendMessageContentRef.current?.(buildAssessmentDiscussPrompt(context));
  }, [messages.length, isTyping]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion);
  }, []);

  const handleLike = useCallback(async (messageId: string) => {
    setMessageFeedback(prev => ({
      ...prev,
      [messageId]: 'liked'
    }));

    try {
      await chatApi.submitMessageFeedback(messageId, 'liked');
    } catch (error) {
      console.error('Failed to submit like feedback:', error);
      setMessageFeedback(prev => ({ ...prev, [messageId]: null }));
    }
  }, []);

  const handleFeedbackSubmit = useCallback(async (
    messageId: string,
    rating: 'positive' | 'negative',
    notes?: string,
  ) => {
    if (rating === 'positive') {
      await handleLike(messageId);
      setFeedbackMessageId(null);
      return;
    }

    setMessageFeedback(prev => ({
      ...prev,
      [messageId]: 'disliked'
    }));

    try {
      const feedbackResponse = await chatApi.submitMessageFeedback(messageId, 'disliked', notes);

      if (feedbackResponse.success && feedbackResponse.data?.repairPrompt) {
        setMessages(prev => [
          ...prev,
          {
            id: `repair-${Date.now()}`,
            type: 'system',
            content: feedbackResponse.data?.repairPrompt || 'Thanks for the feedback. What would feel most helpful right now?',
            timestamp: new Date()
          }
        ]);
      }
    } catch (error) {
      console.error('Failed to submit dislike feedback:', error);
      setMessageFeedback(prev => ({ ...prev, [messageId]: null }));
    } finally {
      setFeedbackMessageId(null);
    }
  }, [handleLike]);

  const handleDislike = useCallback((messageId: string) => {
    setFeedbackMessageId((prev) => (prev === messageId ? null : messageId));
  }, []);

  const handleRegenerate = useCallback(async (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const userMessages = messages.slice(0, messageIndex).filter(m => m.type === 'user');
    if (userMessages.length === 0) return;

    const lastUserMessage = userMessages[userMessages.length - 1];

    setMessages(prev => prev.filter(m => m.id !== messageId));

    await sendMessageContent(lastUserMessage.content, {
      showUserMessage: false,
      conversationId: currentConversationId || undefined
    });
  }, [messages, currentConversationId, sendMessageContent]);

  const handleGetExercises = useCallback(() => {
    onNavigate('exercises');
  }, [onNavigate]);

  const handleGetSummary = useCallback(async () => {
    const summaryRequest = 'Can you provide a brief summary of our conversation so far and any key insights or recommendations?';
    await sendMessageContent(summaryRequest);
  }, [sendMessageContent]);

  const handleBookmark = useCallback(() => {
    const bookmark = {
      id: currentConversationId || `local-${Date.now()}`,
      title: messages.find((message) => message.type === 'user')?.content.slice(0, 80) || 'Untitled conversation',
      conversationId: currentConversationId,
      savedAt: new Date().toISOString(),
      messageCount: messages.filter((message) => message.type !== 'system').length,
    };

    let existingBookmarks: typeof bookmark[] = [];
    try {
      existingBookmarks = JSON.parse(localStorage.getItem('mw-chat-bookmarks-v1') || '[]') as typeof bookmark[];
    } catch {
      existingBookmarks = [];
    }
    const nextBookmarks = [
      bookmark,
      ...existingBookmarks.filter((item) => item.id !== bookmark.id),
    ].slice(0, 25);
    localStorage.setItem('mw-chat-bookmarks-v1', JSON.stringify(nextBookmarks));

    const systemMessage: Message = {
      id: Date.now().toString(),
      type: 'system',
      content: 'Conversation bookmarked on this device.',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, systemMessage]);
  }, [currentConversationId, messages]);

  const handleExport = useCallback(() => {
    if (!currentConversationId) {
      const conversationText = messages
        .map(m => {
          const sender = m.type === 'user' ? 'You' : m.type === 'bot' ? 'AI Assistant' : 'System';
          const time = m.timestamp.toLocaleString();
          return `[${time}] ${sender}:\n${m.content}\n`;
        })
        .join('\n---\n\n');

      const blob = new Blob([conversationText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chat-export-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    setShowExportDialog(true);
  }, [currentConversationId, messages]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isTyping || isRequestInFlightRef.current) {
        return;
      }
      handleSendMessage();
    }
  }, [isTyping, handleSendMessage]);

  const handleTypewriterComplete = useCallback(() => {
    setCurrentlyTypingMessageId(null);
  }, []);

  const handleSelectConversation = useCallback(async (conversationId: string | null) => {
    if (conversationId === null) {
      setCurrentConversationId(null);
      setMessages([]);
      setShowMobileSidebar(false);
      const greeting: Message = {
        id: '1',
        type: 'bot',
        content: `Hey ${([user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'there')}! What would you like to talk about?`,
        timestamp: new Date(),
        suggestions: conversationStarters
      };
      setMessages([greeting]);
    } else {
      setCurrentConversationId(conversationId);
      setShowMobileSidebar(false);
      
      const loadingMessage: Message = {
        id: 'loading',
        type: 'system',
        content: 'Loading conversation...',
        timestamp: new Date()
      };
      setMessages([loadingMessage]);
      
      try {
        const response = await conversationsApi.getConversation(conversationId);
        if (response.success && response.data?.messages) {
          const loadedMessages: Message[] = response.data.messages.map((msg) => ({
            id: msg.id,
            type: msg.type as 'user' | 'bot' | 'system',
            content:
              msg.type === 'bot' || msg.type === 'system'
                ? resolveNonEmptyContent(msg.content)
                : String(msg.content ?? ''),
            timestamp: new Date(msg.createdAt),
            metadata: msg.metadata ?? null,
            assessmentPrompt: parseAssessmentPromptMeta(msg.metadata ?? null),
            suggestions: [],
          }));
          
          setMessages(loadedMessages);
        } else {
          const errorMessage: Message = {
            id: 'error',
            type: 'system',
            content: 'Failed to load conversation. Please try again.',
            timestamp: new Date()
          };
          setMessages([errorMessage]);
        }
      } catch (error) {
        console.error('Error loading conversation:', error);
        const errorMessage: Message = {
          id: 'error',
          type: 'system',
          content: 'Failed to load conversation. Please try again.',
          timestamp: new Date()
        };
        setMessages([errorMessage]);
      }
    }
  }, [user, conversationStarters]);

  const chatContent = (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header - Fixed (modern glassmorphism style) */}
      <div className={`flex-shrink-0 border-b border-border/40 backdrop-blur-md bg-background/85 px-4 py-3.5 z-10 shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isModal && (
              <>
                {/* Mobile Menu Button */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="lg:hidden h-9 w-9 p-0 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-full"
                  onClick={() => setShowMobileSidebar(true)}
                >
                  <Menu className="h-5 w-5 text-muted-foreground" />
                </Button>
                
                {/* Back Button - Hidden on Mobile */}
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="hidden lg:flex h-9 rounded-full px-4 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                  onClick={() => onNavigate('dashboard')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-tr from-teal-500/10 to-emerald-500/10 rounded-full flex items-center justify-center border border-teal-500/20 shadow-inner">
                <MessageCircle className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h1 className="font-semibold text-sm md:text-base leading-tight tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  {t('chat.title')}
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" title="Ready to support" />
                </h1>
                <p className="text-xs text-muted-foreground leading-normal">{t('chat.subtitle')}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Voice Toggle Button */}
            <Button 
              variant={voiceEnabled ? "default" : "ghost"} 
              size="sm"
              onClick={() => {
                if (isSpeaking) stopSpeaking();
                setVoiceEnabled(!voiceEnabled);
              }}
              title={voiceEnabled ? "Voice replies ON - Click to disable" : "Voice replies OFF - Click to enable"}
              className={`h-9 rounded-full px-3 hover:scale-105 active:scale-95 transition-all duration-150 ${voiceEnabled ? "bg-teal-600 text-white hover:bg-teal-700 shadow-sm" : "hover:bg-slate-100 dark:hover:bg-slate-900"}`}
            >
              <span className="mr-1 text-sm">{voiceEnabled ? "🔊" : "🔇"}</span>
              <span className="text-xs font-medium hidden sm:inline">{voiceEnabled ? "Voice ON" : "Muted"}</span>
            </Button>
            {isModal && onClose && (
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl shadow-md border-border/40">
                <DropdownMenuItem onClick={handleExport} className="rounded-lg">
                  <Download className="h-4 w-4 mr-2" />
                  {t('chat.exportChat')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onNavigate('help')} className="rounded-lg text-red-600 focus:text-red-700 dark:focus:text-red-400">
                  <LifeBuoy className="h-4 w-4 mr-2" />
                  {t('chat.crisisResources')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Messages viewport - Memoized to prevent input blinking */}
      <MessagesList
        messages={messages}
        isTyping={isTyping}
        currentlyTypingMessageId={currentlyTypingMessageId}
        conversationStarters={conversationStarters}
        messageFeedback={messageFeedback}
        feedbackMessageId={feedbackMessageId}
        setFeedbackMessageId={setFeedbackMessageId}
        handleTypewriterComplete={handleTypewriterComplete}
        handleSuggestionClick={handleSuggestionClick}
        handleLike={handleLike}
        handleDislike={handleDislike}
        handleRegenerate={handleRegenerate}
        speakText={speakText}
        handleFeedbackSubmit={handleFeedbackSubmit}
        onNavigate={onNavigate}
        messagesEndRef={messagesEndRef}
      />

      {/* Quick Actions Bar */}
      <QuickActionsBar
        onExercises={handleGetExercises}
        onSummary={handleGetSummary}
        onBookmark={handleBookmark}
        onExport={handleExport}
      />

      {/* Input Composer - Modern floating card style */}
      <div className="flex-shrink-0 px-4 pb-4 sm:pb-6 pt-2 bg-gradient-to-t from-background via-background/95 to-transparent">
        <div className="max-w-3xl mx-auto flex gap-2.5 items-center bg-card border border-border/60 hover:border-teal-500/40 rounded-3xl shadow-md hover:shadow-lg focus-within:shadow-lg focus-within:border-teal-500/60 p-2 transition-all duration-200">
          <div className="flex-1 relative flex items-center pl-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={t('chat.placeholder')}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-1.5 h-auto text-sm placeholder:text-slate-400/80 bg-transparent flex-1"
            />
          </div>
          
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-8 w-8 p-0 rounded-full transition-transform active:scale-95 ${isSpeaking ? 'bg-teal-500/10 text-teal-600' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
              onClick={() => {
                if (isSpeaking) {
                  stopSpeaking();
                } else {
                  const lastBotMessage = [...messages].reverse().find(m => m.type === 'bot');
                  if (lastBotMessage) {
                    speakText(lastBotMessage.content);
                  }
                }
              }}
              title={isSpeaking ? "Stop speaking" : "Read last message aloud"}
            >
              {isSpeaking ? (
                <div className="h-4 w-4 relative flex items-center justify-center">
                  <div className="absolute inset-0 animate-ping bg-teal-500 rounded-full opacity-60" />
                  <span className="text-xs relative">⏹️</span>
                </div>
              ) : (
                <span className="text-sm">🔊</span>
              )}
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-8 w-8 p-0 rounded-full transition-all active:scale-95 ${isListening ? 'bg-red-50 text-red-600 dark:bg-red-950/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
              onClick={toggleVoiceInput}
              title={isListening ? "Stop listening" : "Voice input"}
              disabled={!voiceInputSupported}
            >
              <Mic className={`h-5 w-5 ${isListening ? 'animate-pulse text-red-500' : ''}`} />
            </Button>

            <Button 
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping}
              size="sm"
              className="h-8 w-8 p-0 rounded-full bg-teal-600 text-white hover:bg-teal-700 hover:scale-105 transition-all shadow-sm flex items-center justify-center"
            >
              {isTyping ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return <div className="flex flex-col h-full">{chatContent}</div>;
  }

  return (
    <div className="fixed inset-0 bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-80 border-r flex-shrink-0">
        <ConversationHistorySidebar
          activeConversationId={currentConversationId}
          onSelectConversation={handleSelectConversation}
          className="h-full"
        />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent side="left" className="w-80 p-0" aria-describedby="conversation-list-description">
          <SheetTitle className="sr-only">Conversation History</SheetTitle>
          <SheetDescription id="conversation-list-description" className="sr-only">
            Browse and select from your previous conversations
          </SheetDescription>
          <ConversationHistorySidebar
            activeConversationId={currentConversationId}
            onSelectConversation={(conversationId) => {
              handleSelectConversation(conversationId);
              setShowMobileSidebar(false);
            }}
            className="h-full"
            showCloseButton={false}
          />
        </SheetContent>
      </Sheet>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {chatContent}
      </div>

      {/* Crisis Warning Modal */}
      {showCrisisWarning && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                We Care About Your Safety
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                It sounds like you might be going through something serious. We want to help you connect 
                with immediate professional support.
              </p>
              
              <div className="space-y-3">
                <Button className="w-full" onClick={() => window.open('tel:988')}>
                  <Phone className="h-4 w-4 mr-2" />
                  Call 988 (Crisis Lifeline)
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => onNavigate('help')}
                >
                  View Crisis Resources
                </Button>
                
                <Button 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setShowCrisisWarning(false)}
                >
                  Continue Conversation
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• National Suicide Prevention Lifeline: 988</p>
                <p>• Crisis Text Line: Text HOME to 741741</p>
                <p>• Emergency Services: 911</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Export Dialog */}
      {currentConversationId && (
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          conversationId={currentConversationId}
          conversationTitle="Current Conversation"
          messageCount={messages.length}
        />
      )}
    </div>
  );
}
