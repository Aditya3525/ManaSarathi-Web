import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Download,
  LifeBuoy,
  Loader2,
  Menu,
  MessageCircle,
  Mic,
  MoreVertical,
  Phone,
  Send,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAccessibility } from '../../../contexts/AccessibilityContext';
import { chatApi, conversationsApi, type ConversationMessage } from '../../../services/api';
import { parseAssessmentPromptMeta, type AssessmentPromptMeta } from '../../../types/chat';
import type {
  ISpeechRecognition,
  ISpeechRecognitionErrorEvent,
  ISpeechRecognitionEvent,
} from '../../../types/speech-recognition';
import './responsive-chatbot.css';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '../../ui/sheet';
import { Textarea } from '../../ui/textarea';

import { ConversationHistorySidebar } from './ConversationHistorySidebar';
import { ExportDialog } from './ExportDialog';
import { MarkdownMessage } from './MarkdownMessage';
import { MessageActions } from './MessageActions';

interface ResponsiveChatbotProps {
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
  feedback?: 'liked' | 'disliked' | null;
  assessmentPrompt?: AssessmentPromptMeta | null;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => ISpeechRecognition;
  webkitSpeechRecognition?: new () => ISpeechRecognition;
};

const BREAKPOINTS = {
  MOBILE: 900,
};

const EMPTY_ASSISTANT_FALLBACK = 'I am here with you. Could you share a little more so I can support you better?';

const resolveNonEmptyContent = (value: unknown, fallback = EMPTY_ASSISTANT_FALLBACK): string => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const mapConversationMessageType = (message: ConversationMessage): 'user' | 'bot' | 'system' => {
  if (message.type === 'user' || message.role === 'user') {
    return 'user';
  }

  if (message.type === 'system' || message.role === 'system') {
    return 'system';
  }

  return 'bot';
};

const nowMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const buildUserLabel = (user: ResponsiveChatbotProps['user']) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || 'there';

