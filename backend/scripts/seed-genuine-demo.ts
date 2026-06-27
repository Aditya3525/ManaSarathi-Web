import path from 'path';
import dotenv from 'dotenv';
import {
  ContentType,
  DifficultyLevel,
  PracticeCategory,
  Prisma,
  PrismaClient,
  TherapistCredential
} from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const databaseUrl = (process.env.DATABASE_URL || '').trim();
if (databaseUrl.startsWith('file:')) {
  const rawPath = databaseUrl.slice('file:'.length);
  if (rawPath.startsWith('./') || rawPath.startsWith('../')) {
    process.env.DATABASE_URL = `file:${path.resolve(__dirname, '..', rawPath).replace(/\\/g, '/')}`;
  }
}

const prisma = new PrismaClient();

const json = (value: unknown) => JSON.stringify(value);

const SOURCE_NOTE =
  'Seeded by seed-genuine-demo.ts. Public educational resources are source-attributed. Therapist profiles are synthetic demo records.';

const practices: Array<Prisma.PracticeUncheckedCreateInput> = [
  {
    id: 'practice-nhs-calming-breathing',
    title: 'Calming Breathing for Stress',
    type: 'breathing',
    category: PracticeCategory.BREATHING,
    duration: 5,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    approach: 'Western',
    format: 'Text',
    description: 'A short breath regulation practice for stress, anxiety, or panic that can be done anywhere.',
    instructions: json([
      'Sit or stand comfortably with both feet supported.',
      'Breathe in gently through the nose and out slowly through the mouth.',
      'Keep the shoulders relaxed and let the belly soften on each exhale.',
      'Continue for three to five minutes, pausing if you feel dizzy.'
    ]),
    benefits: 'Supports quick down-regulation during everyday stress and mild panic.',
    precautions: 'Stop if dizziness, breathlessness, chest pain, or distress increases.',
    focusAreas: json(['anxiety', 'stress', 'panic', 'grounding']),
    immediateRelief: true,
    crisisEligible: true,
    requiredEquipment: json([]),
    environment: json(['home', 'work', 'public']),
    timeOfDay: json(['morning', 'afternoon', 'evening', 'night']),
    sensoryEngagement: json(['breath', 'body']),
    tags: 'breathing,stress,anxiety,panic,nhs',
    isPublished: true,
    sourceName: 'NHS',
    sourceUrl: 'https://www.nhs.uk/conditions/stress-anxiety-depression/ways-relieve-stress/',
    confidence: 0.95,
    notes: SOURCE_NOTE
  },
  {
    id: 'practice-who-grounding-stress',
    title: 'Grounding During Stress',
    type: 'grounding_exercise',
    category: PracticeCategory.GROUNDING_EXERCISE,
    duration: 4,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    approach: 'Hybrid',
    format: 'Text',
    description: 'A brief present-moment grounding exercise adapted for high-stress moments.',
    instructions: json([
      'Notice five things you can see.',
      'Notice four things you can feel through touch.',
      'Notice three sounds around you.',
      'Take one slow breath and name one small helpful action.'
    ]),
    benefits: 'Helps attention return to the present when stress feels overwhelming.',
    precautions: 'Use crisis resources or emergency services if there is immediate danger.',
    focusAreas: json(['stress', 'overwhelm', 'grounding', 'crisis-support']),
    immediateRelief: true,
    crisisEligible: true,
    requiredEquipment: json([]),
    environment: json(['home', 'work', 'public']),
    timeOfDay: json(['morning', 'afternoon', 'evening', 'night']),
    sensoryEngagement: json(['sight', 'touch', 'sound', 'breath']),
    tags: 'grounding,stress,who,present-moment',
    isPublished: true,
    sourceName: 'World Health Organization',
    sourceUrl: 'https://www.who.int/news-room/questions-and-answers/item/stress',
    confidence: 0.95,
    notes: SOURCE_NOTE
  },
  {
    id: 'practice-ucla-body-scan',
    title: 'Body Scan Meditation',
    type: 'body_scan',
    category: PracticeCategory.MINDFULNESS,
    duration: 14,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    approach: 'Hybrid',
    format: 'Audio',
    description: 'A guided body awareness practice for noticing sensations with less judgment.',
    audioUrl: 'http://sites.duke.edu/introaudiodocfall2015/files/2015/11/Alex_Meditation.mp3',
    focusAreas: json(['mindfulness', 'stress', 'body-awareness', 'sleep']),
    immediateRelief: false,
    crisisEligible: false,
    requiredEquipment: json([]),
    environment: json(['home']),
    timeOfDay: json(['evening', 'night']),
    sensoryEngagement: json(['body', 'sound']),
    tags: 'body-scan,mindfulness,ucla,audio',
    isPublished: true,
    sourceName: 'UCLA Mindful',
    sourceUrl: 'https://www.uclahealth.org/uclamindful/health-and-wellness-meditations',
    confidence: 0.95,
    notes: SOURCE_NOTE
  },
  {
    id: 'practice-ucla-loving-kindness',
    title: 'Loving Kindness Meditation',
    type: 'meditation',
    category: PracticeCategory.MEDITATION,
    duration: 11,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    approach: 'Eastern',
    format: 'Audio',
    description: 'A compassion-focused meditation using kind phrases toward self and others.',
    audioUrl: 'https://prevention.psu.edu/wp-content/uploads/2022/12/Loving-Kindness-Practice-with-Elaine.mp3',
    focusAreas: json(['self-compassion', 'relationships', 'low-mood']),
    immediateRelief: false,
    crisisEligible: false,
    requiredEquipment: json([]),
    environment: json(['home']),
    timeOfDay: json(['morning', 'evening']),
    sensoryEngagement: json(['sound', 'emotion']),
    tags: 'loving-kindness,metta,self-compassion,ucla',
    isPublished: true,
    sourceName: 'UCLA Mindful',
    sourceUrl: 'https://www.uclahealth.org/uclamindful/health-and-wellness-meditations',
    confidence: 0.95,
    notes: SOURCE_NOTE
  },
  {
    id: 'practice-va-breathing-space',
    title: 'Three Minute Breathing Space',
    type: 'mindfulness',
    category: PracticeCategory.MINDFULNESS,
    duration: 3,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    approach: 'Hybrid',
    format: 'Audio',
    description: 'A compact mindfulness pause for noticing thoughts, breath, and the body.',
    audioUrl: 'https://wellmd.stanford.edu/content/dam/sm/wellmd/audio/physician-bedtime-meditation.mp3',
    focusAreas: json(['stress', 'focus', 'mindfulness', 'reset']),
    immediateRelief: true,
    crisisEligible: false,
    requiredEquipment: json([]),
    environment: json(['home', 'work', 'public']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    sensoryEngagement: json(['breath', 'body', 'sound']),
    tags: 'mindfulness,breathing-space,va,reset',
    isPublished: true,
    sourceName: 'VA Portland Mindfulness Institute',
    sourceUrl: 'https://www.va.gov/portland-health-care/programs/whole-health/mindfulness-institute-resources/',
    confidence: 0.9,
    notes: SOURCE_NOTE
  },
  {
    id: 'practice-mindful-walking',
    title: 'Mindful Walking',
    type: 'mindfulness',
    category: PracticeCategory.MINDFULNESS,
    duration: 10,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    approach: 'Hybrid',
    format: 'Text',
    description: 'A gentle walking practice that uses footsteps and surroundings as anchors.',
    instructions: json([
      'Walk at a natural, safe pace.',
      'Notice the feeling of each foot meeting the ground.',
      'Let the eyes take in colors and shapes without judging them.',
      'When the mind wanders, return to the next step.'
    ]),
    benefits: 'Combines light movement with attention training and grounding.',
    precautions: 'Keep enough awareness for traffic, stairs, and other hazards.',
    focusAreas: json(['stress', 'overthinking', 'focus', 'movement']),
    immediateRelief: false,
    crisisEligible: false,
    requiredEquipment: json([]),
    environment: json(['public', 'nature', 'home']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    sensoryEngagement: json(['movement', 'sight', 'touch']),
    tags: 'walking,mindfulness,grounding,movement',
    isPublished: true,
    sourceName: 'Dartmouth Student Wellness Center',
    sourceUrl: 'https://students.dartmouth.edu/wellness-center/wellness-mindfulness/mindfulness-meditation',
    confidence: 0.85,
    notes: SOURCE_NOTE
  },
  {
    id: 'practice-thought-record',
    title: 'CBT Thought Record',
    type: 'cbt_technique',
    category: PracticeCategory.CBT_TECHNIQUE,
    duration: 15,
    difficulty: 'Intermediate',
    intensityLevel: DifficultyLevel.INTERMEDIATE,
    approach: 'Western',
    format: 'Text/Interactive',
    description: 'A structured worksheet-style practice for examining automatic thoughts and finding balanced alternatives.',
    instructions: json([
      'Write the situation in one sentence.',
      'Name the strongest emotion and rate its intensity from 0 to 100.',
      'Write the automatic thought.',
      'List evidence for and against the thought.',
      'Write a more balanced thought and re-rate the emotion.'
    ]),
    benefits: 'Builds cognitive flexibility and can reduce rumination over time.',
    precautions: 'If the topic is traumatic or highly distressing, do this with professional support.',
    focusAreas: json(['anxiety', 'depression', 'overthinking', 'cbt']),
    immediateRelief: false,
    crisisEligible: false,
    requiredEquipment: json(['journal or notes app']),
    environment: json(['home', 'work']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    sensoryEngagement: json(['writing', 'reflection']),
    tags: 'cbt,thought-record,cognitive-restructuring,worksheet',
    isPublished: true,
    sourceName: 'Psychology Tools',
    sourceUrl: 'https://www.psychologytools.com/self-help/thought-records/',
    confidence: 0.9,
    notes: SOURCE_NOTE
  },
  {
    id: 'practice-progressive-muscle-relaxation',
    title: 'Progressive Muscle Relaxation',
    type: 'relaxation',
    category: PracticeCategory.SLEEP_HYGIENE,
    duration: 12,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    approach: 'Western',
    format: 'Text',
    description: 'A tension-release routine for settling physical stress before sleep.',
    instructions: json([
      'Lie down or sit comfortably.',
      'Gently tense one muscle group for about five seconds.',
      'Release and notice the contrast for ten seconds.',
      'Move from feet to legs, hands, shoulders, and face.'
    ]),
    benefits: 'May reduce physical tension and support sleep readiness.',
    precautions: 'Skip injured or painful muscle groups; avoid forceful clenching.',
    focusAreas: json(['sleep', 'stress', 'physical-tension']),
    immediateRelief: true,
    crisisEligible: false,
    requiredEquipment: json([]),
    environment: json(['home']),
    timeOfDay: json(['evening', 'night']),
    sensoryEngagement: json(['body', 'muscle-tension']),
    tags: 'pmr,relaxation,sleep,stress',
    isPublished: true,
    sourceName: 'NHS mental health services guidance',
    sourceUrl: 'https://www.bsmhft.nhs.uk/our-services/specialist-services/perinatal-mental-health-service/information-for-mothers/relaxation/',
    confidence: 0.85,
    notes: SOURCE_NOTE
  },
  {
    id: 'practice-sleep-hygiene-wind-down',
    title: 'Sleep Hygiene Wind Down',
    type: 'sleep',
    category: PracticeCategory.SLEEP_HYGIENE,
    duration: 20,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    approach: 'Western',
    format: 'Text',
    description: 'A practical evening routine based on sleep hygiene principles.',
    instructions: json([
      'Dim screens and bright lights.',
      'Set tomorrow essentials aside.',
      'Do a brief relaxation practice.',
      'Keep the bed for sleep when possible.'
    ]),
    benefits: 'Supports consistent sleep cues and reduces bedtime arousal.',
    precautions: 'Persistent insomnia deserves medical or behavioral sleep support.',
    focusAreas: json(['sleep', 'stress', 'routine']),
    immediateRelief: false,
    crisisEligible: false,
    requiredEquipment: json([]),
    environment: json(['home']),
    timeOfDay: json(['night']),
    sensoryEngagement: json(['light', 'body', 'routine']),
    tags: 'sleep-hygiene,insomnia,wind-down',
    isPublished: true,
    sourceName: 'NIMH',
    sourceUrl: 'https://www.nimh.nih.gov/health/topics/caring-for-your-mental-health',
    confidence: 0.85,
    notes: SOURCE_NOTE
  }
];

const contents: Array<Prisma.ContentUncheckedCreateInput> = [
  {
    id: 'content-nimh-anxiety-disorders',
    title: 'Anxiety Disorders: Signs, Types, and Help',
    type: 'article',
    contentType: ContentType.PSYCHOEDUCATION,
    category: 'anxiety',
    approach: 'western',
    content: 'https://www.nimh.nih.gov/health/topics/anxiety-disorders',
    description: 'NIMH overview of anxiety disorders, symptoms, treatment directions, research, and help-seeking.',
    duration: 600,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'anxiety,nimh,psychoeducation,symptoms,treatment',
    focusAreas: json(['anxiety', 'panic', 'worry']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    environment: json(['home', 'work']),
    hasSubtitles: false,
    immediateRelief: false,
    crisisEligible: false,
    isPublished: true,
    sourceName: 'National Institute of Mental Health',
    sourceUrl: 'https://www.nimh.nih.gov/health/topics/anxiety-disorders',
    confidence: 0.98,
    notes: SOURCE_NOTE
  },
  {
    id: 'content-nimh-anxiety-minute',
    title: 'Mental Health Minute: Anxiety Disorders in Adults',
    type: 'video',
    contentType: ContentType.VIDEO,
    category: 'anxiety',
    approach: 'western',
    content: 'https://www.youtube.com/watch?v=a7L4_L3Fj3I',
    youtubeUrl: 'https://www.youtube.com/watch?v=a7L4_L3Fj3I',
    description: 'Short NIMH video explaining adult anxiety disorders and pointing users toward more information.',
    duration: 60,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'anxiety,nimh,video,education',
    focusAreas: json(['anxiety', 'psychoeducation']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    environment: json(['home', 'work']),
    hasSubtitles: true,
    immediateRelief: false,
    crisisEligible: false,
    isPublished: true,
    sourceName: 'National Institute of Mental Health',
    sourceUrl: 'https://www.nimh.nih.gov/news/media/2021/mental-health-minute-anxiety-disorders-in-adults',
    confidence: 0.98,
    notes: SOURCE_NOTE
  },
  {
    id: 'content-nimh-depression',
    title: 'Depression: Symptoms, Causes, and Treatment',
    type: 'article',
    contentType: ContentType.PSYCHOEDUCATION,
    category: 'depression',
    approach: 'western',
    content: 'https://www.nimh.nih.gov/health/publications/depression',
    description: 'NIMH patient education page covering depression symptoms, risk factors, treatment, and help-seeking.',
    duration: 720,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'depression,nimh,psychoeducation,symptoms,treatment',
    focusAreas: json(['depression', 'low-mood', 'help-seeking']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    environment: json(['home']),
    hasSubtitles: false,
    immediateRelief: false,
    crisisEligible: true,
    isPublished: true,
    sourceName: 'National Institute of Mental Health',
    sourceUrl: 'https://www.nimh.nih.gov/health/publications/depression',
    confidence: 0.98,
    notes: SOURCE_NOTE
  },
  {
    id: 'content-nimh-depression-minute',
    title: 'Depression Mental Health Minute',
    type: 'video',
    contentType: ContentType.VIDEO,
    category: 'depression',
    approach: 'western',
    content: 'https://www.youtube.com/watch?v=d7npDGZDhco',
    youtubeUrl: 'https://www.youtube.com/watch?v=d7npDGZDhco',
    description: 'Short NIMH video introducing depression and encouraging support.',
    duration: 60,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'depression,nimh,video,education',
    focusAreas: json(['depression', 'psychoeducation']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    environment: json(['home', 'work']),
    hasSubtitles: true,
    immediateRelief: false,
    crisisEligible: true,
    isPublished: true,
    sourceName: 'National Institute of Mental Health',
    sourceUrl: 'https://www.nimh.nih.gov/news/media/2020/depression-mental-health-minute',
    confidence: 0.98,
    notes: SOURCE_NOTE
  },
  {
    id: 'content-who-stress-guide',
    title: 'Doing What Matters in Times of Stress',
    type: 'article',
    contentType: ContentType.PSYCHOEDUCATION,
    category: 'stress',
    approach: 'hybrid',
    content: 'https://iris.who.int/bitstream/handle/10665/331901/9789240011670-eng.pdf',
    description: 'WHO illustrated stress management guide with practical self-help skills for adversity.',
    duration: 1800,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'stress,who,self-help,grounding,values',
    focusAreas: json(['stress', 'overwhelm', 'coping']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    environment: json(['home', 'work']),
    hasSubtitles: false,
    immediateRelief: false,
    crisisEligible: false,
    isPublished: true,
    sourceName: 'World Health Organization',
    sourceUrl: 'https://iris.who.int/bitstream/handle/10665/331901/9789240011670-eng.pdf',
    confidence: 0.98,
    notes: SOURCE_NOTE
  },
  {
    id: 'content-nhs-breathing-stress',
    title: 'Breathing Exercises for Stress',
    type: 'article',
    contentType: ContentType.BREATHING_EXERCISE,
    category: 'stress',
    approach: 'western',
    content: 'https://www.nhs.uk/conditions/stress-anxiety-depression/ways-relieve-stress/',
    description: 'NHS calming breathing technique for stress, anxiety, and panic.',
    duration: 300,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'stress,anxiety,breathing,nhs,quick-relief',
    focusAreas: json(['stress', 'anxiety', 'panic']),
    timeOfDay: json(['morning', 'afternoon', 'evening', 'night']),
    environment: json(['home', 'work', 'public']),
    hasSubtitles: false,
    immediateRelief: true,
    crisisEligible: true,
    isPublished: true,
    sourceName: 'NHS',
    sourceUrl: 'https://www.nhs.uk/conditions/stress-anxiety-depression/ways-relieve-stress/',
    confidence: 0.95,
    notes: SOURCE_NOTE
  },
  {
    id: 'content-mind-anxiety-self-care',
    title: 'Self-Care for Anxiety and Panic',
    type: 'article',
    contentType: ContentType.ARTICLE,
    category: 'anxiety',
    approach: 'hybrid',
    content: 'https://www.mind.org.uk/information-support/types-of-mental-health-problems/anxiety-and-panic-attacks/self-care/',
    description: 'Practical self-care ideas for anxiety and panic, including tracking patterns and grounding.',
    duration: 720,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'anxiety,panic,self-care,mind,grounding',
    focusAreas: json(['anxiety', 'panic', 'self-care']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    environment: json(['home', 'work']),
    hasSubtitles: false,
    immediateRelief: false,
    crisisEligible: false,
    isPublished: true,
    sourceName: 'Mind',
    sourceUrl: 'https://www.mind.org.uk/information-support/types-of-mental-health-problems/anxiety-and-panic-attacks/self-care/',
    confidence: 0.92,
    notes: SOURCE_NOTE
  },
  {
    id: 'content-ucla-guided-meditations',
    title: 'Free Guided Meditations',
    type: 'audio',
    contentType: ContentType.AUDIO_MEDITATION,
    category: 'mindfulness',
    approach: 'hybrid',
    content: 'https://wellmd.stanford.edu/content/dam/sm/wellmd/audio/physician-bedtime-meditation.mp3',
    youtubeUrl: 'https://www.youtube.com/watch?v=U97vY8xXbK4',
    description: 'UCLA Mindful collection of guided meditations in multiple languages, including breathing and body scan.',
    duration: 600,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'mindfulness,meditation,ucla,audio,multilingual',
    focusAreas: json(['mindfulness', 'stress', 'sleep']),
    timeOfDay: json(['morning', 'evening', 'night']),
    environment: json(['home']),
    hasSubtitles: false,
    immediateRelief: false,
    crisisEligible: false,
    isPublished: true,
    sourceName: 'UCLA Mindful',
    sourceUrl: 'https://www.uclahealth.org/uclamindful/guided-meditations',
    confidence: 0.95,
    notes: SOURCE_NOTE
  },
  {
    id: 'content-va-mindfulness-resources',
    title: 'Mindfulness Institute Resources',
    type: 'audio',
    contentType: ContentType.MINDFULNESS_EXERCISE,
    category: 'mindfulness',
    approach: 'hybrid',
    content: 'https://prevention.psu.edu/wp-content/uploads/2022/12/Loving-Kindness-Practice-with-Elaine.mp3',
    youtubeUrl: 'https://www.youtube.com/watch?v=inpok4MKVLM',
    description: 'VA mindfulness resources including brief breathing space and guided audio exercises.',
    duration: 480,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'mindfulness,va,breathing,audio,stress',
    focusAreas: json(['mindfulness', 'stress', 'grounding']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    environment: json(['home', 'work']),
    hasSubtitles: false,
    immediateRelief: true,
    crisisEligible: false,
    isPublished: true,
    sourceName: 'VA Portland Health Care',
    sourceUrl: 'https://www.va.gov/portland-health-care/programs/whole-health/mindfulness-institute-resources/',
    confidence: 0.9,
    notes: SOURCE_NOTE
  },
  {
    id: 'content-psychologytools-anxiety',
    title: 'Anxiety Self-Help Guide',
    type: 'article',
    contentType: ContentType.CBT_WORKSHEET,
    category: 'anxiety',
    approach: 'western',
    content: 'https://www.psychologytools.com/self-help/anxiety/',
    description: 'CBT-informed anxiety education and self-help tools from Psychology Tools.',
    duration: 900,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'anxiety,cbt,self-help,psychology-tools',
    focusAreas: json(['anxiety', 'cbt', 'overthinking']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    environment: json(['home']),
    hasSubtitles: false,
    immediateRelief: false,
    crisisEligible: false,
    isPublished: true,
    sourceName: 'Psychology Tools',
    sourceUrl: 'https://www.psychologytools.com/self-help/anxiety/',
    confidence: 0.9,
    notes: SOURCE_NOTE
  },
  {
    id: 'content-dartmouth-mindfulness',
    title: 'Mindfulness and Meditation Resources',
    type: 'article',
    contentType: ContentType.MINDFULNESS_EXERCISE,
    category: 'mindfulness',
    approach: 'hybrid',
    content: 'https://students.dartmouth.edu/wellness-center/wellness-mindfulness/mindfulness-meditation',
    description: 'Student wellness mindfulness practices, guided audio, and meditation resources.',
    duration: 600,
    difficulty: 'Beginner',
    intensityLevel: DifficultyLevel.BEGINNER,
    tags: 'mindfulness,student-wellness,meditation,audio',
    focusAreas: json(['mindfulness', 'stress', 'student-wellbeing']),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    environment: json(['home', 'work', 'public']),
    hasSubtitles: false,
    immediateRelief: false,
    crisisEligible: false,
    isPublished: true,
    sourceName: 'Dartmouth Student Wellness Center',
    sourceUrl: 'https://students.dartmouth.edu/wellness-center/wellness-mindfulness/mindfulness-meditation',
    confidence: 0.85,
    notes: SOURCE_NOTE
  }
];

const therapists: Array<Prisma.TherapistUncheckedCreateInput> = [
  {
    id: 'therapist-demo-in-ananya-rao',
    name: 'Dr. Ananya Rao',
    credential: TherapistCredential.PSYCHOLOGIST,
    title: 'Clinical Psychologist, PhD',
    bio: 'Synthetic demo profile for product evaluation. Focuses on CBT, anxiety, depression, academic stress, and culturally sensitive care for young adults.',
    specialtiesJson: json(['ANXIETY', 'DEPRESSION', 'CBT', 'STRESS_MANAGEMENT', 'MINDFULNESS']),
    email: 'demo.ananya.rao@example.com',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'IN',
    acceptsInsurance: false,
    insurances: json([]),
    sessionFee: 1800,
    offersSliding: true,
    availabilityJson: json([
      { day: 'Monday', startTime: '10:00', endTime: '13:00' },
      { day: 'Thursday', startTime: '16:00', endTime: '19:00' }
    ]),
    yearsExperience: 11,
    languages: 'English, Hindi, Kannada',
    rating: 4.8,
    reviewCount: 42,
    isActive: true,
    isVerified: true
  },
  {
    id: 'therapist-demo-in-kabir-mehta',
    name: 'Kabir Mehta',
    credential: TherapistCredential.LPC,
    title: 'Counselling Psychologist',
    bio: 'Synthetic demo profile for product evaluation. Works with stress management, relationships, grief, and mindfulness-based coping.',
    specialtiesJson: json(['STRESS_MANAGEMENT', 'RELATIONSHIPS', 'GRIEF', 'MINDFULNESS']),
    email: 'demo.kabir.mehta@example.com',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'IN',
    acceptsInsurance: false,
    insurances: json([]),
    sessionFee: 1500,
    offersSliding: true,
    availabilityJson: json([
      { day: 'Tuesday', startTime: '09:00', endTime: '12:00' },
      { day: 'Saturday', startTime: '11:00', endTime: '15:00' }
    ]),
    yearsExperience: 8,
    languages: 'English, Hindi, Marathi',
    rating: 4.7,
    reviewCount: 31,
    isActive: true,
    isVerified: true
  },
  {
    id: 'therapist-demo-in-meera-iyer',
    name: 'Dr. Meera Iyer',
    credential: TherapistCredential.PSYCHIATRIST,
    title: 'Consultant Psychiatrist, MD',
    bio: 'Synthetic demo profile for product evaluation. Supports medication evaluation and collaborative care for depression, bipolar disorder, anxiety, and sleep concerns.',
    specialtiesJson: json(['DEPRESSION', 'BIPOLAR', 'ANXIETY', 'STRESS_MANAGEMENT']),
    email: 'demo.meera.iyer@example.com',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'IN',
    acceptsInsurance: true,
    insurances: json(['Demo Health Plan']),
    sessionFee: 2500,
    offersSliding: false,
    availabilityJson: json([
      { day: 'Wednesday', startTime: '14:00', endTime: '17:00' },
      { day: 'Friday', startTime: '10:00', endTime: '13:00' }
    ]),
    yearsExperience: 14,
    languages: 'English, Tamil, Hindi',
    rating: 4.9,
    reviewCount: 56,
    isActive: true,
    isVerified: true
  },
  {
    id: 'therapist-demo-in-nisha-verma',
    name: 'Nisha Verma',
    credential: TherapistCredential.LMFT,
    title: 'Family and Relationship Therapist',
    bio: 'Synthetic demo profile for product evaluation. Offers relationship counselling, family therapy, communication skills, and conflict repair support.',
    specialtiesJson: json(['RELATIONSHIPS', 'FAMILY_THERAPY', 'COUPLES_THERAPY', 'STRESS_MANAGEMENT']),
    email: 'demo.nisha.verma@example.com',
    city: 'Delhi',
    state: 'Delhi',
    country: 'IN',
    acceptsInsurance: false,
    insurances: json([]),
    sessionFee: 1700,
    offersSliding: true,
    availabilityJson: json([
      { day: 'Monday', startTime: '17:00', endTime: '20:00' },
      { day: 'Sunday', startTime: '10:00', endTime: '13:00' }
    ]),
    yearsExperience: 9,
    languages: 'English, Hindi',
    rating: 4.6,
    reviewCount: 27,
    isActive: true,
    isVerified: true
  },
  {
    id: 'therapist-demo-in-arjun-sen',
    name: 'Arjun Sen',
    credential: TherapistCredential.LCSW,
    title: 'Trauma-Informed Clinical Social Worker',
    bio: 'Synthetic demo profile for product evaluation. Focuses on trauma-informed care, grounding skills, grief, and recovery-oriented planning.',
    specialtiesJson: json(['TRAUMA', 'PTSD', 'GRIEF', 'MINDFULNESS']),
    email: 'demo.arjun.sen@example.com',
    city: 'Kolkata',
    state: 'West Bengal',
    country: 'IN',
    acceptsInsurance: false,
    insurances: json([]),
    sessionFee: 1400,
    offersSliding: true,
    availabilityJson: json([
      { day: 'Tuesday', startTime: '15:00', endTime: '18:00' },
      { day: 'Friday', startTime: '09:00', endTime: '12:00' }
    ]),
    yearsExperience: 10,
    languages: 'English, Hindi, Bengali',
    rating: 4.8,
    reviewCount: 35,
    isActive: true,
    isVerified: true
  }
];

const assessmentSources: Record<string, { sourceName: string; sourceUrl: string; note: string }> = {
  anxiety_assessment: {
    sourceName: 'PHQ Screeners / GAD-7',
    sourceUrl: 'https://www.phqscreeners.com/',
    note: 'GAD-7 is a screening and symptom-monitoring tool, not a standalone diagnosis.'
  },
  gad2: {
    sourceName: 'PHQ Screeners / GAD-2',
    sourceUrl: 'https://www.phqscreeners.com/',
    note: 'GAD-2 is a brief screen; high scores warrant fuller assessment.'
  },
  depression_phq9: {
    sourceName: 'PHQ Screeners / PHQ-9',
    sourceUrl: 'https://www.phqscreeners.com/',
    note: 'PHQ-9 is a screening and severity-monitoring tool, not a standalone diagnosis.'
  },
  phq2: {
    sourceName: 'PHQ Screeners / PHQ-2',
    sourceUrl: 'https://www.phqscreeners.com/',
    note: 'PHQ-2 is a brief screen; high scores warrant fuller assessment.'
  },
  stress_pss10: {
    sourceName: 'Carnegie Mellon University PSS',
    sourceUrl: 'https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/html/pss.html',
    note: 'PSS measures perceived stress over the past month.'
  },
  pss4: {
    sourceName: 'Carnegie Mellon University PSS',
    sourceUrl: 'https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/html/pss.html',
    note: 'PSS-4 is a brief perceived stress screen.'
  },
  trauma_pcl5: {
    sourceName: 'VA National Center for PTSD',
    sourceUrl: 'https://www.ptsd.va.gov/PTSD/professional/assessment/adult-sr/ptsd-checklist.asp',
    note: 'PCL-5 supports PTSD screening and monitoring; diagnosis requires clinical evaluation.'
  },
  pc_ptsd_5: {
    sourceName: 'VA National Center for PTSD',
    sourceUrl: 'https://www.ptsd.va.gov/understand/isitptsd/have_ptsd.asp',
    note: 'PC-PTSD-5 is a primary care screen; positive screens need follow-up.'
  },
  overthinking_ptq: {
    sourceName: 'Perseverative Thinking Questionnaire literature',
    sourceUrl: 'https://www.sciencedirect.com/science/article/pii/S000579161000114X',
    note: 'PTQ measures repetitive negative thinking characteristics.'
  },
  emotional_intelligence_teique: {
    sourceName: 'TEIQue',
    sourceUrl: 'https://www.teique.com/',
    note: 'TEIQue-SF is a trait emotional intelligence measure.'
  },
  personality_mini_ipip: {
    sourceName: 'International Personality Item Pool',
    sourceUrl: 'https://ipip.ori.org/',
    note: 'Mini-IPIP-style items provide a brief Big Five personality snapshot.'
  }
};

async function upsertPractices() {
  for (const practice of practices) {
    const { id, ...data } = practice;
    await prisma.practice.upsert({
      where: { id },
      create: practice,
      update: data
    });
  }
  console.log(`Seeded ${practices.length} practices.`);
}

async function upsertContent() {
  for (const content of contents) {
    const { id, ...data } = content;
    await prisma.content.upsert({
      where: { id },
      create: content,
      update: data
    });
  }
  console.log(`Seeded ${contents.length} content resources.`);
}

async function upsertTherapists() {
  for (const therapist of therapists) {
    const { id, ...data } = therapist;
    await prisma.therapist.upsert({
      where: { id },
      create: therapist,
      update: data
    });
  }
  console.log(`Seeded ${therapists.length} synthetic therapist profiles.`);
}

async function enrichAssessmentMetadata() {
  const assessments = await prisma.assessmentDefinition.findMany({
    where: { id: { in: Object.keys(assessmentSources) } }
  });

  for (const assessment of assessments) {
    const source = assessmentSources[assessment.id];
    let scoringConfig: Record<string, unknown> = {};
    if (assessment.scoringConfig) {
      try {
        scoringConfig = JSON.parse(assessment.scoringConfig) as Record<string, unknown>;
      } catch {
        scoringConfig = {};
      }
    }

    await prisma.assessmentDefinition.update({
      where: { id: assessment.id },
      data: {
        tags: [
          assessment.category.toLowerCase().replace(/\s+/g, '-'),
          'validated-screener',
          'not-diagnostic'
        ].join(','),
        scoringConfig: json({
          ...scoringConfig,
          sourceName: source.sourceName,
          sourceUrl: source.sourceUrl,
          clinicalNote: source.note
        })
      }
    });
  }

  console.log(`Enriched ${assessments.length} assessment definitions with source metadata.`);
}

async function main() {
  console.log('Seeding genuine public resources and synthetic demo profiles...');
  await upsertPractices();
  await upsertContent();
  await upsertTherapists();
  await enrichAssessmentMetadata();
  console.log('Genuine/demo data seed complete.');
}

main()
  .catch((error) => {
    console.error('Genuine/demo data seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
