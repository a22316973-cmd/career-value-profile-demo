import {
  CareerInsightRequest,
  CareerSignal,
  OpenAIProfileResponse,
  OpenAIReviewResponse,
  OpenAIRoundResponse,
  OpenAIStoryUnderstandingResponse,
  OpenAISummaryResponse,
  StoryUnderstanding,
} from '../types';

type RequestInput = Partial<CareerInsightRequest> & {
  currentRound: number;
  stageName?: string;
  roundName?: string;
  question?: string;
  goal?: string;
  roundGoal?: string;
  presetAnswer?: string;
  actualUserAnswer?: string;
  userAnswer?: string;
  supplementText?: string;
  correctionText?: string;
  previousAnswers?: unknown[];
  previousInsights?: string[];
  accumulatedSignals?: CareerSignal[];
  currentSignals?: CareerSignal[];
  mockProfile?: unknown;
  careerStoryContext?: string[];
  careerStoryText?: string;
  storyUnderstanding?: StoryUnderstanding | null;
  userCorrections?: unknown[];
  summaryUnderstanding?: string[];
  deepInsight?: unknown;
};

function buildRequest(mode: CareerInsightRequest['mode'], data: RequestInput): CareerInsightRequest {
  return {
    mode,
    currentRound: data.currentRound,
    stageName: data.stageName || data.roundName || '',
    question: data.question || '',
    goal: data.goal || data.roundGoal || '',
    presetAnswer: data.presetAnswer || data.userAnswer || '',
    actualUserAnswer: data.actualUserAnswer || data.userAnswer || data.presetAnswer || '',
    supplementText: data.supplementText || '',
    correctionText: data.correctionText || '',
    previousAnswers: data.previousAnswers || data.previousInsights || [],
    accumulatedSignals: data.accumulatedSignals || data.currentSignals || [],
    mockProfile: data.mockProfile || {},
    careerStoryContext: data.careerStoryContext || [],
    careerStoryText: data.careerStoryText || '',
    storyUnderstanding: data.storyUnderstanding || null,
    userCorrections: data.userCorrections || [],
    summaryUnderstanding: data.summaryUnderstanding || [],
    deepInsight: data.deepInsight || {},
  };
}

async function requestCareerInsight<T>(payload: CareerInsightRequest): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch('/api/career-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error('OpenAI request failed');
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function generateOpenAIRoundResponse(data: RequestInput): Promise<OpenAIRoundResponse> {
  return requestCareerInsight<OpenAIRoundResponse>(buildRequest('round', data));
}

export function generateOpenAIStoryUnderstanding(
  data: RequestInput,
): Promise<OpenAIStoryUnderstandingResponse> {
  return requestCareerInsight<OpenAIStoryUnderstandingResponse>(buildRequest('storyUnderstanding', data));
}

export function generateOpenAISummaryResponse(data: RequestInput): Promise<OpenAISummaryResponse> {
  return requestCareerInsight<OpenAISummaryResponse>(buildRequest('summary', data));
}

export function generateOpenAIProfileResponse(data: RequestInput): Promise<OpenAIProfileResponse> {
  return requestCareerInsight<OpenAIProfileResponse>(buildRequest('final', data));
}

export function generateOpenAISupplementResponse(data: RequestInput): Promise<OpenAIRoundResponse> {
  return requestCareerInsight<OpenAIRoundResponse>(buildRequest('supplement', data));
}

export function generateOpenAICorrectionResponse(data: RequestInput): Promise<OpenAIRoundResponse> {
  return requestCareerInsight<OpenAIRoundResponse>(buildRequest('correction', data));
}

export function generateOpenAIReviewResponse(data: RequestInput): Promise<OpenAIReviewResponse> {
  return requestCareerInsight<OpenAIReviewResponse>(buildRequest('interviewReview', data));
}
