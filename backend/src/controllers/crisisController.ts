import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { createRequestLogger } from '../utils/logger';

const parseArrayInput = (value: unknown): unknown[] => {
	if (Array.isArray(value)) {
		return value;
	}

	if (typeof value === 'string' && value.trim().length > 0) {
		try {
			const parsed = JSON.parse(value);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	return [];
};

const toJsonString = (value: unknown): string => JSON.stringify(parseArrayInput(value));

const getUserId = (req: any): string | null => req.user?.id ?? null;

/**
 * Public crisis resources endpoint.
 * GET /api/crisis/resources
 */
export const getCrisisResources = async (req: Request, res: Response) => {
	const requestId = (req as any).id ?? res.locals.requestId;
	const log = createRequestLogger(requestId).child({
		controller: 'crisis',
		action: 'getResources'
	});

	try {
		const country = typeof req.query.country === 'string' ? req.query.country.trim() : undefined;
		const includeInactive = String(req.query.includeInactive ?? '').toLowerCase() === 'true';

		let mappedCountry: string | undefined = undefined;
		if (country) {
			const normalized = country.toLowerCase().trim();
			if (normalized === 'us' || normalized === 'united states' || normalized === 'north america' || normalized === 'usa') {
				mappedCountry = 'US';
			} else if (normalized === 'in' || normalized === 'india') {
				mappedCountry = 'IN';
			} else if (normalized === 'uk' || normalized === 'united kingdom' || normalized === 'gb' || normalized === 'great britain') {
				mappedCountry = 'UK';
			} else if (normalized === 'ca' || normalized === 'canada') {
				mappedCountry = 'CA';
			} else if (normalized === 'au' || normalized === 'australia') {
				mappedCountry = 'AU';
			} else {
				mappedCountry = 'GLOBAL';
			}
		}

		const resources = await prisma.crisisResource.findMany({
			where: {
				...(mappedCountry ? { country: { in: [mappedCountry, 'GLOBAL'] } } : {}),
				...(includeInactive ? {} : { isActive: true })
			},
			orderBy: [{ order: 'asc' }, { createdAt: 'desc' }]
		});

		res.json({
			success: true,
			data: { resources }
		});
	} catch (error) {
		log.error({ err: error }, 'Failed to fetch crisis resources');
		res.status(500).json({ success: false, error: 'Failed to fetch crisis resources' });
	}
};

/**
 * Create or update safety plan for the authenticated user.
 * POST /api/crisis/safety-plan
 */
export const createOrUpdateSafetyPlan = async (req: any, res: Response) => {
	const requestId = req.id ?? res.locals.requestId;
	const userId = getUserId(req);
	const log = createRequestLogger(requestId).child({
		controller: 'crisis',
		action: 'createOrUpdateSafetyPlan',
		userId
	});

	if (!userId) {
		res.status(401).json({ success: false, error: 'Authentication required' });
		return;
	}

	try {
		const contactsArray = parseArrayInput(req.body?.contactsJson);
		const therapistName = typeof req.body?.therapistName === 'string' ? req.body.therapistName : null;
		const therapistPhone = typeof req.body?.therapistPhone === 'string' ? req.body.therapistPhone : null;
		const psychiatristName = typeof req.body?.psychiatristName === 'string' ? req.body.psychiatristName : null;
		const psychiatristPhone = typeof req.body?.psychiatristPhone === 'string' ? req.body.psychiatristPhone : null;
		const emergencyRoom = typeof req.body?.emergencyRoom === 'string' ? req.body.emergencyRoom : null;
		const crisisLine = typeof req.body?.crisisLine === 'string' ? req.body.crisisLine : '988';

		const safetyPlan = await prisma.safetyPlan.upsert({
			where: { userId },
			create: {
				userId,
				warningSignsJson: toJsonString(req.body?.warningSignsJson),
				copingStrategiesJson: toJsonString(req.body?.copingStrategiesJson),
				contactsJson: JSON.stringify(contactsArray),
				therapistName,
				therapistPhone,
				psychiatristName,
				psychiatristPhone,
				emergencyRoom,
				crisisLine,
				safeEnvironmentJson: toJsonString(req.body?.safeEnvironmentJson),
				reasonsToLiveJson: toJsonString(req.body?.reasonsToLiveJson)
			},
			update: {
				warningSignsJson: toJsonString(req.body?.warningSignsJson),
				copingStrategiesJson: toJsonString(req.body?.copingStrategiesJson),
				contactsJson: JSON.stringify(contactsArray),
				therapistName,
				therapistPhone,
				psychiatristName,
				psychiatristPhone,
				emergencyRoom,
				crisisLine,
				safeEnvironmentJson: toJsonString(req.body?.safeEnvironmentJson),
				reasonsToLiveJson: toJsonString(req.body?.reasonsToLiveJson)
			}
		});

		res.json({
			success: true,
			data: { safetyPlan },
			message: 'Safety plan saved successfully'
		});
	} catch (error) {
		log.error({ err: error }, 'Failed to save safety plan');
		res.status(500).json({ success: false, error: 'Failed to save safety plan' });
	}
};

/**
 * Get safety plan for authenticated user.
 * GET /api/crisis/safety-plan
 */
export const getSafetyPlan = async (req: any, res: Response) => {
	const requestId = req.id ?? res.locals.requestId;
	const userId = getUserId(req);
	const log = createRequestLogger(requestId).child({
		controller: 'crisis',
		action: 'getSafetyPlan',
		userId
	});

	if (!userId) {
		res.status(401).json({ success: false, error: 'Authentication required' });
		return;
	}

	try {
		const safetyPlan = await prisma.safetyPlan.findUnique({
			where: { userId }
		});

		if (!safetyPlan) {
			res.status(404).json({ success: false, error: 'Safety plan not found' });
			return;
		}

		res.json({
			success: true,
			data: { safetyPlan }
		});
	} catch (error) {
		log.error({ err: error }, 'Failed to fetch safety plan');
		res.status(500).json({ success: false, error: 'Failed to fetch safety plan' });
	}
};

/**
 * Delete safety plan for authenticated user.
 * DELETE /api/crisis/safety-plan
 */
export const deleteSafetyPlan = async (req: any, res: Response) => {
	const requestId = req.id ?? res.locals.requestId;
	const userId = getUserId(req);
	const log = createRequestLogger(requestId).child({
		controller: 'crisis',
		action: 'deleteSafetyPlan',
		userId
	});

	if (!userId) {
		res.status(401).json({ success: false, error: 'Authentication required' });
		return;
	}

	try {
		await prisma.safetyPlan.deleteMany({ where: { userId } });

		res.json({
			success: true,
			message: 'Safety plan deleted successfully'
		});
	} catch (error) {
		log.error({ err: error }, 'Failed to delete safety plan');
		res.status(500).json({ success: false, error: 'Failed to delete safety plan' });
	}
};

/**
 * Get unresolved recent crisis events requiring follow-up.
 * GET /api/crisis/recent-events
 */
export const getRecentCrisisEvents = async (req: any, res: Response) => {
	const requestId = req.id ?? res.locals.requestId;
	const userId = getUserId(req);
	const log = createRequestLogger(requestId).child({
		controller: 'crisis',
		action: 'getRecentCrisisEvents',
		userId
	});

	if (!userId) {
		res.status(401).json({ success: false, error: 'Authentication required' });
		return;
	}

	try {
		const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
		const events = await prisma.crisisEvent.findMany({
			where: {
				userId,
				detectedAt: { gte: since },
				resolved: false,
				followUpResponse: null
			},
			orderBy: { detectedAt: 'desc' },
			take: 5
		});

		res.json({
			success: true,
			data: events
		});
	} catch (error) {
		log.error({ err: error }, 'Failed to fetch recent crisis events');
		res.status(500).json({ success: false, error: 'Failed to fetch recent crisis events' });
	}
};

/**
 * Save follow-up response for a crisis event.
 * POST /api/crisis/follow-up
 */
export const submitCrisisFollowUp = async (req: any, res: Response) => {
	const requestId = req.id ?? res.locals.requestId;
	const userId = getUserId(req);
	const log = createRequestLogger(requestId).child({
		controller: 'crisis',
		action: 'submitCrisisFollowUp',
		userId
	});

	if (!userId) {
		res.status(401).json({ success: false, error: 'Authentication required' });
		return;
	}

	try {
		const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId : '';
		const response = req.body?.response as 'better' | 'same' | 'struggling' | undefined;

		if (!eventId || !response || !['better', 'same', 'struggling'].includes(response)) {
			res.status(400).json({ success: false, error: 'Invalid follow-up payload' });
			return;
		}

		const existingEvent = await prisma.crisisEvent.findFirst({
			where: {
				id: eventId,
				userId
			}
		});

		if (!existingEvent) {
			res.status(404).json({ success: false, error: 'Crisis event not found' });
			return;
		}

		const updatedEvent = await prisma.crisisEvent.update({
			where: { id: eventId },
			data: {
				followUpResponse: response,
				resolved: response === 'better' ? true : existingEvent.resolved,
				resolvedAt: response === 'better' ? new Date() : existingEvent.resolvedAt
			}
		});

		res.json({
			success: true,
			data: updatedEvent,
			message: 'Follow-up saved'
		});
	} catch (error) {
		log.error({ err: error }, 'Failed to save crisis follow-up');
		res.status(500).json({ success: false, error: 'Failed to save follow-up response' });
	}
};
