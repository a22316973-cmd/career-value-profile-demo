export type Screen = 'home' | 'initial_data' | 'career_story' | 'journey' | 'result' | 'interview_review';
export type Mode = 'mock' | 'openai';
export type CareerInsightMode =
  | 'storyUnderstanding'
  | 'round'
  | 'summary'
  | 'supplement'
  | 'correction'
  | 'final'
  | 'interviewReview';

export interface Message {
  id: string;
  role: 'ai' | 'user';
  content: string;
  type?: 'text' | 'summary' | 'options' | 'correction' | 'understanding';
  options?: string[];
  stepId?: number;
  understanding?: {
    title: string;
    content: string;
  };
  summaryList?: string[];
  correction?: {
    before: string;
    after: string;
  };
  isOpenAI?: boolean;
  isFallback?: boolean;
}

export interface CareerSignal {
  type: 'positive' | 'risk' | 'confirm';
  label: string;
}

export interface StoryUnderstanding {
  storySummary: string;
  likelyValues: string[];
  riskSignals: string[];
  hypothesesToVerify: string[];
  possibleMisreadings: string[];
}

export interface CareerInsightRequest {
  mode: CareerInsightMode;
  currentRound: number;
  stageName: string;
  question: string;
  goal: string;
  presetAnswer: string;
  actualUserAnswer: string;
  supplementText: string;
  correctionText: string;
  previousAnswers: unknown[];
  accumulatedSignals: CareerSignal[];
  mockProfile: unknown;
  careerStoryContext: string[];
  careerStoryText: string;
  storyUnderstanding?: StoryUnderstanding | null;
  userCorrections?: unknown[];
  summaryUnderstanding?: string[];
  deepInsight?: unknown;
}

export interface OpenAIStoryUnderstandingResponse {
  storyUnderstanding: StoryUnderstanding;
}

export interface OpenAIRoundResponse {
  aiMessage: string;
  understandingCard?: {
    title: string;
    content: string;
  };
  followUpQuestion?: string;
  surfaceMeaning?: string;
  deeperInterpretation?: string;
  evidenceFromUser?: string;
  uncertainty?: string;
  signalsToAdd?: CareerSignal[];
  nextRoundAllowed?: boolean;
  nextActionLabel?: string;
  correction?: {
    before: string;
    after: string;
  };
}

export interface OpenAISummaryResponse {
  aiMessage: string;
  summaryUnderstanding: string[];
  deepInsight?: {
    surfacePattern: string;
    deeperPattern: string;
    evidence: string;
    uncertainty: string;
  };
  quickReplies?: string[];
  signalsToAdd?: CareerSignal[];
  correctionExample?: {
    before: string;
    after: string;
  };
  nextRoundAllowed: boolean;
}

export interface OpenAIProfileResponse {
  aiMessage: string;
  careerProfile: {
    coreValueStatement: string;
    suitableEnvironments: string[];
    unsuitableEnvironments: string[];
    recommendationReasonExample: string;
    riskReminder: string;
    interviewQuestions: string[];
    signals: CareerSignal[];
    reasoningSummary?: {
      mainPattern: string;
      keyEvidence: string;
      stillNeedToConfirm: string;
    };
  };
}

export interface JourneyStep {
  id: number;
  name: string;
  goal: string;
}

export interface OpenAIReviewResponse {
  aiMessage: string;
  signalsToAdd?: CareerSignal[];
  updatedSignals?: CareerSignal[];
  profileUpdateSummary: string;
}
