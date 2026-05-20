import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Joi from 'joi';
import { prisma } from '../config/database';
import { 
  AppError,
  NotFoundError, 
  ConflictError, 
  UnauthorizedError,
  DatabaseError,
  BadRequestError
} from '../shared/errors/AppError';

// Validation schemas
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const securityQuestionSchema = Joi.object({
  question: Joi.string().min(5).max(200).required(),
  answer: Joi.string().min(2).max(200).required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordWithSecuritySchema = Joi.object({
  email: Joi.string().email().required(),
  answer: Joi.string().min(2).max(200).required(),
  newPassword: Joi.string().min(6).required(),
});

const selfResetPasswordSchema = Joi.object({
  answer: Joi.string().min(2).max(200).required(),
  newPassword: Joi.string().min(6).required(),
});

const updateSecurityQuestionWithPasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  question: Joi.string().min(5).max(200).required(),
  answer: Joi.string().min(2).max(200).required(),
});

const updateApproachWithPasswordSchema = Joi.object({
  password: Joi.string().required(),
  approach: Joi.string().valid('western', 'eastern', 'hybrid').required(),
});

const normalizeSecurityAnswer = (answer: string): string => answer.trim().toLowerCase();
const getFrontendBaseUrl = (): string => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');

const isAllowedFrontendOrigin = (origin: string): boolean => {
  const normalizedOrigin = origin.replace(/\/+$/, '');
  const configuredFrontendUrl = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

  if (configuredFrontendUrl && normalizedOrigin === configuredFrontendUrl) {
    return true;
  }

  try {
    const parsed = new URL(normalizedOrigin);
    const protocol = parsed.protocol.toLowerCase();
    const hostname = parsed.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return protocol === 'http:' || protocol === 'https:';
    }

    if (protocol !== 'https:') {
      return false;
    }

    return hostname.endsWith('.vercel.app') || hostname === 'maansarathi.app';
  } catch {
    return false;
  }
};

const getOAuthOriginFromState = (req: Request): string | null => {
  const rawState = typeof req.query.state === 'string' ? req.query.state : '';
  if (!rawState) return null;

  try {
    const decoded = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8')) as {
      platform?: string;
      frontendOrigin?: string;
    };

    if (decoded.platform !== 'web') {
      return null;
    }

    if (typeof decoded.frontendOrigin === 'string' && isAllowedFrontendOrigin(decoded.frontendOrigin)) {
      return decoded.frontendOrigin.replace(/\/+$/, '');
    }
  } catch {
    return null;
  }

  return null;
};

const getOAuthFrontendBaseUrl = (req: Request): string => {
  const stateOrigin = getOAuthOriginFromState(req);
  if (stateOrigin) {
    return stateOrigin;
  }

  const sessionOrigin = (req.session as any)?.oauthWebOrigin;
  if (typeof sessionOrigin === 'string' && isAllowedFrontendOrigin(sessionOrigin)) {
    return sessionOrigin.replace(/\/+$/, '');
  }
  return getFrontendBaseUrl();
};