export function ResponsiveChatbot({ user, onNavigate, isModal = false, onClose }: ResponsiveChatbotProps) {
  const { settings: accessibilitySettings } = useAccessibility();

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationStarters, setConversationStarters] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(true);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showCrisisWarning, setShowCrisisWarning] = useState(false);
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'liked' | 'disliked' | null>>({});
  const [feedbackTargetMessageId, setFeedbackTargetMessageId] = useState<string | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window === 'undefined' ? 1200 : window.innerWidth
  );
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const userSignatureRef = useRef<string | null>(null);
  const requestSequenceRef = useRef(0);

  const userLabel = buildUserLabel(user);
  const userSignature = [user?.firstName, user?.lastName, user?.name].filter(Boolean).join('|') || 'anonymous';
  const isMobile = viewportWidth <= BREAKPOINTS.MOBILE;

  const latestAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.type === 'bot' && message.content.trim().length > 0),
    [messages]
  );

  const appendSystemMessage = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: nowMessageId(),
        type: 'system',
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setShowMobileSidebar(false);
    }
  }, [isMobile]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowJumpToLatest(distanceFromBottom > 120);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    scrollToBottom(messages.length <= 1 ? 'auto' : 'smooth');
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    const maxHeight = isMobile ? 160 : 144;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [inputValue, isMobile]);

  const loadInitialConversation = useCallback(async () => {
    try {
      const [greetingResponse, startersResponse, checkInResponse] = await Promise.all([
        chatApi.getMoodBasedGreeting(),
        chatApi.getConversationStarters(),
        chatApi.getProactiveCheckIn(),
      ]);

      const greetingText =
        greetingResponse.success && greetingResponse.data?.greeting
          ? greetingResponse.data.greeting
          : `Hello ${userLabel}! I am ManaSarathi, your wellbeing companion. Tell me what is on your mind right now.`;

      const initialMessages: Message[] = [
        {
          id: nowMessageId(),
          type: 'bot',
          content: greetingText,
          timestamp: new Date(),
        },
      ];

      if (checkInResponse.success && checkInResponse.data?.shouldCheckIn) {
        initialMessages.push({
          id: nowMessageId(),
          type: 'bot',
          content: checkInResponse.data.message,
          timestamp: new Date(),
          suggestions: ['Tell me more', 'I am okay for now', 'Maybe later'],
        });
      }

      setMessages(initialMessages);
      setConversationStarters(startersResponse.success && startersResponse.data ? startersResponse.data : []);
    } catch (error) {
      console.error('Failed to bootstrap chatbot:', error);
      setMessages([
        {
          id: nowMessageId(),
          type: 'bot',
          content: `Hello ${userLabel}! I am here with you. What would help most right now?`,
          timestamp: new Date(),
        },
      ]);
      setConversationStarters([]);
    }
  }, [userLabel]);

  useEffect(() => {
    if (userSignatureRef.current === userSignature) {
      return;
    }

    userSignatureRef.current = userSignature;
    setCurrentConversationId(null);
    setInputValue('');
    setMessageFeedback({});
    void loadInitialConversation();
  }, [loadInitialConversation, userSignature]);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognitionApi = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    if (SpeechRecognitionApi) {
      const recognition = new SpeechRecognitionApi();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: ISpeechRecognitionEvent) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        setInputValue((prev) => (prev.trim().length > 0 ? `${prev} ${transcript}`.trim() : transcript));
        setIsListening(false);
      };

      recognition.onerror = (_event: ISpeechRecognitionErrorEvent) => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setVoiceInputSupported(true);
    }

    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      recognitionRef.current?.stop();
      synthRef.current?.cancel();
    };
  }, []);

  const speakText = (text: string) => {
    if (!synthRef.current) {
      appendSystemMessage('Speech output is not supported in this browser.');
      return;
    }

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  };

  const toggleVoiceInput = () => {
    if (!voiceInputSupported || !recognitionRef.current) {
      appendSystemMessage('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    recognitionRef.current.start();
    setIsListening(true);
  };

  const pushAssistantReply = useCallback((responseData: Awaited<ReturnType<typeof chatApi.sendMessage>>['data']) => {
    if (!responseData) {
      appendSystemMessage('No response payload received from the server.');
      return;
    }

    const structuredMessage =
      typeof responseData.message === 'object' && responseData.message !== null ? responseData.message : null;

    const assistantContent = resolveNonEmptyContent(
      structuredMessage ? structuredMessage.content : responseData.message,
      'I am having trouble generating a response right now. Please try again.'
    );

    const metadata =
      structuredMessage && 'metadata' in structuredMessage
        ? ((structuredMessage.metadata as Record<string, unknown> | string | null) ?? null)
        : null;

    const assessmentPrompt = parseAssessmentPromptMeta(
      (responseData.assessmentPrompt as Record<string, unknown> | null | undefined) ?? metadata
    );

    const persistedId =
      structuredMessage && 'id' in structuredMessage && structuredMessage.id ? String(structuredMessage.id) : nowMessageId();

    setMessages((prev) => [
      ...prev,
      {
        id: persistedId,
        type: 'bot',
        content: assistantContent,
        metadata,
        suggestions: responseData.smartReplies || [],
        timestamp: new Date(),
        assessmentPrompt,
      },
    ]);

    if (responseData.crisis) {
      setShowCrisisWarning(true);
    }

    if (responseData.conversationId) {
      setCurrentConversationId(responseData.conversationId);
    }
  }, [appendSystemMessage]);

  const sendMessageContent = useCallback(
    async (content: string, options?: { showUserMessage?: boolean; conversationId?: string }) => {
      if (isSending || isLoadingConversation) {
        return;
      }

      const cleanContent = content.trim();
      if (!cleanContent) {
        return;
      }

      const shouldShowUserMessage = options?.showUserMessage !== false;
      if (shouldShowUserMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: nowMessageId(),
            type: 'user',
            content: cleanContent,
            timestamp: new Date(),
          },
        ]);
      }

      setInputValue('');
      setIsSending(true);
      const requestId = ++requestSequenceRef.current;

      try {
        const response = await chatApi.sendMessage(
          cleanContent,
          options?.conversationId ?? currentConversationIdRef.current ?? undefined,
          {
            simpleLanguage: accessibilitySettings.simpleLanguage,
          }
        );

        if (requestId !== requestSequenceRef.current) {
          return;
        }

        if (!response.success || !response.data) {
          appendSystemMessage(response.error || 'Unable to send message right now.');
          return;
        }

        pushAssistantReply(response.data);
      } catch (error) {
        console.error('Failed to send message:', error);
        appendSystemMessage('I hit a temporary issue while sending your message. Please try again.');
      } finally {
        if (requestId === requestSequenceRef.current) {
          setIsSending(false);
        }
      }
    },
    [
      accessibilitySettings.simpleLanguage,
      appendSystemMessage,
      isLoadingConversation,
      isSending,
      pushAssistantReply,
    ]
  );

  const handleSendMessage = async () => {
    await sendMessageContent(inputValue);
  };

  const handleSelectConversation = async (conversationId: string | null) => {
    requestSequenceRef.current += 1;
    setIsSending(false);

    if (conversationId === null) {
      setCurrentConversationId(null);
      setInputValue('');
      setShowMobileSidebar(false);
      await loadInitialConversation();
      return;
    }

    setShowMobileSidebar(false);
    setCurrentConversationId(conversationId);
    setInputValue('');
    setIsLoadingConversation(true);

    try {
      const response = await conversationsApi.getConversation(conversationId);
      if (!response.success || !response.data?.messages) {
        appendSystemMessage(response.error || 'Failed to load conversation.');
        return;
      }

      const loadedMessages: Message[] = response.data.messages.map((message) => {
        const type = mapConversationMessageType(message);
        const parsedPrompt = parseAssessmentPromptMeta(message.metadata ?? null);

        return {
          id: message.id,
          type,
          content: type === 'bot' || type === 'system' ? resolveNonEmptyContent(message.content) : message.content,
          metadata: message.metadata ?? null,
          timestamp: new Date(message.createdAt),
          assessmentPrompt: parsedPrompt,
          suggestions: [],
        };
      });

      setMessages(loadedMessages.length > 0 ? loadedMessages : [
        {
          id: nowMessageId(),
          type: 'system',
          content: 'This conversation has no messages yet.',
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Failed to load selected conversation:', error);
      appendSystemMessage('Failed to load conversation. Please try again.');
    } finally {
      setIsLoadingConversation(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    void sendMessageContent(suggestion);
  };

  const handleLike = async (messageId: string) => {
    setMessageFeedback((prev) => ({ ...prev, [messageId]: 'liked' }));
    try {
      await chatApi.submitMessageFeedback(messageId, 'liked');
    } catch (error) {
      console.error('Failed to submit like feedback:', error);
      setMessageFeedback((prev) => ({ ...prev, [messageId]: null }));
    }
  };

  const handleDislike = (messageId: string) => {
    setMessageFeedback((prev) => ({ ...prev, [messageId]: 'disliked' }));
    setFeedbackTargetMessageId(messageId);
    setFeedbackNote('');
  };

  const submitDislikeFeedback = async (messageId: string, note?: string) => {
    setIsSubmittingFeedback(true);
    try {
      const response = await chatApi.submitMessageFeedback(messageId, 'disliked', note);
      if (response.success && response.data?.repairPrompt) {
        appendSystemMessage(response.data.repairPrompt);
      }
    } catch (error) {
      console.error('Failed to submit dislike feedback:', error);
      setMessageFeedback((prev) => ({ ...prev, [messageId]: null }));
    } finally {
      setIsSubmittingFeedback(false);
      setFeedbackTargetMessageId(null);
      setFeedbackNote('');
    }
  };

  const handleRegenerate = async (messageId: string) => {
    const messageIndex = messages.findIndex((message) => message.id === messageId);
    if (messageIndex < 0) {
      return;
    }

    const previousUserMessage = [...messages.slice(0, messageIndex)]
      .reverse()
      .find((message) => message.type === 'user');

    if (!previousUserMessage) {
      return;
    }

    setMessages((prev) => prev.filter((message) => message.id !== messageId));
    await sendMessageContent(previousUserMessage.content, {
      showUserMessage: false,
      conversationId: currentConversationIdRef.current ?? undefined,
    });
  };

  const messageBubble = (message: Message) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const feedback = messageFeedback[message.id] || null;

    return (
      <article key={message.id} className={`chat-message-row ${isUser ? 'chat-message-row--user' : ''}`}>
        {!isUser && (
          <div className={`chat-avatar ${isSystem ? 'chat-avatar--system' : 'chat-avatar--assistant'}`}>
            {isSystem ? <AlertTriangle size={14} /> : <Bot size={14} />}
          </div>
        )}

        <div className={`chat-bubble-wrap ${isUser ? 'chat-bubble-wrap--user' : ''}`}>
          <div className={`chat-bubble ${isUser ? 'chat-bubble--user' : isSystem ? 'chat-bubble--system' : 'chat-bubble--assistant'}`}>
            <MarkdownMessage content={message.content} />
          </div>

          {message.assessmentPrompt && (
            <div className="chat-assessment-card">
              <p className="chat-assessment-text">{message.assessmentPrompt.prompt}</p>
              {typeof message.assessmentPrompt.daysSinceLastAssessment === 'number' && (
                <p className="chat-assessment-subtext">
                  Last anxiety check: {message.assessmentPrompt.daysSinceLastAssessment} day(s) ago.
                </p>
              )}
              <Button size="sm" onClick={() => onNavigate('assessments')}>
                {message.assessmentPrompt.ctaLabel}
              </Button>
            </div>
          )}

          <div className={`chat-message-meta ${isUser ? 'chat-message-meta--user' : ''}`}>
            <span>
              {message.timestamp.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {!isUser && !isSystem && (
              <MessageActions
                messageId={message.id}
                content={message.content}
                onLike={handleLike}
                onDislike={handleDislike}
                onRegenerate={handleRegenerate}
                onSpeak={speakText}
                feedback={feedback}
              />
            )}
          </div>

          {message.suggestions && message.suggestions.length > 0 && (
            <div className="chat-suggestion-row">
              {message.suggestions.map((suggestion) => (
                <Button key={`${message.id}-${suggestion}`} variant="outline" size="sm" onClick={() => handleSuggestionClick(suggestion)}>
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
        </div>

        {isUser && (
          <div className="chat-avatar chat-avatar--user">
            <User size={14} />
          </div>
        )}
      </article>
    );
  };

  const header = (
    <header className="chat-header">
      <div className="chat-header-left">
        {!isModal && (
          <Button
            variant="ghost"
            size="sm"
            className="chat-header-button"
            onClick={() => {
              if (isMobile) {
                setShowMobileSidebar(true);
                return;
              }
              onNavigate('dashboard');
            }}
          >
            {isMobile ? <Menu size={18} /> : <ArrowLeft size={18} />}
          </Button>
        )}

        <div className="chat-brand-mark">
          <MessageCircle size={16} />
        </div>

        <div className="chat-header-copy">
          <h1>ManaSarathi Chat</h1>
          <p>Grounded support, tailored to your context</p>
        </div>
      </div>

      <div className="chat-header-actions">
        {!isModal && !isMobile && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDesktopSidebar((prev) => !prev)}
            className="chat-header-button"
          >
            {showDesktopSidebar ? 'Hide history' : 'Show history'}
          </Button>
        )}

        {isModal && onClose && (
          <Button variant="ghost" size="sm" className="chat-header-button" onClick={onClose}>
            <X size={18} />
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="chat-header-button">
              <MoreVertical size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowExportDialog(true)}>
              <Download size={16} className="mr-2" />
              Export chat
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate('help')}>
              <LifeBuoy size={16} className="mr-2" />
              Crisis resources
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );

  const composer = (
    <div className="chat-composer">
      <Textarea
        ref={inputRef}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void handleSendMessage();
          }
        }}
        placeholder="Share what is happening right now..."
        className="chat-composer-input"
        disabled={isLoadingConversation}
        rows={1}
      />

      <div className="chat-composer-actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (isSpeaking) {
              stopSpeaking();
              return;
            }

            if (latestAssistantMessage) {
              speakText(latestAssistantMessage.content);
            }
          }}
          disabled={!isSpeaking && !latestAssistantMessage}
          aria-label={isSpeaking ? 'Stop reading aloud' : 'Read latest assistant message aloud'}
        >
          {isSpeaking ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleVoiceInput}
          disabled={!voiceInputSupported || isLoadingConversation}
          className={isListening ? 'chat-mic-active' : ''}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
        >
          <Mic size={18} />
        </Button>

        <Button
          size="sm"
          onClick={() => void handleSendMessage()}
          disabled={inputValue.trim().length === 0 || isSending || isLoadingConversation}
          aria-label="Send message"
        >
          {isSending || isLoadingConversation ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </Button>
      </div>
    </div>
  );

  const mainPanel = (
    <section className="chat-main-panel">
      {header}

      <div ref={messagesContainerRef} className="chat-message-scroll">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="chat-empty-mark">
              <MessageCircle size={22} />
            </div>
            <h2>Start your conversation</h2>
            <p>You can ask for emotional support, reflection prompts, practical coping tools, or daily planning.</p>
            <div className="chat-empty-starters">
              {conversationStarters.map((starter) => (
                <Button key={starter} variant="outline" onClick={() => handleSuggestionClick(starter)}>
                  {starter}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => messageBubble(message))}
            {isSending && (
              <div className="chat-typing-row">
                <div className="chat-avatar chat-avatar--assistant">
                  <Bot size={14} />
                </div>
                <div className="chat-typing-pill" aria-label="Assistant is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {showJumpToLatest && (
        <div className="chat-jump-wrap">
          <Button variant="secondary" size="sm" onClick={() => scrollToBottom('smooth')}>
            Jump to latest
          </Button>
        </div>
      )}

      {composer}
    </section>
  );

  return (
    <>
      {isModal ? (
        <div className="chat-modal-shell">{mainPanel}</div>
      ) : (
        <div className="chatbot-redesign-shell">
          {!isMobile && showDesktopSidebar && (
            <aside className="chat-history-sidebar">
              <ConversationHistorySidebar
                activeConversationId={currentConversationId}
                onSelectConversation={handleSelectConversation}
                className="h-full"
                showCloseButton
                onCloseSidebar={() => setShowDesktopSidebar(false)}
              />
            </aside>
          )}

          {isMobile && (
            <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
              <SheetContent side="left" className="p-0 w-[min(88vw,22rem)]" aria-describedby="chat-history-drawer-description">
                <SheetTitle className="sr-only">Conversation history</SheetTitle>
                <SheetDescription id="chat-history-drawer-description" className="sr-only">
                  Browse and switch between previous conversations.
                </SheetDescription>
                <ConversationHistorySidebar
                  activeConversationId={currentConversationId}
                  onSelectConversation={(conversationId) => {
                    void handleSelectConversation(conversationId);
                    setShowMobileSidebar(false);
                  }}
                  className="h-full"
                  showCloseButton={false}
                />
              </SheetContent>
            </Sheet>
          )}

          {mainPanel}
        </div>
      )}

      {showCrisisWarning && (
        <div className="chat-crisis-overlay" role="dialog" aria-modal="true">
          <Card className="chat-crisis-card">
            <CardHeader>
              <CardTitle className="chat-crisis-title">
                <AlertTriangle size={18} />
                We care about your safety
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your message may indicate urgent distress. If you are in immediate danger, call emergency services now.
              </p>

              <div className="space-y-2">
                <Button className="w-full" onClick={() => window.open('tel:988', '_self')}>
                  <Phone size={16} className="mr-2" />
                  Call 988 crisis lifeline
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowCrisisWarning(false);
                    onNavigate('help');
                  }}
                >
                  Open crisis resources
                </Button>
                <Button variant="ghost" className="w-full" onClick={() => setShowCrisisWarning(false)}>
                  Continue conversation
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {currentConversationId && (
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          conversationId={currentConversationId}
          conversationTitle="Current Conversation"
          messageCount={messages.length}
        />
      )}

      <Dialog
        open={feedbackTargetMessageId !== null}
        onOpenChange={(isOpen) => {
          if (isOpen) {
            return;
          }

          if (feedbackTargetMessageId) {
            setMessageFeedback((prev) => ({ ...prev, [feedbackTargetMessageId]: null }));
          }
          setFeedbackTargetMessageId(null);
          setFeedbackNote('');
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Help improve this response</DialogTitle>
            <DialogDescription>
              Tell us what would have made this reply more useful. This is optional.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={feedbackNote}
            onChange={(event) => setFeedbackNote(event.target.value)}
            rows={4}
            maxLength={400}
            placeholder="Example: I needed more actionable steps."
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmittingFeedback}
              onClick={() => {
                if (!feedbackTargetMessageId) {
                  return;
                }
                void submitDislikeFeedback(feedbackTargetMessageId);
              }}
            >
              Skip
            </Button>
            <Button
              type="button"
              disabled={isSubmittingFeedback}
              onClick={() => {
                if (!feedbackTargetMessageId) {
                  return;
                }

                const note = feedbackNote.trim();
                void submitDislikeFeedback(feedbackTargetMessageId, note.length > 0 ? note : undefined);
              }}
            >
              {isSubmittingFeedback ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send feedback'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
