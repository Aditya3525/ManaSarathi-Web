import { Response } from 'express';
import Joi from 'joi';
import { prisma } from '../config/database';
import { 
  AppError,
  NotFoundError, 
  BadRequestError,
  ForbiddenError,
  UnauthorizedError,
  DatabaseError 
} from '../shared/errors/AppError';
import { AuthRequest } from '../middleware/auth';

// Dynamic age range (10-100 years)
const now = new Date();
const minBirthday = new Date(now.getFullYear() - 100, now.getMonth(), now.getDate()); // oldest allowed
const maxBirthday = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());  // youngest allowed

// Common birthday validator message
const birthdayField = Joi.date()
  .min(minBirthday)
  .max(maxBirthday)
  .optional()
  .messages({
    'date.min': 'Birthday indicates age over 100 - please enter a valid date',
    'date.max': 'You must be at least 10 years old to use this app',
  });

// Validation schemas
const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(50).optional(),
  firstName: Joi.string().min(1).max(50).optional(),
  lastName: Joi.string().min(1).max(50).optional(),
  approach: Joi.string().valid('western', 'eastern', 'hybrid').optional(),
  birthday: birthdayField,
  gender: Joi.string().optional(),
  region: Joi.string().optional(),
  language: Joi.string().optional(),
  emergencyContact: Joi.string().optional(),
  emergencyPhone: Joi.string().optional(),
  dataConsent: Joi.boolean().optional(),
  clinicianSharing: Joi.boolean().optional(),
  isPremium: Joi.boolean().optional(),
});

const onboardingSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required(),
  lastName: Joi.string().min(1).max(50).optional(),
  birthday: birthdayField,
  gender: Joi.string().optional(),
  region: Joi.string().optional(),
  language: Joi.string().optional(),
  emergencyContact: Joi.string().optional(),
  emergencyPhone: Joi.string().optional(),
  dataConsent: Joi.boolean().optional(),
  clinicianSharing: Joi.boolean().optional(),
  approach: Joi.string().valid('western', 'eastern', 'hybrid').required(),
});

const moodSchema = Joi.object({
  mood: Joi.string().trim().max(50).optional(),
  emotion: Joi.string().trim().max(50).optional(),
  emotionGroup: Joi.string().trim().max(50).optional(),
  intensity: Joi.number().integer().min(1).max(10).optional(),
  trigger: Joi.string().trim().max(250).optional(),
  notes: Joi.string().trim().max(500).optional(),
}).or('mood', 'emotion');

const LEGACY_MOOD_BY_GROUP: Record<string, string> = {
  joy: 'Great',
  surprise: 'Good',
  fear: 'Anxious',
  anger: 'Struggling',
  sadness: 'Struggling',
  disgust: 'Okay'
};

const LEGACY_MOOD_BY_EMOTION: Record<string, string> = {
  anxious: 'Anxious',
  nervous: 'Anxious',
  worried: 'Anxious',
  overwhelmed: 'Struggling',
  insecure: 'Struggling',
  hopeless: 'Struggling',
  lonely: 'Struggling',
  grieving: 'Struggling',
  frustrated: 'Struggling',
  irritated: 'Struggling',
  resentful: 'Struggling',
  jealous: 'Struggling',
  calm: 'Good',
  grateful: 'Great',
  excited: 'Great',
  happy: 'Great',
  proud: 'Great'
};

const normalizeLegacyMood = (
  mood: unknown,
  emotionGroup: unknown,
  emotion: unknown
): string | null => {
  if (typeof mood === 'string' && mood.trim().length > 0) {
    return mood.trim();
  }

  const normalizedGroup = typeof emotionGroup === 'string' ? emotionGroup.trim().toLowerCase() : '';
  if (normalizedGroup && LEGACY_MOOD_BY_GROUP[normalizedGroup]) {
    return LEGACY_MOOD_BY_GROUP[normalizedGroup];
  }

  const normalizedEmotion = typeof emotion === 'string' ? emotion.trim().toLowerCase() : '';
  if (normalizedEmotion && LEGACY_MOOD_BY_EMOTION[normalizedEmotion]) {
    return LEGACY_MOOD_BY_EMOTION[normalizedEmotion];
  }

  return null;
};

// Get user profile
export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Ensure user can only access their own profile (security check)
    if (userId !== req.user?.id) {
      res.status(403).json({
        success: false,
        error: 'Unauthorized to access this profile',
      });
      return;
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        profilePhoto: true,
        isOnboarded: true,
        approach: true,
        birthday: true,
        gender: true,
        region: true,
        emergencyContact: true,
        emergencyPhone: true,
        dataConsent: true,
        clinicianSharing: true,
        isPremium: true,
        createdAt: true,
        updatedAt: true,
        // Exclude sensitive fields like password hash
      },
    });
    
    if (!user) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }
    
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
    });
  }
};