// Generate JWT token
const generateToken = (userId: string): string => {
  // Use provided secret or safe fallback for development to prevent silent flow break
  const secret = process.env.JWT_SECRET || 'dev-fallback-secret';
  return jwt.sign(
    { id: userId },
    secret as jwt.Secret,
    { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
  );
};

// Google OAuth Success callback
export const googleAuthSuccess = async (req: Request, res: Response) => {
  try {
    const frontendBaseUrl = getOAuthFrontendBaseUrl(req);
    if ((req.session as any)?.oauthWebOrigin) {
      delete (req.session as any).oauthWebOrigin;
    }
    if (!req.user) {
      return res.redirect(`${frontendBaseUrl}/auth/callback?error=oauth_failed`);
    }

    const user = req.user as any;
    const token = generateToken(user.id);

    // Detect if this user was just created in passport strategy
    const justCreated = user.justCreated;

    // Determine redirect:
    // Existing user (has password OR already onboarded) -> dashboard
    // Newly created Google user with no password -> setup-password
    // After password but not onboarded -> onboarding
    let redirectParam = 'dashboard';
    let needsSetup = false;

    if (justCreated && !user.password) {
      redirectParam = 'setup-password';
      needsSetup = true;
    } else if (!user.isOnboarded) {
      // Only prompt onboarding if not a fully onboarded existing account
      redirectParam = 'onboarding';
      needsSetup = true;
    }

    // Create comprehensive user data object for frontend
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      profilePhoto: user.profilePhoto,
      isOnboarded: user.isOnboarded,
  hasPassword: !!user.password,
    justCreated, // Include justCreated in user data
      approach: user.approach,
      birthday: user.birthday,
      gender: user.gender,
      region: user.region,
      language: user.language
    };

    // Redirect to frontend OAuth callback with token and comprehensive user data
    const userDataEncoded = encodeURIComponent(JSON.stringify(userData));
    res.redirect(`${frontendBaseUrl}/auth/callback?token=${token}&redirect=${redirectParam}&needs_setup=${needsSetup}&user_data=${userDataEncoded}`);
  } catch (error) {
    console.error('Google OAuth success error:', error);
    res.redirect(`${getFrontendBaseUrl()}/auth/callback?error=oauth_error`);
  }
};

// Google OAuth Failure callback
export const googleAuthFailure = (req: Request, res: Response) => {
  const frontendBaseUrl = getOAuthFrontendBaseUrl(req);
  if ((req.session as any)?.oauthWebOrigin) {
    delete (req.session as any).oauthWebOrigin;
  }
  res.redirect(`${frontendBaseUrl}/auth/callback?error=oauth_cancelled`);
};

// Stateless logout (client simply discards token; endpoint provided for future blacklisting/session tracking)
export const logout = async (_req: Request, res: Response) => {
  try {
    // For JWT stateless auth, just respond success. Could add token blacklist storage here.
    res.json({ success: true, data: { message: 'Logged out' } });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
};

// Register user
export const register = async (req: Request, res: Response) => {
  try {
    // Validate request
    const { error } = registerSchema.validate(req.body);
    if (error) {
      throw new BadRequestError(error.details[0].message);
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('User already exists with this email');
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const createdUser = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
      }
    });

    const { password: _createdPassword, securityAnswerHash: _createdAnswerHash, ...user } = createdUser as any;

    // Generate token
    const token = generateToken(user.id);

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    // Re-throw AppError instances to be handled by error middleware
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Registration error:', error);
    throw new DatabaseError('Server error during registration');
  }
};

// Login user
export const login = async (req: Request, res: Response) => {
  try {
    // Validate request
    const { error } = loginSchema.validate(req.body);
    if (error) {
      throw new BadRequestError(error.details[0].message);
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check password
    if (!user.password) {
      throw new UnauthorizedError('Invalid credentials');
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate token
    const token = generateToken(user.id);

    // Return user data (excluding sensitive fields)
    const { password: userPassword, securityAnswerHash, ...userWithoutSensitive } = user as any;

    res.json({
      success: true,
      data: {
        user: userWithoutSensitive,
        token,
      },
    });
  } catch (error) {
    // Re-throw AppError instances to be handled by error middleware
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Login error:', error);
    throw new DatabaseError('Server error during login');
  }
};

// Get current user
export const getCurrentUser = async (req: any, res: Response) => {
  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: req.user.id }
    });

    if (!userRecord) {
      throw new NotFoundError('User');
    }

    const { password: _password, securityAnswerHash: _answerHash, ...user } = userRecord as any;

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    // Re-throw AppError instances to be handled by error middleware
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Get current user error:', error);
    throw new DatabaseError('Server error');
  }
};

