import express, { Request, Response, Router } from 'express';
import { chatbotService } from '../services/chatbotService';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router: Router = express.Router();
const routeLogger = logger.child({ module: 'ChatbotRoutes' });

// Apply authentication middleware to all routes
router.use(authenticate);

/**
 * POST /api/chatbot/conversations/start
 * Start a new chatbot conversation
 */
router.post('/conversations/start', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    
    const conversationId = await chatbotService.startConversation(userId);
    
    routeLogger.info(
      { userId, conversationId },
      'Started new chatbot conversation'
    );
    
    res.status(201).json({
      success: true,
      data: {
        conversationId,
        startedAt: new Date(),
      },
    });
  } catch (error) {
    routeLogger.error({ error, userId: (req as AuthRequest).user?.id }, 'Failed to start conversation');
    res.status(500).json({
      success: false,
      error: 'Failed to start conversation',
    });
  }
});

/**
 * POST /api/chatbot/conversations/:conversationId/messages
 * Add a message to a conversation (increments message count)
 */
router.post('/conversations/:conversationId/messages', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { conversationId } = req.params;
    const { role, content } = req.body;
    
    if (!role || !content) {
      return res.status(400).json({
        success: false,
        error: 'Role and content are required',
      });
    }
    
    if (role !== 'user' && role !== 'assistant') {
      return res.status(400).json({
        success: false,
        error: 'Role must be either "user" or "assistant"',
      });
    }
    
    const conversation = await chatbotService.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }
    
    if (conversation.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to conversation',
      });
    }
    
    await chatbotService.addMessage(conversationId, userId, role, content);
    
    routeLogger.info(
      { userId, conversationId, role },
      'Added message to conversation'
    );
    
    res.status(200).json({
      success: true,
      message: 'Message added successfully',
    });
  } catch (error) {
    routeLogger.error({ error, conversationId: req.params.conversationId }, 'Failed to add message');
    if (error instanceof Error && error.message === 'Unauthorized access to conversation') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to conversation',
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to add message',
    });
  }
});

/**
 * POST /api/chatbot/conversations/:conversationId/end
 * End a conversation and generate AI summary
 */
router.post('/conversations/:conversationId/end', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { conversationId } = req.params;
    
    const conversation = await chatbotService.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }
    
    if (conversation.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to conversation',
      });
    }
    
    await chatbotService.endConversation(conversationId, userId);
    
    routeLogger.info(
      { userId, conversationId },
      'Ended conversation with AI summary'
    );
    
    res.status(200).json({
      success: true,
      message: 'Conversation ended and summary generated',
    });
  } catch (error) {
    routeLogger.error({ error, conversationId: req.params.conversationId }, 'Failed to end conversation');
    if (error instanceof Error && error.message === 'Unauthorized access to conversation') {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to conversation',
      });
    }
    res.status(500).json({
      success: false,
      error: 'Failed to end conversation',
    });
  }
});

/**
 * GET /api/chatbot/conversations
 * Get all conversations for the authenticated user
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { limit = '20' } = req.query;
    
    const conversations = await chatbotService.getUserConversations(
      userId,
      parseInt(limit as string)
    );
    
    routeLogger.info(
      { userId, count: conversations.length },
      'Retrieved user conversations'
    );
    
    res.status(200).json({
      success: true,
      data: conversations,
      pagination: {
        limit: parseInt(limit as string),
        total: conversations.length,
      },
    });
  } catch (error) {
    routeLogger.error({ error, userId: (req as AuthRequest).user?.id }, 'Failed to get conversations');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversations',
    });
  }
});

/**
 * GET /api/chatbot/conversations/:conversationId
 * Get a single conversation by ID
 */
router.get('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { conversationId } = req.params;
    
    const conversation = await chatbotService.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }
    
    // Verify ownership
    if (conversation.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to conversation',
      });
    }
    
    routeLogger.info(
      { userId, conversationId },
      'Retrieved conversation details'
    );
    
    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    routeLogger.error({ error, conversationId: req.params.conversationId }, 'Failed to get conversation');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation',
    });
  }
});

/**
 * GET /api/chatbot/stats
 * Get conversation statistics for the authenticated user
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    
    const stats = await chatbotService.getConversationStats(userId);
    
    routeLogger.info(
      { userId, totalConversations: stats.totalConversations },
      'Retrieved user chatbot statistics'
    );
    
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    routeLogger.error({ error, userId: (req as AuthRequest).user?.id }, 'Failed to get stats');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
    });
  }
});

/**
 * GET /api/chatbot/insights/:conversationId
 * Get insights for a specific conversation
 */
router.get('/insights/:conversationId', async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { conversationId } = req.params;
    
    const conversation = await chatbotService.getConversation(conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }
    
    // Verify ownership
    if (conversation.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Unauthorized access to conversation',
      });
    }
    
    const insights = {
      summary: conversation.summary,
      emotionalState: conversation.emotionalState,
      keyTopics: conversation.keyTopics,
      urgencyLevel: conversation.urgencyLevel,
      messageCount: conversation.messages.length,
      duration: conversation.endedAt 
        ? new Date(conversation.endedAt).getTime() - new Date(conversation.startedAt).getTime()
        : null,
    };
    
    routeLogger.info(
      { userId, conversationId },
      'Retrieved conversation insights'
    );
    
    res.status(200).json({
      success: true,
      data: insights,
    });
  } catch (error) {
    routeLogger.error({ error, conversationId: req.params.conversationId }, 'Failed to get insights');
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve insights',
    });
  }
});

export default router;