// Update user profile
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { error } = updateProfileSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
      return;
    }

    const userId = req.params.userId;
    
    // Ensure user can only update their own profile
    if (userId !== req.user?.id) {
      res.status(403).json({
        success: false,
        error: 'Not authorized to update this profile',
      });
      return;
    }

    const updates = req.body;
    // Normalize birthday if provided as string (e.g. '2006-05-03' or '03-05-2006')
    if (updates.birthday) {
      try {
        let dateInput = updates.birthday;
        if (typeof dateInput === 'string') {
          if (/^\d{2}-\d{2}-\d{4}$/.test(dateInput)) {
            const [dd, mm, yyyy] = dateInput.split('-');
            dateInput = `${yyyy}-${mm}-${dd}`;
          }
          const d = new Date(dateInput);
          if (!isNaN(d.getTime())) {
            const age = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
            if (age < 10 || age > 100) {
              res.status(400).json({ success: false, error: 'Birthday must indicate age between 10 and 100 years' });
              return; // ensure early exit
            }
            updates.birthday = d;
          } else {
            delete updates.birthday;
          }
        }
      } catch {
        delete updates.birthday;
      }
    }
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: {
        id: true,
        name: true,
    firstName: true,
    lastName: true,
        email: true,
        isOnboarded: true,
        approach: true,
        birthday: true,
        gender: true,
        region: true,
        language: true,
        emergencyContact: true,
        emergencyPhone: true,
        dataConsent: true,
        clinicianSharing: true,
        isPremium: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// Complete onboarding
export const completeOnboarding = async (req: AuthRequest, res: Response) => {
  try {
    const { error } = onboardingSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
      return;
    }

    const { 
      approach,
      firstName,
      lastName,
      birthday,
      gender,
      region,
      language,
      emergencyContact,
      emergencyPhone,
      dataConsent,
      clinicianSharing,
    } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true }
    });

    if (!userRecord) {
      res.status(404).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    if (!userRecord.password) {
      res.status(403).json({
        success: false,
        error: 'Please set up a password before completing onboarding.',
      });
      return;
    }

    // Prepare update data
    const updateData: any = {
      isOnboarded: true,
      approach,
    };

    // Add optional fields if provided
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (firstName && lastName) {
      updateData.name = `${firstName} ${lastName}`.trim();
    } else if (firstName) {
      updateData.name = firstName;
    } else if (lastName) {
      updateData.name = lastName;
    }
    if (birthday) {
      const d = new Date(birthday);
      if (!isNaN(d.getTime())) {
        const age = now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
        if (age < 10 || age > 100) {
          res.status(400).json({ success: false, error: 'Birthday must indicate age between 10 and 100 years' });
          return;
        }
        updateData.birthday = d;
      }
    }
    if (gender) updateData.gender = gender;
    if (region) updateData.region = region;
    if (language) updateData.language = language;
    if (emergencyContact) updateData.emergencyContact = emergencyContact;
    if (emergencyPhone) updateData.emergencyPhone = emergencyPhone;
    if (typeof dataConsent === 'boolean') updateData.dataConsent = dataConsent;
    if (typeof clinicianSharing === 'boolean') updateData.clinicianSharing = clinicianSharing;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        name: true,
  firstName: true,
  lastName: true,
        email: true,
        isOnboarded: true,
        approach: true,
        birthday: true,
        gender: true,
        region: true,
        language: true,
        emergencyContact: true,
        emergencyPhone: true,
        dataConsent: true,
        clinicianSharing: true,
        isPremium: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// Log mood entry
export const logMood = async (req: AuthRequest, res: Response) => {
  try {
    const { error } = moodSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: error.details[0].message,
      });
      return;
    }

    const { mood, emotion, emotionGroup, intensity, trigger, notes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const resolvedMood = normalizeLegacyMood(mood, emotionGroup, emotion);
    if (!resolvedMood) {
      res.status(400).json({
        success: false,
        error: 'Mood is required (directly or derived from emotion/emotionGroup)',
      });
      return;
    }

    const moodEntry = await prisma.moodEntry.create({
      data: {
        userId,
        mood: resolvedMood,
        emotion: typeof emotion === 'string' ? emotion.trim().toLowerCase() : null,
        emotionGroup: typeof emotionGroup === 'string' ? emotionGroup.trim().toLowerCase() : null,
        intensity: typeof intensity === 'number' ? Math.max(1, Math.min(10, Math.round(intensity))) : null,
        trigger: typeof trigger === 'string' && trigger.trim().length > 0 ? trigger.trim() : null,
        notes: typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : null,
      },
    });

    res.json({
      success: true,
      data: { moodEntry },
    });
  } catch (error) {
    console.error('Log mood error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};

// Get mood history
export const getMoodHistory = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
      });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 30;
    const offset = parseInt(req.query.offset as string) || 0;

    const moodEntries = await prisma.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    res.json({
      success: true,
      data: { moodEntries },
    });
  } catch (error) {
    console.error('Get mood history error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
};