// Validate JWT token
export const validateToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    const userRecord = await prisma.user.findUnique({
      where: { id: decoded.id }
    });

    if (!userRecord) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const { password, securityAnswerHash, ...safeUser } = userRecord as any;
    (safeUser as any).hasPassword = !!password;
    res.json(safeUser);
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Setup password for OAuth users
export const setupPassword = async (req: any, res: Response) => {
  try {
    console.log('Setup password request received');
    console.log('Request body:', req.body);
    console.log('User from auth middleware:', req.user);
    
    const { password } = req.body;
    
    if (!password || password.length < 6) {
      console.log('Password validation failed:', { password: password ? 'provided' : 'missing', length: password?.length });
      res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long',
      });
      return;
    }

    if (!req.user || !req.user.id) {
      console.log('User not found in request:', req.user);
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    // Hash password
    console.log('Hashing password for user:', req.user.id);
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update user with password
    console.log('Updating user password in database');
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    });

    const { password: _password, securityAnswerHash: _answerHash, ...user } = updatedUser as any;

    console.log('Password setup successful for user:', user.id);
    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Setup password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during password setup',
    });
  }
};

// Save or update a user's security question and answer
export const setSecurityQuestion = async (req: any, res: Response) => {
  try {
    const { error } = securityQuestionSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, error: error.details[0].message });
      return;
    }

    if (!req.user?.id) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const question = (req.body.question as string).trim();
    const normalizedAnswer = normalizeSecurityAnswer(req.body.answer as string);
    const hashedAnswer = await bcrypt.genSalt(12).then((salt) => bcrypt.hash(normalizedAnswer, salt));

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        securityQuestion: question,
        securityAnswerHash: hashedAnswer,
      } as any
    });

    const { password: _password, securityAnswerHash: _answerHash, ...user } = updatedUser as any;

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Set security question error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while saving security question',
    });
  }
};

// Provide a user's security question during forgot password flow
export const getSecurityQuestionForReset = async (req: Request, res: Response) => {
  try {
    const { error } = forgotPasswordSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, error: error.details[0].message });
      return;
    }

    const { email } = req.body;
    const userRecord = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    const user = userRecord as any;

    if (!user || !user.securityQuestion || !user.securityAnswerHash) {
      res.json({ success: true, data: { questionAvailable: false } });
      return;
    }

    res.json({
      success: true,
      data: {
        questionAvailable: true,
        question: user.securityQuestion,
      }
    });
  } catch (error) {
    console.error('Get security question error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error retrieving security question',
    });
  }
};

// Reset password after verifying security question answer
export const resetPasswordWithSecurityAnswer = async (req: Request, res: Response) => {
  try {
    const { error } = resetPasswordWithSecuritySchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, error: error.details[0].message });
      return;
    }

    const { email, answer, newPassword } = req.body as { email: string; answer: string; newPassword: string };

    const userRecord = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    const user = userRecord as any;

    if (!user || !user.securityAnswerHash) {
      res.status(400).json({ success: false, error: 'Security verification failed' });
      return;
    }

    const normalizedAnswer = normalizeSecurityAnswer(answer);
    const isValidAnswer = await bcrypt.compare(normalizedAnswer, user.securityAnswerHash);

    if (!isValidAnswer) {
      res.status(400).json({ success: false, error: 'Security verification failed' });
      return;
    }

    const hashedPassword = await bcrypt.genSalt(12).then((salt) => bcrypt.hash(newPassword, salt));

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      data: { message: 'Password reset successful' },
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during password reset',
    });
  }
};

