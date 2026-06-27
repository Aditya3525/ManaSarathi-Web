import express from 'express';
import { authenticate } from '../middleware/auth';
import {
	listAssessments,
	getAvailableAssessments,
	getAssessmentTemplates,
	submitAssessment,
	getAssessmentHistory,
	getAssessmentReminder,
	startAssessmentSession,
	getActiveAssessmentSession,
	getAssessmentSessionById,
	updateAssessmentSessionStatus,
	submitCombinedAssessments,
	getOverallAssessmentOptions
} from '../controllers/assessmentsController';
import { validate } from '../middleware/validate';
import {
	submitAssessmentSchema,
	startAssessmentSessionSchema,
	updateAssessmentSessionSchema,
	getAssessmentHistorySchema,
	getAssessmentTemplatesSchema,
} from '../api/validators';

const router = express.Router();

router.use(authenticate as any);
router.get('/', listAssessments as any);
router.get('/available', getAvailableAssessments as any);
router.get('/overall-options', getOverallAssessmentOptions as any);
router.get('/templates', validate(getAssessmentTemplatesSchema), getAssessmentTemplates as any);
router.post('/', validate(submitAssessmentSchema), submitAssessment as any);
router.post('/submit-combined', submitCombinedAssessments as any);
router.get('/history', validate(getAssessmentHistorySchema), getAssessmentHistory as any);
router.get('/reminder', getAssessmentReminder as any);
router.post('/sessions', validate(startAssessmentSessionSchema), startAssessmentSession as any);
router.get('/sessions/active', getActiveAssessmentSession as any);
router.get('/sessions/:sessionId', getAssessmentSessionById as any);
router.patch('/sessions/:sessionId', validate(updateAssessmentSessionSchema), updateAssessmentSessionStatus as any);

export default router;
