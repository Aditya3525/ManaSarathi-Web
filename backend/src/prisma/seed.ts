import { 
  PrismaClient, 
  PracticeCategory, 
  DifficultyLevel, 
  ContentType,
  TherapistCredential,
  ResourceType,
  FAQCategory,
  Prisma
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const DEMO_THERAPIST_NOTICE =
  'Demo provider profile for product evaluation. Replace with verified local provider details before public launch.';

const json = (value: unknown) => JSON.stringify(value);

type OptionTemplate = {
  value: number;
  text: string;
};

type BaseQuestion = {
  key: string;
  text: string;
  responseType: 'likert' | 'binary' | 'multiple_choice';
  options: OptionTemplate[];
  domain?: string;
  reverseScored?: boolean;
};

type QuestionSeed = {
  id: string;
  text: string;
  order: number;
  responseType: 'likert' | 'binary' | 'multiple_choice';
  domain?: string | null;
  reverseScored?: boolean;
  options: {
    id: string;
    value: number;
    text: string;
    order: number;
  }[];
};

type ScoringConfig = {
  algorithm?: string;
  minScore: number;
  maxScore: number;
  interpretationBands: Array<{
    max: number;
    label: string;
    color: string;
  }>;
  domains?: Array<{
    id: string;
    label: string;
    minScore: number;
    maxScore: number;
    interpretationBands: Array<{
      max: number;
      label: string;
      color: string;
    }>;
  }>;
};

type AssessmentSeed = {
  id: string;
  name: string;
  type: 'Basic' | 'Advanced' | 'Combined';
  category: string;
  description: string;
  timeEstimate?: string;
  timeframe?: string;
  isActive?: boolean;
  isBasicOverallOnly?: boolean;
  visibleInMainList?: boolean;
  tags?: string;
  scoringConfig: ScoringConfig;
  questions: QuestionSeed[];
};

// --- Question Option Templates ---
const OPTIONS_0_TO_3: OptionTemplate[] = [
  { value: 0, text: 'Not at all' },
  { value: 1, text: 'Several days' },
  { value: 2, text: 'More than half the days' },
  { value: 3, text: 'Nearly every day' }
];

const OPTIONS_0_TO_4: OptionTemplate[] = [
  { value: 0, text: 'Never' },
  { value: 1, text: 'Almost Never' },
  { value: 2, text: 'Sometimes' },
  { value: 3, text: 'Fairly Often' },
  { value: 4, text: 'Very Often' }
];

const OPTIONS_1_TO_4: OptionTemplate[] = [
  { value: 1, text: 'Almost Never' },
  { value: 2, text: 'Sometimes' },
  { value: 3, text: 'Often' },
  { value: 4, text: 'Almost Always' }
];

const OPTIONS_1_TO_5: OptionTemplate[] = [
  { value: 1, text: 'Disagree Strongly' },
  { value: 2, text: 'Disagree a little' },
  { value: 3, text: 'Neither agree nor disagree' },
  { value: 4, text: 'Agree a little' },
  { value: 5, text: 'Agree Strongly' }
];

const OPTIONS_1_TO_7: OptionTemplate[] = [
  { value: 1, text: 'Completely Disagree' },
  { value: 2, text: 'Strongly Disagree' },
  { value: 3, text: 'Disagree' },
  { value: 4, text: 'Neutral' },
  { value: 5, text: 'Agree' },
  { value: 6, text: 'Strongly Agree' },
  { value: 7, text: 'Completely Agree' }
];

const OPTIONS_PCL5: OptionTemplate[] = [
  { value: 0, text: 'Not at all' },
  { value: 1, text: 'A little bit' },
  { value: 2, text: 'Moderately' },
  { value: 3, text: 'Quite a bit' },
  { value: 4, text: 'Extremely' }
];

const OPTIONS_YES_NO: OptionTemplate[] = [
  { value: 1, text: 'Yes' },
  { value: 0, text: 'No' }
];

const OPTIONS_BROODING: OptionTemplate[] = [
  { value: 1, text: 'Never' },
  { value: 2, text: 'Sometimes' },
  { value: 3, text: 'Often' },
  { value: 4, text: 'Always' }
];

const OPTIONS_MINI_IPIP: OptionTemplate[] = [
  { value: 1, text: 'Very Inaccurate' },
  { value: 2, text: 'Moderately Inaccurate' },
  { value: 3, text: 'Neither Accurate nor Inaccurate' },
  { value: 4, text: 'Moderately Accurate' },
  { value: 5, text: 'Very Accurate' }
];

// --- Helpers ---
function buildQuestions(
  baseList: BaseQuestion[],
  startIndex: number,
  prefix: string
): QuestionSeed[] {
  return baseList.map((item, idx) => {
    const qIndex = startIndex + idx;
    const qId = `${prefix}_q${qIndex}`;
    return {
      id: qId,
      text: item.text,
      order: qIndex,
      responseType: item.responseType,
      domain: item.domain || null,
      reverseScored: item.reverseScored || false,
      options: item.options.map((opt, oIdx) => ({
        id: `${qId}_o${oIdx + 1}`,
        value: opt.value,
        text: opt.text,
        order: oIdx + 1
      }))
    };
  });
}

// --- Assessment Base Question Lists ---
const PHQ2_BASE: BaseQuestion[] = [
  { key: 'phq2_q1', text: 'Little interest or pleasure in doing things', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'phq2_q2', text: 'Feeling down, depressed, or hopeless', responseType: 'likert', options: OPTIONS_0_TO_3 }
];

const GAD2_BASE: BaseQuestion[] = [
  { key: 'gad2_q1', text: 'Feeling nervous, anxious, or on edge', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'gad2_q2', text: 'Not being able to stop or control worrying', responseType: 'likert', options: OPTIONS_0_TO_3 }
];

const PSS4_BASE: BaseQuestion[] = [
  { key: 'pss4_q1', text: 'Felt that you were unable to control the important things in your life?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss4_q2', text: 'Felt confident about your ability to handle your personal problems?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss4_q3', text: 'Felt that things were going your way?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss4_q4', text: 'Felt difficulties were piling up so high that you could not overcome them?', responseType: 'likert', options: OPTIONS_0_TO_4 }
];

const RRS4_BASE: BaseQuestion[] = [
  { key: 'rrs4_q1', text: 'Think "What am I doing to deserve this?"', responseType: 'likert', options: OPTIONS_1_TO_4 },
  { key: 'rrs4_q2', text: 'Analyze recent events to try to understand why you are depressed', responseType: 'likert', options: OPTIONS_1_TO_4 },
  { key: 'rrs4_q3', text: 'Think "Why do I have problems other people don\'t have?"', responseType: 'likert', options: OPTIONS_1_TO_4 },
  { key: 'rrs4_q4', text: 'Think "Why can\'t I handle things better?"', responseType: 'likert', options: OPTIONS_1_TO_4 }
];

const EQ5_BASE: BaseQuestion[] = [
  { key: 'eq5_q1', text: 'I am highly motivated to achieve my goals.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'eq5_q2', text: 'I find it easy to recognize and understand my emotions as they occur.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'eq5_q3', text: 'I can manage my stress and stay calm under pressure.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'eq5_q4', text: 'I am good at reading other people\'s non-verbal cues and feelings.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'eq5_q5', text: 'I can resolve conflicts constructively and build positive relationships.', responseType: 'likert', options: OPTIONS_1_TO_5 }
];

const BIG_FIVE_BASE: BaseQuestion[] = [
  { key: 'bigfive_q1', text: 'I see myself as extraverted, enthusiastic.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'bigfive_q2', text: 'I see myself as critical, quarrelsome.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'bigfive_q3', text: 'I see myself as dependable, self-disciplined.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'bigfive_q4', text: 'I see myself as anxious, easily upset.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'bigfive_q5', text: 'I see myself as open to new experiences, complex.', responseType: 'likert', options: OPTIONS_1_TO_5 }
];

const PCPTSD5_BASE: BaseQuestion[] = [
  { key: 'pcptsd5_q1', text: 'Had nightmares about the event(s) or thought about the event(s) when you did not want to?', responseType: 'binary', options: OPTIONS_YES_NO },
  { key: 'pcptsd5_q2', text: 'Tried hard not to think about the event(s) or went out of your way to avoid situations that reminded you of the event(s)?', responseType: 'binary', options: OPTIONS_YES_NO },
  { key: 'pcptsd5_q3', text: 'Been constantly on guard, watchful, or easily startled?', responseType: 'binary', options: OPTIONS_YES_NO },
  { key: 'pcptsd5_q4', text: 'Felt numb or detached from people, activities, or your surroundings?', responseType: 'binary', options: OPTIONS_YES_NO },
  { key: 'pcptsd5_q5', text: 'Felt guilty or unable to stop blaming yourself or others for the event(s) or any problems the event(s) may have caused?', responseType: 'binary', options: OPTIONS_YES_NO }
];

const PHQ9_BASE: BaseQuestion[] = [
  { key: 'phq9_q1', text: 'Little interest or pleasure in doing things', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'phq9_q2', text: 'Feeling down, depressed, or hopeless', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'phq9_q3', text: 'Trouble falling or staying asleep, or sleeping too much', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'phq9_q4', text: 'Feeling tired or having little energy', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'phq9_q5', text: 'Poor appetite or overeating', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'phq9_q6', text: 'Feeling bad about yourself — or that you are a failure', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'phq9_q7', text: 'Trouble concentrating on things', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'phq9_q8', text: 'Moving or speaking slowly or being so fidgety or restless that you move around a lot more than usual', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'phq9_q9', text: 'Thoughts that you would be better off dead or of hurting yourself', responseType: 'likert', options: OPTIONS_0_TO_3 }
];

const GAD7_BASE: BaseQuestion[] = [
  { key: 'gad7_q1', text: 'Feeling nervous, anxious, or on edge', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'gad7_q2', text: 'Not being able to stop or control worrying', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'gad7_q3', text: 'Worrying too much about different things', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'gad7_q4', text: 'Trouble relaxing', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'gad7_q5', text: 'Being so restless that it is hard to sit still', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'gad7_q6', text: 'Becoming easily annoyed or irritable', responseType: 'likert', options: OPTIONS_0_TO_3 },
  { key: 'gad7_q7', text: 'Feeling afraid as if something awful might happen', responseType: 'likert', options: OPTIONS_0_TO_3 }
];

const PSS10_BASE: BaseQuestion[] = [
  { key: 'pss10_q1', text: 'Been upset because of something that happened unexpectedly?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss10_q2', text: 'Felt that you were unable to control the important things in your life?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss10_q3', text: 'Felt nervous and "stressed"?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss10_q4', text: 'Dealt successfully with irritating life hassles?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss10_q5', text: 'Felt that you were effectively coping with important changes that were occurring in your life?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss10_q6', text: 'Felt confident about your ability to handle your personal problems?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss10_q7', text: 'Felt that things were going your way?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss10_q8', text: 'Felt that you could not cope with all the things that you had to do?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss10_q9', text: 'Been able to control irritations in your life?', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'pss10_q10', text: 'Felt that you were on top of things?', responseType: 'likert', options: OPTIONS_0_TO_4 }
];

const PCL5_BASE: BaseQuestion[] = [
  { key: 'pcl5_q1', text: 'Repeated, disturbing, and unwanted memories of the stressful experience?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q2', text: 'Repeated, disturbing dreams of the stressful experience?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q3', text: 'Suddenly feeling or acting as if the stressful experience were actually happening again?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q4', text: 'Feeling very upset when something reminded you of the stressful experience?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q5', text: 'Having strong physical reactions when something reminded you of the stressful experience?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q6', text: 'Avoiding memories, thoughts, or feelings related to the stressful experience?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q7', text: 'Avoiding external reminders of the stressful experience?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q8', text: 'Trouble remembering important parts of the stressful experience?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q9', text: 'Having strong negative beliefs about yourself, other people, or the world?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q10', text: 'Blaming yourself or someone else for the stressful experience or what happened after it?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q11', text: 'Having strong negative feelings like fear, horror, anger, guilt, or shame?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q12', text: 'Loss of interest in activities that you used to enjoy?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q13', text: 'Feeling distant or cut off from other people?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q14', text: 'Trouble experiencing positive feelings (for example, being unable to feel happiness or love)?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q15', text: 'Irritable behavior, angry outbursts, or acting aggressively?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q16', text: 'Taking too many risks or doing things that could cause you harm?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q17', text: 'Being "super-alert" or watchful or on guard?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q18', text: 'Feeling jumpy or easily startled?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q19', text: 'Having difficulty concentrating?', responseType: 'likert', options: OPTIONS_PCL5 },
  { key: 'pcl5_q20', text: 'Trouble falling or staying asleep?', responseType: 'likert', options: OPTIONS_PCL5 }
];

const MINI_IPIP_BASE: BaseQuestion[] = [
  { key: 'mini_ipip_q1', text: 'Am the life of the party.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'extraversion', reverseScored: false },
  { key: 'mini_ipip_q2', text: 'Sympathize with others\' feelings.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'agreeableness', reverseScored: false },
  { key: 'mini_ipip_q3', text: 'Get chores done right away.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'conscientiousness', reverseScored: false },
  { key: 'mini_ipip_q4', text: 'Have frequent mood swings.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'neuroticism', reverseScored: false },
  { key: 'mini_ipip_q5', text: 'Have a vivid imagination.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'openness', reverseScored: false },
  { key: 'mini_ipip_q6', text: 'Don\'t talk a lot.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'extraversion', reverseScored: true },
  { key: 'mini_ipip_q7', text: 'Am not interested in other people\'s problems.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'agreeableness', reverseScored: true },
  { key: 'mini_ipip_q8', text: 'Often forget to put things back in their proper place.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'conscientiousness', reverseScored: true },
  { key: 'mini_ipip_q9', text: 'Am relaxed most of the time.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'neuroticism', reverseScored: true },
  { key: 'mini_ipip_q10', text: 'Am not interested in abstract ideas.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'openness', reverseScored: true },
  { key: 'mini_ipip_q11', text: 'Talk to a lot of different people at parties.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'extraversion', reverseScored: false },
  { key: 'mini_ipip_q12', text: 'Feel others\' emotions.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'agreeableness', reverseScored: false },
  { key: 'mini_ipip_q13', text: 'Like order.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'conscientiousness', reverseScored: false },
  { key: 'mini_ipip_q14', text: 'Get upset easily.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'neuroticism', reverseScored: false },
  { key: 'mini_ipip_q15', text: 'Have difficulty understanding abstract ideas.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'openness', reverseScored: true },
  { key: 'mini_ipip_q16', text: 'Keep in the background.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'extraversion', reverseScored: true },
  { key: 'mini_ipip_q17', text: 'Am not really interested in others.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'agreeableness', reverseScored: true },
  { key: 'mini_ipip_q18', text: 'Make a mess of things.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'conscientiousness', reverseScored: true },
  { key: 'mini_ipip_q19', text: 'Seldom feel blue.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'neuroticism', reverseScored: true },
  { key: 'mini_ipip_q20', text: 'Do not have a good imagination.', responseType: 'likert', options: OPTIONS_MINI_IPIP, domain: 'openness', reverseScored: true }
];

const BROODING_BASE: BaseQuestion[] = [
  { key: 'brooding_q1', text: 'Think "What am I doing to deserve this?"', responseType: 'likert', options: OPTIONS_BROODING },
  { key: 'brooding_q2', text: 'Analyze recent events to try to understand why you are depressed', responseType: 'likert', options: OPTIONS_BROODING },
  { key: 'brooding_q3', text: 'Think "Why do I have problems other people don\'t have?"', responseType: 'likert', options: OPTIONS_BROODING },
  { key: 'brooding_q4', text: 'Think "Why can\'t I handle things better?"', responseType: 'likert', options: OPTIONS_BROODING },
  { key: 'brooding_q5', text: 'Write down what you are thinking and analyze it', responseType: 'likert', options: OPTIONS_BROODING }
];

const PTQ_BASE: BaseQuestion[] = [
  { key: 'ptq_q1', text: 'The same thoughts keep going through my mind.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q2', text: 'Thoughts come into my mind without me wanting them to.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q3', text: 'I can\'t stop dwelling on them.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q4', text: 'They distract me from other things.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q5', text: 'They consume a lot of my time.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q6', text: 'I feel overwhelmed by them.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q7', text: 'They prevent me from getting things done.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q8', text: 'They tire me out.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q9', text: 'I feel stuck in them.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q10', text: 'They arise even when I try to avoid them.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q11', text: 'They capture my full attention.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q12', text: 'I struggle to let go of them.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q13', text: 'They disrupt my daily activities.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q14', text: 'They make it hard for me to focus.', responseType: 'likert', options: OPTIONS_0_TO_4 },
  { key: 'ptq_q15', text: 'They drain my mental energy.', responseType: 'likert', options: OPTIONS_0_TO_4 }
];

const EI10_BASE: BaseQuestion[] = [
  { key: 'ei10_q1', text: 'I generally know how I am feeling.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'ei10_q2', text: 'I find it easy to control my temper.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'ei10_q3', text: 'I am highly self-motivated.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'ei10_q4', text: 'I can read other people\'s emotions easily.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'ei10_q5', text: 'I have strong relationship skills.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'ei10_q6', text: 'I struggle to express my feelings to others.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'ei10_q7', text: 'I act impulsively when upset.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'ei10_q8', text: 'I lose interest in projects quickly.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'ei10_q9', text: 'I am often surprised by other people\'s reactions.', responseType: 'likert', options: OPTIONS_1_TO_5 },
  { key: 'ei10_q10', text: 'I find it hard to resolve disagreements.', responseType: 'likert', options: OPTIONS_1_TO_5 }
];

const TEIQUE_BASE: BaseQuestion[] = [
  { key: 'teique_q1', text: 'Expressing my emotions with words is not a problem for me.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q2', text: 'I often find it difficult to see things from another person\'s viewpoint.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q3', text: 'On the whole, I\'m a highly motivated person.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q4', text: 'I usually find it difficult to regulate my emotions.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q5', text: 'I generally don\'t find life enjoyable.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q6', text: 'I can deal effectively with people.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q7', text: 'I tend to change my mind frequently.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q8', text: 'Many times, I can\'t figure out what emotion I\'m feeling.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q9', text: 'I feel that I have a number of good qualities.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q10', text: 'I often find it difficult to stand up for my rights.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q11', text: 'I\'m usually able to influence the way other people feel.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q12', text: 'On the whole, I have a gloomy perspective on most things.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q13', text: 'Those close to me often complain that I don\'t treat them right.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q14', text: 'I often find it difficult to adjust my life according to the circumstances.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q15', text: 'On the whole, I\'m able to deal with stress.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q16', text: 'I often find it difficult to show my affection to those close to me.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q17', text: 'I\'m normally able to \'get into someone\'s shoes\' and experience their emotions.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q18', text: 'I normally find it difficult to keep myself motivated.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q19', text: 'I\'m usually able to find ways to control my emotions when I want to.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q20', text: 'On the whole, I\'m pleased with my life.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q21', text: 'I would describe myself as a good negotiator.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q22', text: 'I tend to get involved in things I later wish I could get out of.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q23', text: 'I often pause and think about my feelings.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q24', text: 'I believe I\'m full of personal strengths.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q25', text: 'I tend to \'back down\' even if I know I\'m right.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q26', text: 'I don\'t seem to have any power at all over other people\'s feelings.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q27', text: 'I generally believe that things will work out fine in my life.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q28', text: 'I find it difficult to bond well even with those close to me.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q29', text: 'Generally, I\'m able to adapt to new environments.', responseType: 'likert', options: OPTIONS_1_TO_7 },
  { key: 'teique_q30', text: 'Others admire me for being relaxed.', responseType: 'likert', options: OPTIONS_1_TO_7 }
];

function buildCompositeQuestions(sectionSets: BaseQuestion[][]): QuestionSeed[] {
  const seeds: QuestionSeed[] = [];
  let orderTracker = 1;
  sectionSets.forEach((section, idx) => {
    const questions = buildQuestions(section, orderTracker, `basic_overall_q${idx + 1}`);
    seeds.push(...questions);
    orderTracker += section.length;
  });
  return seeds;
}

// --- Scoring Configurations ---
const GAD7_SCORING: ScoringConfig = {
  minScore: 0,
  maxScore: 21,
  interpretationBands: [
    { max: 4, label: 'Minimal anxiety', color: '#10b981' },
    { max: 9, label: 'Mild anxiety', color: '#84cc16' },
    { max: 14, label: 'Moderate anxiety', color: '#f97316' },
    { max: 21, label: 'Severe anxiety', color: '#e11d48' }
  ]
};

const PHQ9_SCORING: ScoringConfig = {
  minScore: 0,
  maxScore: 27,
  interpretationBands: [
    { max: 4, label: 'Minimal depression', color: '#10b981' },
    { max: 9, label: 'Mild depression', color: '#84cc16' },
    { max: 14, label: 'Moderate depression', color: '#f97316' },
    { max: 19, label: 'Moderately severe depression', color: '#ff7849' },
    { max: 27, label: 'Severe depression', color: '#e11d48' }
  ]
};

const PSS10_SCORING: ScoringConfig = {
  minScore: 0,
  maxScore: 40,
  interpretationBands: [
    { max: 13, label: 'Low perceived stress', color: '#10b981' },
    { max: 26, label: 'Moderate perceived stress', color: '#f97316' },
    { max: 40, label: 'High perceived stress', color: '#e11d48' }
  ]
};

const PCL5_SCORING: ScoringConfig = {
  minScore: 0,
  maxScore: 80,
  interpretationBands: [
    { max: 19, label: 'Minimal trauma-related distress', color: '#10b981' },
    { max: 39, label: 'Mild trauma activation', color: '#84cc16' },
    { max: 59, label: 'Moderate trauma activation', color: '#f97316' },
    { max: 80, label: 'Severe trauma activation', color: '#e11d48' }
  ]
};

const MINI_IPIP_SCORING: ScoringConfig = {
  algorithm: 'SUM',
  minScore: 20,
  maxScore: 100,
  interpretationBands: [
    { max: 45, label: 'Reserved personality expression', color: '#6fa3b5' },
    { max: 80, label: 'Balanced personality expression', color: '#10b981' },
    { max: 100, label: 'Pronounced personality expression', color: '#8b5cf6' }
  ],
  domains: [
    {
      id: 'extraversion',
      label: 'Extraversion',
      minScore: 4,
      maxScore: 20,
      interpretationBands: [
        { max: 8, label: 'Subtle trait expression', color: '#6fa3b5' },
        { max: 15, label: 'Balanced trait expression', color: '#10b981' },
        { max: 20, label: 'Strong trait expression', color: '#8b5cf6' }
      ]
    },
    {
      id: 'agreeableness',
      label: 'Agreeableness',
      minScore: 4,
      maxScore: 20,
      interpretationBands: [
        { max: 8, label: 'Subtle trait expression', color: '#6fa3b5' },
        { max: 15, label: 'Balanced trait expression', color: '#10b981' },
        { max: 20, label: 'Strong trait expression', color: '#8b5cf6' }
      ]
    },
    {
      id: 'conscientiousness',
      label: 'Conscientiousness',
      minScore: 4,
      maxScore: 20,
      interpretationBands: [
        { max: 8, label: 'Subtle trait expression', color: '#6fa3b5' },
        { max: 15, label: 'Balanced trait expression', color: '#10b981' },
        { max: 20, label: 'Strong trait expression', color: '#8b5cf6' }
      ]
    },
    {
      id: 'neuroticism',
      label: 'Neuroticism',
      minScore: 4,
      maxScore: 20,
      interpretationBands: [
        { max: 8, label: 'Subtle trait expression', color: '#6fa3b5' },
        { max: 15, label: 'Balanced trait expression', color: '#10b981' },
        { max: 20, label: 'Strong trait expression', color: '#8b5cf6' }
      ]
    },
    {
      id: 'openness',
      label: 'Openness',
      minScore: 4,
      maxScore: 20,
      interpretationBands: [
        { max: 8, label: 'Subtle trait expression', color: '#6fa3b5' },
        { max: 15, label: 'Balanced trait expression', color: '#10b981' },
        { max: 20, label: 'Strong trait expression', color: '#8b5cf6' }
      ]
    }
  ]
};

const PTQ_SCORING: ScoringConfig = {
  minScore: 0,
  maxScore: 60,
  interpretationBands: [
    { max: 15, label: 'Low repetitive negative thinking', color: '#10b981' },
    { max: 30, label: 'Moderate repetitive negative thinking', color: '#84cc16' },
    { max: 45, label: 'High repetitive negative thinking', color: '#f97316' },
    { max: 60, label: 'Very high repetitive negative thinking', color: '#e11d48' }
  ]
};

const TEIQUE_SF_SCORING: ScoringConfig = {
  minScore: 30,
  maxScore: 210,
  interpretationBands: [
    { max: 90, label: 'Low trait emotional intelligence', color: '#e11d48' },
    { max: 150, label: 'Average trait emotional intelligence', color: '#f97316' },
    { max: 210, label: 'High trait emotional intelligence', color: '#10b981' }
  ]
};

const BASIC_SCORING: ScoringConfig = {
  minScore: 0,
  maxScore: 20,
  interpretationBands: [
    { max: 5, label: 'Minimal indicators', color: '#10b981' },
    { max: 10, label: 'Mild indicators', color: '#84cc16' },
    { max: 15, label: 'Moderate indicators', color: '#f97316' },
    { max: 20, label: 'High indicators', color: '#e11d48' }
  ]
};

const ASSESSMENT_SEEDS: AssessmentSeed[] = [
  {
    id: 'anxiety_assessment',
    name: 'General Anxiety Disorder Assessment (GAD-7)',
    type: 'Advanced',
    category: 'Anxiety',
    description: 'Generalized Anxiety Disorder 7-item assessment.',
    timeEstimate: '5 minutes',
    timeframe: 'Over the last 2 weeks',
    tags: 'anxiety,validated-screener,not-diagnostic',
    scoringConfig: {
      ...GAD7_SCORING,
      sourceName: 'PHQ Screeners / GAD-7',
      sourceUrl: 'https://www.phqscreeners.com/',
      clinicalNote: 'GAD-7 is a screening and symptom-monitoring tool, not a standalone diagnosis.'
    } as any,
    questions: buildQuestions(GAD7_BASE, 1, 'anxiety_assessment')
  },
  {
    id: 'depression_phq9',
    name: 'Patient Health Questionnaire (PHQ-9)',
    type: 'Advanced',
    category: 'Depression',
    description: 'Patient Health Questionnaire-9 full depression inventory.',
    timeEstimate: '5 minutes',
    timeframe: 'Over the last 2 weeks',
    tags: 'depression,validated-screener,not-diagnostic',
    scoringConfig: {
      ...PHQ9_SCORING,
      sourceName: 'PHQ Screeners / PHQ-9',
      sourceUrl: 'https://www.phqscreeners.com/',
      clinicalNote: 'PHQ-9 is a screening and severity-monitoring tool, not a standalone diagnosis.'
    } as any,
    questions: buildQuestions(PHQ9_BASE, 1, 'depression_phq9')
  },
  {
    id: 'stress_pss10',
    name: 'Perceived Stress Scale (PSS-10)',
    type: 'Advanced',
    category: 'Stress',
    description: 'Perceived Stress Scale - 10 item standard form.',
    timeEstimate: '6 minutes',
    timeframe: 'Over the last month',
    tags: 'stress,validated-screener,not-diagnostic',
    scoringConfig: {
      ...PSS10_SCORING,
      sourceName: 'Carnegie Mellon University PSS',
      sourceUrl: 'https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/html/pss.html',
      clinicalNote: 'PSS measures perceived stress over the past month.'
    } as any,
    questions: buildQuestions(PSS10_BASE, 1, 'stress_pss10')
  },
  {
    id: 'overthinking_ptq',
    name: 'Perseverative Thinking Questionnaire (PTQ)',
    type: 'Advanced',
    category: 'Overthinking',
    description: '15-item questionnaire measuring repetitive negative thinking independent of content.',
    timeEstimate: '7 minutes',
    tags: 'overthinking,validated-screener,not-diagnostic',
    scoringConfig: {
      ...PTQ_SCORING,
      sourceName: 'Perseverative Thinking Questionnaire literature',
      sourceUrl: 'https://www.sciencedirect.com/science/article/pii/S000579161000114X',
      clinicalNote: 'PTQ measures repetitive negative thinking characteristics.'
    } as any,
    questions: buildQuestions(PTQ_BASE, 1, 'overthinking_ptq')
  },
  {
    id: 'emotional_intelligence_teique',
    name: 'Trait Emotional Intelligence Questionnaire (TEIQue-SF)',
    type: 'Advanced',
    category: 'Emotional Intelligence',
    description: '30-item Trait Emotional Intelligence short form.',
    timeEstimate: '8 minutes',
    tags: 'emotional-intelligence,validated-screener,not-diagnostic',
    scoringConfig: {
      ...TEIQUE_SF_SCORING,
      sourceName: 'TEIQue',
      sourceUrl: 'https://www.teique.com/',
      clinicalNote: 'TEIQue-SF is a trait emotional intelligence measure.'
    } as any,
    questions: buildQuestions(TEIQUE_BASE, 1, 'emotional_intelligence_teique')
  },
  {
    id: 'trauma_pcl5',
    name: 'PTSD Checklist for DSM-5 (PCL-5)',
    type: 'Advanced',
    category: 'Trauma',
    description: 'PTSD Checklist for DSM-5.',
    timeEstimate: '8 minutes',
    timeframe: 'Over the last month',
    tags: 'trauma,validated-screener,not-diagnostic',
    scoringConfig: {
      ...PCL5_SCORING,
      sourceName: 'VA National Center for PTSD',
      sourceUrl: 'https://www.ptsd.va.gov/PTSD/professional/assessment/adult-sr/ptsd-checklist.asp',
      clinicalNote: 'PCL-5 supports PTSD screening and monitoring; diagnosis requires clinical evaluation.'
    } as any,
    questions: buildQuestions(PCL5_BASE, 1, 'trauma_pcl5')
  },
  {
    id: 'personality_mini_ipip',
    name: 'Mini-IPIP Scales (Big Five)',
    type: 'Advanced',
    category: 'Personality',
    description: '20-item short form of the International Personality Item Pool.',
    timeEstimate: '8 minutes',
    tags: 'personality,validated-screener,not-diagnostic',
    scoringConfig: {
      ...MINI_IPIP_SCORING,
      sourceName: 'International Personality Item Pool',
      sourceUrl: 'https://ipip.ori.org/',
      clinicalNote: 'Mini-IPIP-style items provide a brief Big Five personality snapshot.'
    } as any,
    questions: buildQuestions(MINI_IPIP_BASE, 1, 'personality_mini_ipip')
  },
  {
    id: 'phq2',
    name: 'Patient Health Questionnaire-2 (PHQ-2)',
    type: 'Basic',
    category: 'Depression',
    description: 'Patient Health Questionnaire-2 (two-item depression screener).',
    timeEstimate: '2 minutes',
    timeframe: 'Over the last 2 weeks',
    isBasicOverallOnly: true,
    visibleInMainList: false,
    tags: 'depression,validated-screener,not-diagnostic',
    scoringConfig: {
      ...BASIC_SCORING,
      sourceName: 'PHQ Screeners / PHQ-2',
      sourceUrl: 'https://www.phqscreeners.com/',
      clinicalNote: 'PHQ-2 is a brief screen; high scores warrant fuller assessment.'
    } as any,
    questions: buildQuestions(PHQ2_BASE, 1, 'phq2')
  },
  {
    id: 'gad2',
    name: 'Generalized Anxiety Disorder 2-item (GAD-2)',
    type: 'Basic',
    category: 'Anxiety',
    description: 'Generalized Anxiety Disorder 2-item quick screen.',
    timeEstimate: '2 minutes',
    timeframe: 'Over the last 2 weeks',
    isBasicOverallOnly: true,
    visibleInMainList: false,
    tags: 'anxiety,validated-screener,not-diagnostic',
    scoringConfig: {
      ...BASIC_SCORING,
      sourceName: 'PHQ Screeners / GAD-2',
      sourceUrl: 'https://www.phqscreeners.com/',
      clinicalNote: 'GAD-2 is a brief screen; high scores warrant fuller assessment.'
    } as any,
    questions: buildQuestions(GAD2_BASE, 1, 'gad2')
  },
  {
    id: 'pss4',
    name: 'Perceived Stress Scale-4 (PSS-4)',
    type: 'Basic',
    category: 'Stress',
    description: 'Perceived Stress Scale - 4 item short form.',
    timeEstimate: '3 minutes',
    timeframe: 'Over the last month',
    isBasicOverallOnly: true,
    visibleInMainList: false,
    tags: 'stress,validated-screener,not-diagnostic',
    scoringConfig: {
      ...BASIC_SCORING,
      sourceName: 'Carnegie Mellon University PSS',
      sourceUrl: 'https://www.cmu.edu/dietrich/psychology/stress-immunity-disease-lab/scales/html/pss.html',
      clinicalNote: 'PSS-4 is a brief perceived stress screen.'
    } as any,
    questions: buildQuestions(PSS4_BASE, 1, 'pss4')
  },
  {
    id: 'rrs4',
    name: 'Ruminative Response Scale-4 (RRS-4)',
    type: 'Basic',
    category: 'Overthinking',
    description: '4-item short-form ruminative coping screen.',
    timeEstimate: '3 minutes',
    isBasicOverallOnly: true,
    visibleInMainList: false,
    tags: 'overthinking,validated-screener,not-diagnostic',
    scoringConfig: BASIC_SCORING,
    questions: buildQuestions(RRS4_BASE, 1, 'rrs4')
  },
  {
    id: 'pc_ptsd_5',
    name: 'Primary Care PTSD Screen (PC-PTSD-5)',
    type: 'Basic',
    category: 'Trauma',
    description: 'Primary Care PTSD Screen for DSM-5.',
    timeEstimate: '3 minutes',
    timeframe: 'Over the last month',
    isBasicOverallOnly: true,
    visibleInMainList: false,
    tags: 'trauma,validated-screener,not-diagnostic',
    scoringConfig: {
      ...BASIC_SCORING,
      sourceName: 'VA National Center for PTSD',
      sourceUrl: 'https://www.ptsd.va.gov/understand/isitptsd/have_ptsd.asp',
      clinicalNote: 'PC-PTSD-5 is a primary care screen; positive screens need follow-up.'
    } as any,
    questions: buildQuestions(PCPTSD5_BASE, 1, 'pc_ptsd_5')
  },
  {
    id: 'eq5',
    name: 'Emotional Intelligence 5-item (EQ-5)',
    type: 'Basic',
    category: 'Emotional Intelligence',
    description: '5-item custom screening scale for emotional regulation and empathy.',
    timeEstimate: '3 minutes',
    isBasicOverallOnly: true,
    visibleInMainList: false,
    tags: 'emotional-intelligence,validated-screener,not-diagnostic',
    scoringConfig: BASIC_SCORING,
    questions: buildQuestions(EQ5_BASE, 1, 'eq5')
  },
  {
    id: 'big_five_short',
    name: 'Big Five Personality Short Form (BFI-10)',
    type: 'Basic',
    category: 'Personality',
    description: '10-item brief screening form for Big Five personality traits.',
    timeEstimate: '4 minutes',
    isBasicOverallOnly: true,
    visibleInMainList: false,
    tags: 'personality,validated-screener,not-diagnostic',
    scoringConfig: BASIC_SCORING,
    questions: buildQuestions(BIG_FIVE_BASE, 1, 'big_five_short')
  }
];

const BASIC_OVERALL_SEED: AssessmentSeed = {
  id: 'basic_overall',
  name: 'Baseline Wellness Screening (Combined)',
  type: 'Combined',
  category: 'Composite',
  description: 'Combined quick assessment covering depression, anxiety, stress, trauma, rumination, personality, and emotional intelligence.',
  timeEstimate: '10 minutes',
  timeframe: 'Over the last 2 weeks',
  isBasicOverallOnly: false,
  visibleInMainList: false,
  scoringConfig: {
    minScore: 0,
    maxScore: 132,
    interpretationBands: [
      { max: 35, label: 'Balanced wellbeing indicators', color: '#10b981' },
      { max: 75, label: 'Moderate activation - review resource recommendations', color: '#f97316' },
      { max: 132, label: 'High activation - clinical follow-up suggested', color: '#e11d48' }
    ]
  },
  questions: buildCompositeQuestions([
    PHQ2_BASE,
    GAD2_BASE,
    PSS4_BASE,
    RRS4_BASE,
    PCPTSD5_BASE,
    EQ5_BASE,
    BIG_FIVE_BASE
  ])
};

// --- Genuine Practices ---
const part1Articles = JSON.parse(fs.readFileSync(path.join(process.cwd(), '../Project Data/seed_data_part1_articles.json'), 'utf-8')).contents;
const part2Contents = JSON.parse(fs.readFileSync(path.join(process.cwd(), '../Project Data/seed_data_part2_contents.json'), 'utf-8')).contents;
const part3Practices = JSON.parse(fs.readFileSync(path.join(process.cwd(), '../Project Data/seed_data_part3_practices.json'), 'utf-8')).practices;

const allContents = [...part1Articles, ...part2Contents];

const contentEntries: Array<Prisma.ContentUncheckedCreateInput> = allContents.map((c: any, i: number) => {
  let contentType: ContentType = ContentType.ARTICLE;
  if (c.type === 'video' || c.type === 'playlist') contentType = ContentType.VIDEO;
  if (c.type === 'audio') contentType = ContentType.AUDIO_MEDITATION;
  if (c.type === 'story') contentType = ContentType.STORY;
  if (c.type === 'worksheet' || c.type === 'prompt') contentType = ContentType.CBT_WORKSHEET;
  
  let intensityLevel: DifficultyLevel = DifficultyLevel.BEGINNER;
  if (c.intensityLevel === 'medium') intensityLevel = DifficultyLevel.INTERMEDIATE;
  if (c.intensityLevel === 'high') intensityLevel = DifficultyLevel.ADVANCED;

  let difficulty = 'Beginner';
  if (c.difficulty === 'Intermediate') difficulty = 'Intermediate';
  if (c.difficulty === 'Advanced') difficulty = 'Advanced';

  return {
    id: `content-${i}`,
    title: c.title,
    type: c.type,
    contentType: contentType,
    category: c.category || 'General',
    approach: c.approach,
    content: c.content || c.url || c.youtubeUrl || '',
    youtubeUrl: c.youtubeUrl,
    description: c.description,
    duration: c.duration || 300,
    difficulty: difficulty,
    intensityLevel: intensityLevel,
    tags: c.tags ? c.tags.join(',') : '',
    focusAreas: json(c.focusAreas || []),
    timeOfDay: json(['morning', 'afternoon', 'evening']),
    environment: json(['home']),
    hasSubtitles: c.hasSubtitles || false,
    immediateRelief: c.immediateRelief || false,
    crisisEligible: false,
    isPublished: true,
    sourceName: c.type === 'video' || c.type === 'audio' ? 'External Source' : 'ManaSarathi Original',
    sourceUrl: c.url,
    confidence: 0.95
  };
});

const practiceEntries: Array<Prisma.PracticeUncheckedCreateInput> = part3Practices.map((p: any, i: number) => {
  let cat: PracticeCategory = PracticeCategory.MINDFULNESS;
  if (p.type === 'yoga') cat = PracticeCategory.YOGA;
  if (p.type === 'breathing') cat = PracticeCategory.BREATHING;
  if (p.type === 'meditation') cat = PracticeCategory.MEDITATION;
  if (p.type === 'sleep') cat = PracticeCategory.SLEEP_HYGIENE;

  let intensityLevel: DifficultyLevel = DifficultyLevel.BEGINNER;
  if (p.difficulty === 'Intermediate') intensityLevel = DifficultyLevel.INTERMEDIATE;
  if (p.difficulty === 'Advanced') intensityLevel = DifficultyLevel.ADVANCED;

  return {
    id: `practice-${i}`,
    title: p.title,
    type: p.type,
    category: cat,
    duration: Math.round(p.duration / 60) || 10,
    difficulty: p.difficulty || 'Beginner',
    intensityLevel: intensityLevel,
    approach: 'Hybrid',
    format: p.format || 'Text',
    description: p.description,
    instructions: json(p.steps ? p.steps.map((s: any) => s.instruction) : []),
    benefits: p.benefits ? p.benefits.join(', ') : '',
    precautions: p.precautions ? p.precautions.join(', ') : '',
    focusAreas: json(p.tags || []),
    immediateRelief: false,
    crisisEligible: false,
    requiredEquipment: json([]),
    environment: json(['home']),
    timeOfDay: json(['morning', 'evening', 'night']),
    sensoryEngagement: json(['body']),
    tags: p.tags ? p.tags.join(',') : '',
    isPublished: true,
    sourceName: 'ManaSarathi Curated',
    sourceUrl: p.mediaUrl,
    audioUrl: p.format === 'Audio' ? p.mediaUrl : null,
    // Note: the schema doesn't have a videoUrl on Practice model, so we omit it or put it in sourceUrl
    confidence: 0.95
  };
});

// --- Consolidated Therapist Directory (Indian & US) ---
const therapistEntries: Array<Prisma.TherapistUncheckedCreateInput> = [
  // India-based Therapists
  {
    id: 'therapist-demo-in-ananya-rao',
    name: 'Dr. Ananya Rao',
    credential: 'PSYCHOLOGIST',
    title: 'Clinical Psychologist, PhD',
    bio: `${DEMO_THERAPIST_NOTICE} Focuses on CBT, anxiety, depression, academic stress, and culturally sensitive care for young adults in urban contexts.`,
    specialtiesJson: json(['Anxiety', 'Depression', 'Academic Stress', 'CBT', 'Mindfulness']),
    email: 'demo.ananya.rao@example.com',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'IN',
    acceptsInsurance: false,
    insurances: json([]),
    sessionFee: 2000,
    offersSliding: true,
    yearsExperience: 8,
    languages: 'English, Kannada, Hindi',
    isVerified: true,
    isActive: true
  },
  {
    id: 'therapist-demo-in-kabir-mehta',
    name: 'Kabir Mehta',
    credential: 'PSYCHOLOGIST',
    title: 'Counselling Psychologist, MA',
    bio: `${DEMO_THERAPIST_NOTICE} Specializes in relationship counseling, queer-affirmative therapy, self-esteem issues, and life transitions.`,
    specialtiesJson: json(['Relationship Counselling', 'LGBTQ+ Affirmative', 'Self-Esteem', 'CBT']),
    email: 'demo.kabir.mehta@example.com',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'IN',
    acceptsInsurance: false,
    insurances: json([]),
    sessionFee: 1800,
    offersSliding: true,
    yearsExperience: 6,
    languages: 'English, Hindi, Gujarati',
    isVerified: true,
    isActive: true
  },
  {
    id: 'therapist-demo-in-meera-iyer',
    name: 'Dr. Meera Iyer',
    credential: 'PSYCHIATRIST',
    title: 'Consultant Psychiatrist, MD',
    bio: `${DEMO_THERAPIST_NOTICE} 12+ years of experience in pharmacological management of clinical disorders integrated with supportive psychotherapy.`,
    specialtiesJson: json(['Pharmacotherapy', 'Bipolar Disorder', 'Severe Depression', 'Anxiety Disorders']),
    email: 'demo.meera.iyer@example.com',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'IN',
    acceptsInsurance: true,
    insurances: json(['MediAssist', 'ICICI Lombard']),
    sessionFee: 2500,
    offersSliding: false,
    yearsExperience: 12,
    languages: 'English, Tamil, Hindi',
    isVerified: true,
    isActive: true
  },
  {
    id: 'therapist-demo-in-nisha-verma',
    name: 'Nisha Verma',
    credential: 'LMFT',
    title: 'Systemic Family Therapist, Post-Grad Diploma',
    bio: `${DEMO_THERAPIST_NOTICE} Focuses on systemic family therapy, parenting challenges, adolescent behavioral patterns, and couples conflicts.`,
    specialtiesJson: json(['Family Therapy', 'Couples Therapy', 'Adolescent Support', 'Parenting']),
    email: 'demo.nisha.verma@example.com',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'IN',
    acceptsInsurance: false,
    insurances: json([]),
    sessionFee: 2200,
    offersSliding: true,
    yearsExperience: 9,
    languages: 'English, Hindi, Punjabi',
    isVerified: true,
    isActive: true
  },
  // US-based Therapists
  {
    id: 'therapist-demo-us-sarah-johnson',
    name: 'Dr. Sarah Johnson',
    credential: 'PSYCHOLOGIST',
    title: 'Clinical Psychologist, PhD',
    bio: `${DEMO_THERAPIST_NOTICE} Specializes in CBT and mindfulness-based interventions with 15+ years of experience helping clients manage anxiety, depression, and stress.`,
    specialtiesJson: json(['Anxiety', 'Depression', 'Stress Management', 'CBT', 'Mindfulness']),
    email: 'demo-sarah-johnson@manasarthi.app',
    city: 'San Francisco',
    state: 'CA',
    country: 'US',
    acceptsInsurance: true,
    insurances: json(['Blue Shield', 'Aetna']),
    sessionFee: 150,
    offersSliding: true,
    yearsExperience: 15,
    languages: 'English, Spanish',
    isVerified: true,
    isActive: true
  },
  {
    id: 'therapist-demo-us-michael-chen',
    name: 'Michael Chen, LCSW',
    credential: 'LCSW',
    title: 'Licensed Clinical Social Worker',
    bio: `${DEMO_THERAPIST_NOTICE} Specializes in trauma-informed care and EMDR therapy for individuals who have experienced trauma, PTSD, grief, and relationship issues.`,
    specialtiesJson: json(['Trauma', 'PTSD', 'EMDR', 'Grief', 'Relationship Issues']),
    email: 'demo-michael-chen@manasarthi.app',
    city: 'Los Angeles',
    state: 'CA',
    country: 'US',
    acceptsInsurance: true,
    insurances: json(['Kaiser', 'Cigna']),
    sessionFee: 120,
    offersSliding: true,
    yearsExperience: 10,
    languages: 'English, Mandarin',
    isVerified: true,
    isActive: true
  },
  {
    id: 'therapist-demo-us-emily-rodriguez',
    name: 'Dr. Emily Rodriguez',
    credential: 'PSYCHIATRIST',
    title: 'Board-Certified Psychiatrist, MD',
    bio: `${DEMO_THERAPIST_NOTICE} Expertise in medication management for depression, anxiety, bipolar disorder. Takes a holistic approach combining medication with therapy referrals.`,
    specialtiesJson: json(['Medication Management', 'Depression', 'Anxiety', 'Bipolar Disorder']),
    email: 'demo-emily-rodriguez@manasarthi.app',
    city: 'New York',
    state: 'NY',
    country: 'US',
    acceptsInsurance: true,
    insurances: json(['UnitedHealthcare', 'Empire BCBS']),
    sessionFee: 200,
    offersSliding: false,
    yearsExperience: 12,
    languages: 'English, Spanish',
    isVerified: true,
    isActive: true
  },
  {
    id: 'therapist-demo-us-jessica-williams',
    name: 'Jessica Williams, LMFT',
    credential: 'LMFT',
    title: 'Licensed Marriage and Family Therapist',
    bio: `${DEMO_THERAPIST_NOTICE} Specializes in couples therapy, family therapy, and relationship counseling with a collaborative, strengths-based approach.`,
    specialtiesJson: json(['Couples Therapy', 'Family Therapy', 'Relationship Issues', 'Communication']),
    email: 'demo-jessica-williams@manasarthi.app',
    city: 'Seattle',
    state: 'WA',
    country: 'US',
    acceptsInsurance: true,
    insurances: json(['Premera', 'Regence']),
    sessionFee: 140,
    offersSliding: true,
    yearsExperience: 8,
    languages: 'English',
    isVerified: true,
    isActive: true
  }
];

// --- Consolidated Crisis / Mental Safety Resources ---
const crisisResourceEntries: Prisma.CrisisResourceCreateManyInput[] = [
  // US Resources
  { name: '988 Suicide & Crisis Lifeline', type: 'HOTLINE', phoneNumber: '988', website: 'https://988lifeline.org/', description: 'Free and confidential support for people in distress, 24/7.', availability: '24/7', country: 'US', language: 'English, Spanish', order: 1, tags: 'suicide prevention, crisis hotline, 24/7' },
  { name: 'Crisis Text Line', type: 'TEXT_LINE', textNumber: '741741', website: 'https://www.crisistextline.org/', description: 'Free, 24/7 support via text message. Text "HELLO" to 741741.', availability: '24/7', country: 'US', language: 'English', order: 2, tags: 'text support, crisis text, 24/7' },
  { name: 'SAMHSA National Helpline', type: 'HOTLINE', phoneNumber: '1-800-662-4357', website: 'https://www.samhsa.gov/find-help/national-helpline', description: 'Treatment referral and information for mental health and substance use disorders.', availability: '24/7', country: 'US', language: 'English, Spanish', order: 3, tags: 'substance abuse, mental health, treatment referral' },
  { name: '911 Emergency Services', type: 'EMERGENCY', phoneNumber: '911', description: 'For immediate life-threatening emergencies. Call if someone is in immediate danger.', availability: '24/7', country: 'US', language: 'English', order: 8, tags: 'emergency, 911, immediate danger' },
  // India Resources
  { name: 'Tele MANAS', type: 'HOTLINE', phoneNumber: '14416', website: 'https://telemanas.mohfw.gov.in/', description: 'National Tele Mental Health Programme — free, confidential counseling in 20+ languages.', availability: '24/7', country: 'IN', language: 'Hindi, English, 20+ regional languages', order: 1, tags: 'mental health, counseling, government, 24/7' },
  { name: 'iCall Psychosocial Helpline', type: 'HOTLINE', phoneNumber: '9152987821', website: 'https://icallhelpline.org/', description: 'Free professional counseling by TISS for emotional distress.', availability: 'Mon-Sat 8am-10pm IST', country: 'IN', language: 'English, Hindi, Marathi', order: 2, tags: 'counseling, emotional support, professional' },
  { name: 'Vandrevala Foundation Helpline', type: 'HOTLINE', phoneNumber: '1860-2662-345', website: 'https://www.vandrevalafoundation.com/', description: 'Free, professional, multilingual mental health support 24/7.', availability: '24/7', country: 'IN', language: 'English, Hindi, and regional languages', order: 3, tags: 'crisis, suicide prevention, multilingual, 24/7' },
  { name: 'Emergency Services India', type: 'EMERGENCY', phoneNumber: '112', description: 'Unified emergency number for police, fire, and ambulance in India.', availability: '24/7', country: 'IN', language: 'Hindi, English', order: 4, tags: 'emergency, 112, immediate danger' },
  // UK Resources
  { name: 'Samaritans', type: 'HOTLINE', phoneNumber: '116 123', website: 'https://www.samaritans.org/', description: 'Free, confidential emotional support 24/7/365.', availability: '24/7', country: 'UK', language: 'English, Welsh', order: 1, tags: 'emotional support, crisis, suicide prevention, 24/7' },
  { name: 'Shout Crisis Text Line', type: 'TEXT_LINE', textNumber: '85258', website: 'https://giveusashout.org/', description: 'Free, confidential, 24/7 text support. Text SHOUT to 85258.', availability: '24/7', country: 'UK', language: 'English', order: 2, tags: 'text support, crisis, mental health, 24/7' },
  { name: '999 Emergency Services', type: 'EMERGENCY', phoneNumber: '999', description: 'For immediate life-threatening emergencies in the UK.', availability: '24/7', country: 'UK', language: 'English', order: 4, tags: 'emergency, 999, immediate danger' },
  // Canada Resources
  { name: '988 Suicide Crisis Helpline', type: 'HOTLINE', phoneNumber: '988', website: 'https://988.ca/', description: 'Canada\'s national suicide crisis helpline. Call or text 988 for 24/7 support.', availability: '24/7', country: 'CA', language: 'English, French', order: 1, tags: 'suicide prevention, crisis, 24/7' },
  { name: '911 Emergency Services (Canada)', type: 'EMERGENCY', phoneNumber: '911', description: 'For immediate life-threatening emergencies in Canada.', availability: '24/7', country: 'CA', language: 'English, French', order: 4, tags: 'emergency, 911, immediate danger' },
  // Australia Resources
  { name: 'Lifeline Australia', type: 'HOTLINE', phoneNumber: '13 11 14', textNumber: '0477 13 11 14', website: 'https://www.lifeline.org.au/', description: 'Free, 24-hour crisis support and suicide prevention.', availability: '24/7', country: 'AU', language: 'English', order: 1, tags: 'crisis support, suicide prevention, 24/7' },
  { name: 'Beyond Blue', type: 'HOTLINE', phoneNumber: '1300 22 4636', website: 'https://www.beyondblue.org.au/', description: 'Support for anxiety, depression, and suicide prevention 24/7.', availability: '24/7', country: 'AU', language: 'English', order: 2, tags: 'anxiety, depression, mental health, 24/7' },
  { name: '000 Emergency Services', type: 'EMERGENCY', phoneNumber: '000', description: 'For immediate life-threatening emergencies in Australia.', availability: '24/7', country: 'AU', language: 'English', order: 4, tags: 'emergency, 000, immediate danger' },
  // Global Website Directories
  {
    name: 'FindaHelpline (Global Directory)',
    type: 'WEBSITE',
    website: 'https://findahelpline.com/',
    description: 'Free global directory to find mental health, suicide prevention, domestic violence, and crisis helplines by country.',
    availability: '24/7 (directory access)',
    country: 'GLOBAL',
    language: 'Multiple languages',
    order: 90,
    tags: 'global, directory, free, crisis resources'
  },
  {
    name: 'Befrienders Worldwide (Global Directory)',
    type: 'WEBSITE',
    website: 'https://www.befrienders.org/',
    description: 'Free international directory of emotional support and suicide prevention helplines across many countries.',
    availability: '24/7 (directory access)',
    country: 'GLOBAL',
    language: 'Multiple languages',
    order: 91,
    tags: 'global, suicide prevention, emotional support, free'
  }
];

// --- FAQs ---
const faqEntries: Prisma.FAQCreateManyInput[] = [
  { question: 'How do I get started with the Mental Wellbeing AI App?', answer: 'Getting started is easy! First, create an account or log in. Then, take one of our initial assessments to help us understand your mental health needs. Based on your results, we\'ll recommend personalized practices, content, and resources.', category: 'GENERAL', order: 1, tags: 'onboarding, getting started, beginner', createdBy: 'system' },
  { question: 'Is my personal information and mental health data secure?', answer: 'Yes, we take your privacy very seriously. All your data is encrypted both in transit and at rest. We never share your personal information or assessment results with third parties without your explicit consent.', category: 'PRIVACY', order: 2, tags: 'privacy, security, data protection', createdBy: 'system' },
  { question: 'How accurate are the mental health assessments?', answer: 'Our assessments are based on clinically validated scales (PHQ-9 for depression, GAD-7 for anxiety, etc.). While they provide valuable insights, they are not diagnostic tools. Always consult with a qualified mental health professional for an official diagnosis.', category: 'ASSESSMENTS', order: 3, tags: 'assessments, accuracy, validation', createdBy: 'system' },
  { question: 'Can the AI chatbot replace therapy?', answer: 'No, our AI chatbot is designed to provide support, coping strategies, and mindfulness exercises—not to replace professional therapy. If you\'re experiencing severe mental health issues, please reach out to a licensed therapist or crisis hotline.', category: 'CHATBOT', order: 4, tags: 'chatbot, therapy, limitations', createdBy: 'system' },
  { question: 'What if I\'m in a mental health crisis?', answer: 'If you\'re experiencing a mental health crisis, please contact emergency services immediately (911 in the US) or reach out to a crisis hotline. You can find crisis resources in the Help & Safety section under "Crisis Resources".', category: 'SAFETY', order: 5, tags: 'crisis, emergency, safety', createdBy: 'system' },
  { question: 'How much does the app cost?', answer: 'We offer both free and premium plans. The free plan includes basic assessments, mood tracking, and limited content access. Premium plans unlock personalized recommendations, unlimited AI chatbot conversations, advanced analytics, and priority support.', category: 'BILLING', order: 6, tags: 'pricing, subscription, premium', createdBy: 'system' },
  { question: 'The app is not loading properly. What should I do?', answer: 'Try these steps: 1) Clear your browser cache and cookies, 2) Make sure you\'re using an updated browser, 3) Check your internet connection, 4) Try logging out and back in. If issues persist, contact support.', category: 'TECHNICAL', order: 7, tags: 'troubleshooting, loading issues, technical', createdBy: 'system' },
  { question: 'Can I delete my account and data?', answer: 'Yes, you have full control over your data. Go to Settings > Account > Delete Account. This will permanently remove all your personal information, assessment results, and activity history. This action cannot be undone.', category: 'PRIVACY', order: 8, tags: 'account deletion, data removal, GDPR', createdBy: 'system' }
];

// --- Seeding Actions ---
async function seedAssessmentLibrary() {
  console.log('  📊 Seeding assessment instruments...');
  for (const seed of ASSESSMENT_SEEDS) {
    await prisma.assessmentDefinition.create({
      data: {
        id: seed.id,
        name: seed.name,
        type: seed.type,
        category: seed.category,
        description: seed.description,
        timeEstimate: seed.timeEstimate,
        timeframe: seed.timeframe,
        isActive: seed.isActive ?? true,
        isBasicOverallOnly: seed.isBasicOverallOnly ?? false,
        visibleInMainList: seed.visibleInMainList ?? true,
        tags: seed.tags || 'all',
        scoringConfig: json(seed.scoringConfig),
        questions: {
          create: seed.questions.map((q) => ({
            id: q.id,
            text: q.text,
            order: q.order,
            responseType: q.responseType,
            domain: q.domain || null,
            reverseScored: q.reverseScored || false,
            options: {
              create: q.options.map((o) => ({
                id: o.id,
                value: o.value,
                text: o.text,
                order: o.order
              }))
            }
          }))
        }
      }
    });
  }

  // Create composite screening
  await prisma.assessmentDefinition.create({
    data: {
      id: BASIC_OVERALL_SEED.id,
      name: BASIC_OVERALL_SEED.name,
      type: BASIC_OVERALL_SEED.type,
      category: BASIC_OVERALL_SEED.category,
      description: BASIC_OVERALL_SEED.description,
      timeEstimate: BASIC_OVERALL_SEED.timeEstimate,
      timeframe: BASIC_OVERALL_SEED.timeframe,
      isActive: BASIC_OVERALL_SEED.isActive ?? true,
      isBasicOverallOnly: BASIC_OVERALL_SEED.isBasicOverallOnly ?? false,
      visibleInMainList: BASIC_OVERALL_SEED.visibleInMainList ?? true,
      tags: BASIC_OVERALL_SEED.tags || 'all',
      scoringConfig: json(BASIC_OVERALL_SEED.scoringConfig),
      questions: {
        create: BASIC_OVERALL_SEED.questions.map((q) => ({
          id: q.id,
          text: q.text,
          order: q.order,
          responseType: q.responseType,
          options: {
            create: q.options.map((o) => ({
              id: o.id,
              value: o.value,
              text: o.text,
              order: o.order
            }))
          }
        }))
      }
    }
  });
  console.log('  ✅ Assessment templates seeded.');
}

type UserProfileInput = {
  name: string;
  firstName: string;
  lastName: string;
  profilePhoto?: string;
  approach?: string;
  birthday?: Date;
  gender?: string;
  region?: string;
  language?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  dataConsent: boolean;
  clinicianSharing: boolean;
  isOnboarded: boolean;
};

async function upsertUser(
  email: string,
  plainPassword: string,
  role: 'ADMIN' | 'USER',
  profileData?: UserProfileInput
) {
  const normalizedEmail = email.toLowerCase().trim();
  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  const data = {
    email: normalizedEmail,
    password: hashedPassword,
    name: profileData?.name || email.split('@')[0],
    firstName: profileData?.firstName || null,
    lastName: profileData?.lastName || null,
    isEmailVerified: true,
    isOnboarded: profileData?.isOnboarded ?? false,
    dataConsent: profileData?.dataConsent ?? false,
    clinicianSharing: profileData?.clinicianSharing ?? false,
    profilePhoto: profileData?.profilePhoto || null,
    approach: profileData?.approach || 'hybrid',
    birthday: profileData?.birthday || null,
    gender: profileData?.gender || null,
    region: profileData?.region || null,
    language: profileData?.language || null,
    emergencyContact: profileData?.emergencyContact || null,
    emergencyPhone: profileData?.emergencyPhone || null
  };

  return prisma.user.upsert({
    where: { email: normalizedEmail },
    update: data,
    create: data
  });
}

async function seedPlanModules() {
  const planEntries = [
    {
      id: 'plan-foundations-of-calm',
      title: 'Foundations of Calm',
      description: 'Establish baseline breathwork and focus patterns to steady the nervous system.',
      type: 'meditation',
      duration: '7 Days',
      difficulty: 'Beginner',
      content: json([]),
      approach: 'hybrid',
      order: 1
    },
    {
      id: 'plan-mind-body-reset',
      title: 'Mind-Body Reset',
      description: 'Integrate physical release cues with cognitive rest practices.',
      type: 'therapy',
      duration: '14 Days',
      difficulty: 'Beginner',
      content: json([]),
      approach: 'hybrid',
      order: 2
    },
    {
      id: 'plan-confidence-in-action',
      title: 'Confidence in Action',
      description: 'Transition from grounding to exposure-aligned resilience steps.',
      type: 'therapy',
      duration: '10 Days',
      difficulty: 'Intermediate',
      content: json([]),
      approach: 'hybrid',
      order: 3
    }
  ];

  await prisma.planModule.createMany({ data: planEntries });
}

async function assignPlanModulesToUser(user: User) {
  const now = new Date();
  await prisma.userPlanModule.createMany({
    data: [
      {
        userId: user.id,
        moduleId: 'plan-foundations-of-calm',
        completed: false,
        progress: 0.28,
        completedAt: null
      },
      {
        userId: user.id,
        moduleId: 'plan-mind-body-reset',
        completed: false,
        progress: 0,
        completedAt: null
      }
    ]
  });
}

async function seedMoodEntriesForUser(userId: string) {
  const now = new Date();
  await prisma.moodEntry.createMany({
    data: [
      {
        userId,
        mood: 'Good',
        intensity: 6,
        notes: 'Steady morning following box breathing sequence.',
        createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        emotion: 'relaxed',
        emotionGroup: 'joy'
      },
      {
        userId,
        mood: 'Anxious',
        intensity: 4,
        notes: 'Midday worry cycle after work meeting. Felt tense.',
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        emotion: 'anxious',
        emotionGroup: 'fear'
      },
      {
        userId,
        mood: 'Great',
        intensity: 7,
        notes: 'Strong evening focus following loving kindness meditation.',
        createdAt: now,
        emotion: 'motivated',
        emotionGroup: 'joy'
      }
    ]
  });
}

async function seedProgressTrackingForUser(userId: string) {
  const now = new Date();
  await prisma.progressTracking.createMany({
    data: [
      {
        userId,
        metric: 'sleep',
        value: 7.5,
        date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        notes: 'Slept well after progressive muscle relaxation.'
      },
      {
        userId,
        metric: 'sleep',
        value: 5.8,
        date: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        notes: 'Interrupted sleep, woke up thinking.'
      },
      {
        userId,
        metric: 'sleep',
        value: 8.2,
        date: now,
        notes: 'Excellent deep sleep.'
      }
    ]
  });
}

async function seedAssessmentsForUser(userId: string) {
  const now = new Date();
  const responseTemplate = (values: number[]) =>
    JSON.stringify(
      values.reduce<Record<string, number>>((acc, value, index) => {
        acc[`q${String(index + 1).padStart(2, '0')}`] = value;
        return acc;
      }, {})
    );

  await prisma.assessmentResult.createMany({
    data: [
      {
        userId,
        assessmentType: 'anxiety_assessment',
        score: 52,
        responses: responseTemplate([2, 1, 3, 0, 2, 1, 2]),
        rawScore: 11,
        maxScore: 21,
        normalizedScore: 52,
        categoryScores: undefined,
        completedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        userId,
        assessmentType: 'stress_pss10',
        score: 45,
        responses: responseTemplate([2, 3, 1, 2, 2, 1, 3, 2, 1, 2]),
        rawScore: 18,
        maxScore: 40,
        normalizedScore: 45,
        categoryScores: undefined,
        completedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        userId,
        assessmentType: 'overthinking_ptq',
        score: 45,
        responses: responseTemplate([2, 1, 2, 3, 1, 2, 2, 1, 2, 3, 1, 2, 2, 1, 2]),
        rawScore: 27,
        maxScore: 60,
        normalizedScore: 45,
        categoryScores: undefined,
        completedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000)
      }
    ]
  });
}

async function seedAssessmentInsightForUser(userId: string) {
  const updatedAt = new Date();
  const summaryPayload = {
    history: [],
    insights: {
      byType: {
        anxiety_assessment: {
          latestScore: 52,
          previousScore: 60,
          change: -8,
          averageScore: 56,
          bestScore: 60,
          trend: 'improving',
          interpretation: 'Anxiety steadily trending downward thanks to consistent grounding rituals.',
          recommendations: [
            'Keep practicing guided diaphragmatic breathing twice a day.',
            'Schedule one confidence-building exposure this week.'
          ],
          lastCompletedAt: new Date(updatedAt.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          historyCount: 3,
          normalizedScore: 52,
          rawScore: 11,
          maxScore: 21,
          categoryBreakdown: {}
        }
      },
      aiSummary:
        'Your nervous system is recalibrating. Keep stacking the calming micro-habits—breathing resets, movement, and reframing—they are paying off. Consider adding a gratitude wrap-up at night to lock in progress.',
      overallTrend: 'improving',
      wellnessScore: {
        value: 76,
        method: 'advanced-average',
        updatedAt: updatedAt.toISOString()
      },
      updatedAt: updatedAt.toISOString()
    }
  };

  await prisma.assessmentInsight.create({
    data: {
      userId,
      summary: summaryPayload,
      overallTrend: 'improving',
      aiSummary: summaryPayload.insights.aiSummary,
      wellnessScore: summaryPayload.insights.wellnessScore?.value ?? 0,
      updatedAt,
      createdAt: updatedAt
    }
  });
}

// Type placeholder for user relation functions
interface User {
  id: string;
  email: string;
}

async function main() {
  console.log('🌱 Seeding database...');

  console.log('🧹 Clearing existing database records...');
  await prisma.assessmentInsight.deleteMany();
  await prisma.assessmentResult.deleteMany();
  await prisma.progressTracking.deleteMany();
  await prisma.moodEntry.deleteMany();
  await prisma.userPlanModule.deleteMany();
  await prisma.planModule.deleteMany();
  await prisma.therapist.deleteMany();
  await prisma.crisisResource.deleteMany();
  await prisma.fAQ.deleteMany();
  await prisma.content.deleteMany();
  await prisma.practice.deleteMany();
  await prisma.responseOption.deleteMany();
  await prisma.assessmentQuestion.deleteMany();
  await prisma.assessmentDefinition.deleteMany();
  await prisma.user.deleteMany();
  console.log('🧹 Cleanup complete.');

  // 1. Seed Library Assessment Templates
  await seedAssessmentLibrary();

  // 2. Seed practices, content, crisis resources, therapists, FAQs
  console.log('  🌿 Seeding practices catalog...');
  await prisma.practice.createMany({ data: practiceEntries });
  console.log(`  ✅ Created ${practiceEntries.length} practices.`);

  console.log('  📖 Seeding content resources...');
  await prisma.content.createMany({ data: contentEntries });
  console.log(`  ✅ Created ${contentEntries.length} content items.`);

  console.log('  🏥 Seeding crisis & emergency resources...');
  await prisma.crisisResource.createMany({ data: crisisResourceEntries });
  console.log(`  ✅ Created ${crisisResourceEntries.length} crisis helpline resources.`);

  console.log('  🛋️ Seeding therapists directory...');
  await prisma.therapist.createMany({ data: therapistEntries });
  console.log(`  ✅ Created ${therapistEntries.length} therapist profiles.`);

  console.log('  ❓ Seeding FAQs...');
  await prisma.fAQ.createMany({ data: faqEntries });
  console.log(`  ✅ Created ${faqEntries.length} FAQs.`);

  console.log('  📅 Seeding plan modules...');
  await seedPlanModules();
  console.log('  ✅ Seeded plan modules.');

  // 3. Seed users
  console.log('  👥 Seeding users...');
  
  const adminProfiles: Record<string, UserProfileInput> = {
    'admin@example.com': {
      name: 'Local Admin',
      firstName: 'Local',
      lastName: 'Admin',
      profilePhoto: 'https://avatars.githubusercontent.com/u/1?v=4',
      approach: 'hybrid',
      birthday: new Date('1985-03-18'),
      gender: 'female',
      region: 'North America',
      language: 'en-US',
      emergencyContact: 'Alex Taylor',
      emergencyPhone: '+1-555-201-3478',
      dataConsent: true,
      clinicianSharing: true,
      isOnboarded: true
    },
    'admin@mentalwellbeing.ai': {
      name: 'Demo Admin',
      firstName: 'Demo',
      lastName: 'Admin',
      profilePhoto: 'https://avatars.githubusercontent.com/u/2?v=4',
      approach: 'western',
      birthday: new Date('1990-11-05'),
      gender: 'male',
      region: 'Asia-Pacific',
      language: 'en-SG',
      emergencyContact: 'Jamie Lee',
      emergencyPhone: '+65-5550-1122',
      dataConsent: true,
      clinicianSharing: false,
      isOnboarded: true
    },
    'aditya123@gmail.com': {
      name: 'Aditya Gupta',
      firstName: 'Aditya',
      lastName: 'Gupta',
      profilePhoto: 'https://avatars.githubusercontent.com/u/3?v=4',
      approach: 'hybrid',
      birthday: new Date('2001-08-12'),
      gender: 'male',
      region: 'India',
      language: 'en-IN',
      emergencyContact: 'Gupta Sr.',
      emergencyPhone: '+91-9988776655',
      dataConsent: true,
      clinicianSharing: true,
      isOnboarded: true
    }
  };

  const demoProfiles: Record<string, UserProfileInput> = {
    'user@example.com': {
      name: 'Local User',
      firstName: 'Local',
      lastName: 'User',
      profilePhoto: 'https://avatars.githubusercontent.com/u/10?v=4',
      approach: 'hybrid',
      birthday: new Date('1995-05-15'),
      gender: 'male',
      region: 'North America',
      language: 'en-US',
      emergencyContact: 'Support Person',
      emergencyPhone: '+1-555-404-1122',
      dataConsent: true,
      clinicianSharing: false,
      isOnboarded: true
    },
    'user1@example.com': {
      name: 'Chris Evans',
      firstName: 'Chris',
      lastName: 'Evans',
      profilePhoto: 'https://avatars.githubusercontent.com/u/4?v=4',
      approach: 'hybrid',
      birthday: new Date('1992-06-13'),
      gender: 'male',
      region: 'North America',
      language: 'en-US',
      emergencyContact: 'Robert Downey',
      emergencyPhone: '+1-555-909-1234',
      dataConsent: true,
      clinicianSharing: true,
      isOnboarded: true
    },
    'testuser@example.com': {
      name: 'Jessica Chastain',
      firstName: 'Jessica',
      lastName: 'Chastain',
      profilePhoto: 'https://avatars.githubusercontent.com/u/5?v=4',
      approach: 'eastern',
      birthday: new Date('1988-02-24'),
      gender: 'female',
      region: 'Europe',
      language: 'en-GB',
      emergencyContact: 'Al Pacino',
      emergencyPhone: '+44-20-7946-0192',
      dataConsent: true,
      clinicianSharing: false,
      isOnboarded: true
    }
  };

  // Seed Admin Users
  for (const [email, profile] of Object.entries(adminProfiles)) {
    await upsertUser(email, 'admin123', 'ADMIN', profile);
  }
  console.log(`  ✅ Seeded ${Object.keys(adminProfiles).length} admin accounts.`);

  // Seed Demo Users & Activity Records
  for (const [email, profile] of Object.entries(demoProfiles)) {
    const user = await upsertUser(email, 'user123', 'USER', profile);
    await assignPlanModulesToUser(user);
    await seedMoodEntriesForUser(user.id);
    await seedProgressTrackingForUser(user.id);
    await seedAssessmentsForUser(user.id);
    await seedAssessmentInsightForUser(user.id);
  }
  console.log(`  ✅ Seeded ${Object.keys(demoProfiles).length} demo user accounts with historical data.`);

  console.log('\n🎉 Unified database seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