// Reset password from profile (authenticated) using stored security answer
export const resetPasswordWithSecurityAnswerAuthenticated = async (req: any, res: Response) => {
  try {
    const { error } = selfResetPasswordSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, error: error.details[0].message });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const { answer, newPassword } = req.body as { answer: string; newPassword: string };

    const userRecord = await prisma.user.findUnique({ where: { id: userId } });
    const user = userRecord as any;

    if (!user || !user.securityAnswerHash) {
      res.status(400).json({ success: false, error: 'Security question not set' });
      return;
    }

    const normalizedAnswer = normalizeSecurityAnswer(answer);
    const isValidAnswer = await bcrypt.compare(normalizedAnswer, user.securityAnswerHash);

    if (!isValidAnswer) {
      res.status(400).json({ success: false, error: 'Security verification failed' });
      return;
    }

    const hashedPassword = await bcrypt.genSalt(12).then((salt) => bcrypt.hash(newPassword, salt));

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      data: { message: 'Password updated successfully' },
    });
  } catch (error) {
    console.error('Authenticated password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during password update',
    });
  }
};

// Update security question after verifying password
export const updateSecurityQuestionWithPassword = async (req: any, res: Response) => {
  try {
    const { error } = updateSecurityQuestionWithPasswordSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, error: error.details[0].message });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const { currentPassword, question, answer } = req.body as { currentPassword: string; question: string; answer: string };

    const userRecord = await prisma.user.findUnique({ where: { id: userId } });
    const user = userRecord as any;

    if (!user || !user.password) {
      res.status(400).json({ success: false, error: 'Password not set for this account' });
      return;
    }

    const passwordValid = await bcrypt.compare(currentPassword, user.password);
    if (!passwordValid) {
      res.status(400).json({ success: false, error: 'Incorrect password' });
      return;
    }

    const normalizedAnswer = normalizeSecurityAnswer(answer);
    const hashedAnswer = await bcrypt.genSalt(12).then((salt) => bcrypt.hash(normalizedAnswer, salt));

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        securityQuestion: question.trim(),
        securityAnswerHash: hashedAnswer,
      },
    });

    const { password: _password, securityAnswerHash: _answerHash, ...safeUser } = updatedUser as any;

    res.json({
      success: true,
      data: { user: safeUser },
    });
  } catch (error) {
    console.error('Update security question with password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating security question',
    });
  }
};

// Update approach after verifying password
export const updateApproachWithPassword = async (req: any, res: Response) => {
  try {
    const { error } = updateApproachWithPasswordSchema.validate(req.body);
    if (error) {
      res.status(400).json({ success: false, error: error.details[0].message });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const { password, approach } = req.body as { password: string; approach: 'western' | 'eastern' | 'hybrid' };

    const userRecord = await prisma.user.findUnique({ where: { id: userId } });
    const user = userRecord as any;

    if (!user || !user.password) {
      res.status(400).json({ success: false, error: 'Password not set for this account' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      res.status(400).json({ success: false, error: 'Incorrect password' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { approach },
      select: {
        id: true,
        name: true,
        firstName: true,
        lastName: true,
        email: true,
        approach: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error('Update approach with password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating approach',
    });
  }
};

// Update user profile during onboarding
export const updateProfile = async (req: any, res: Response) => {
  try {
    const {
      birthday,
      gender,
      region,
      language,
      emergencyContact,
      emergencyPhone,
      approach,
  firstName,
  lastName,
      isOnboarded
    } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(birthday && { 
          birthday: (() => {
            let b: any = birthday;
            if (typeof b === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(b)) {
              const [dd, mm, yyyy] = b.split('-');
              b = `${yyyy}-${mm}-${dd}`;
            }
            const d = new Date(b);
            return isNaN(d.getTime()) ? undefined : d;
          })()
        }),
        ...(gender && { gender }),
        ...(region && { region }),
        ...(language && { language }),
        ...(emergencyContact && { emergencyContact }),
        ...(emergencyPhone && { emergencyPhone }),
        ...(approach && { approach }),
  ...(firstName && { firstName }),
  ...(lastName && { lastName }),
        ...(isOnboarded !== undefined && { isOnboarded }),
      },
    });

    const { password: _password, securityAnswerHash: _answerHash, ...user } = updatedUser as any;

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during profile update',
    });
  }
};
