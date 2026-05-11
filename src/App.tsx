/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  ClipboardCheck, 
  MousePointer2, 
  Sparkles, 
  ChevronRight, 
  Send, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  LayoutDashboard
} from 'lucide-react';
import { 
  Screen, 
  Message, 
  CareerSignal, 
  JourneyStep, 
  OpenAIProfileResponse,
  OpenAIRoundResponse,
  OpenAISummaryResponse,
  Mode,
  StoryUnderstanding
} from './types';
import { 
  JOURNEY_STEPS, 
  INITIAL_DATA_CARDS, 
  MOCK_PROFILE, 
  FIXED_QUESTIONS, 
  FALLBACK_RESPONSES,
  ROUNDS_DATA,
  MOCK_CAREER_PROFILE,
  CAREER_STORY_CONTEXT,
  CAREER_STORY_TEMPLATES,
  STORY_UNDERSTANDING_A,
  STORY_UNDERSTANDING_B
} from './constants';
import { 
  generateOpenAIProfileResponse,
  generateOpenAICorrectionResponse,
  generateOpenAIRoundResponse,
  generateOpenAIReviewResponse,
  generateOpenAIStoryUnderstanding,
  generateOpenAISupplementResponse,
  generateOpenAISummaryResponse,
} from './services/openaiService';

const QUICK_REPLIES = [
  '這很接近',
  '我想補充',
  '理解有點偏掉',
];

const QUICK_REPLY_ACCEPT = QUICK_REPLIES[0];
const QUICK_REPLY_SUPPLEMENT = QUICK_REPLIES[1];
const QUICK_REPLY_CORRECTION = QUICK_REPLIES[2];
const CONTINUE_NEXT_LABEL = '繼續下一題';
const CONTINUE_PROFILE_LABEL = '繼續產出輪廓';
const MAX_UNDERSTANDING_CONTENT_LENGTH = 220;
const STORY_UNDERSTANDING_BY_TEMPLATE = {
  strategy: STORY_UNDERSTANDING_A,
  growth: STORY_UNDERSTANDING_B,
} satisfies Record<string, StoryUnderstanding>;

type RoundAnswer = {
  round: number;
  stageName: string;
  question: string;
  answer: string;
  presetAnswer: string;
};

type UserCorrection = {
  round: number;
  type: 'supplement' | 'correction';
  content: string;
  createdAt: string;
};

const truncateText = (text: string, maxLength: number) =>
  text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;

const buildDeepUnderstanding = (
  response: OpenAIRoundResponse,
  fallback?: { title?: string; content?: string },
): { title: string; content: string } => {
  const fallbackCard = {
    title: response.understandingCard?.title || fallback?.title || '目前理解',
    content: response.understandingCard?.content || fallback?.content || '我先保留這輪理解，等你確認。',
  };

  if (!response.deeperInterpretation && !response.evidenceFromUser && !response.uncertainty) {
    return fallbackCard;
  }

  const sections = [
    response.deeperInterpretation,
    response.evidenceFromUser ? `依據：${response.evidenceFromUser}` : '',
    response.uncertainty ? `待確認：${response.uncertainty}` : '',
  ].filter(Boolean);

  return {
    title: fallbackCard.title,
    content: truncateText(sections.join('\n\n'), MAX_UNDERSTANDING_CONTENT_LENGTH),
  };
};

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [mode, setMode] = useState<Mode>('mock');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [signals, setSignals] = useState<CareerSignal[]>([]);
  
  // Debug State
  const [debugInfo, setDebugInfo] = useState<any>({
    lastPayload: null,
    rawResponse: "handled by backend endpoint",
    parsedResponse: null,
    isUsingFallback: false,
    fallbackReason: null
  });
  const [showDebug, setShowDebug] = useState(false);

  const fallbackByRound: Record<number, any> = Object.fromEntries(
    ROUNDS_DATA.map((round, index) => [
      index + 1,
      {
        aiMessage: round.mockResponse,
        understandingCard: {
          title: '目前理解',
          content: round.mockResponse,
        },
        summaryUnderstanding: [
          ROUNDS_DATA[0]?.mockResponse,
          ROUNDS_DATA[1]?.mockResponse,
          ROUNDS_DATA[2]?.mockResponse,
        ].filter(Boolean),
        signalsToAdd: round.mockSignals,
      },
    ]),
  );
  fallbackByRound[6] = {
    aiMessage: '已用展示資料產出職涯價值觀輪廓。',
    careerProfile: MOCK_CAREER_PROFILE,
  };

  const normalizeSignals = (rawSignals: any): CareerSignal[] => {
    if (!rawSignals) return [];
    
    let list: any[] = [];
    if (Array.isArray(rawSignals)) {
      list = rawSignals;
    } else if (rawSignals.signals && Array.isArray(rawSignals.signals)) {
      list = rawSignals.signals;
    } else if (rawSignals.tags && Array.isArray(rawSignals.tags)) {
      list = rawSignals.tags;
    } else {
      return [];
    }

    return list.map(s => {
      // Handle string array
      if (typeof s === 'string') {
        return { type: 'confirm', label: s.substring(0, 12) };
      }
      
      // Handle object
      let type: any = s.type || 'confirm';
      const label = String(s.label || '').trim();
      
      if (!label) return null;

      // Normalize type
      const t = String(type).toLowerCase();
      if (['strength', 'positive', 'value', 'fit'].includes(t)) type = 'positive';
      else if (['warning', 'risk', 'concern', 'avoid'].includes(t)) type = 'risk';
      else if (['check', 'confirm', 'question', 'unknown'].includes(t)) type = 'confirm';
      else type = 'confirm';

      return {
        type: type as any,
        label: label.substring(0, 12)
      };
    }).filter(Boolean) as CareerSignal[];
  };

  const addSignals = (newSignals: any) => {
    const raw = newSignals || [];
    
    let normalized = normalizeSignals(raw);

    // Fallback logic for signals if needed
    if (normalized.length === 0 && fallbackByRound[currentStep]?.signalsToAdd) {
      normalized = fallbackByRound[currentStep].signalsToAdd;
    } else if (normalized.length === 0 && currentStep === 6 && fallbackByRound[6]?.careerProfile?.signals) {
      normalized = fallbackByRound[6].careerProfile.signals;
    }

    setSignals(prev => {
      const merged = [...prev, ...normalized];
      // Dedupe by label
      const unique: CareerSignal[] = [];
      const seenLabels = new Set();
      
      for (const signal of merged) {
        if (!seenLabels.has(signal.label)) {
          seenLabels.add(signal.label);
          unique.push(signal);
        }
      }
      
      return unique.slice(0, 12);
    });
  };

  const [isTyping, setIsTyping] = useState(false);
  const [typingMessage, setTypingMessage] = useState('正在思考...');
  const [userInput, setUserInput] = useState('');
  const [showCorrectionArea, setShowCorrectionArea] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<'supplement' | 'correction' | null>(null);
  const [careerProfile, setCareerProfile] = useState<OpenAIProfileResponse['careerProfile'] | null>(null);
  const [answers, setAnswers] = useState<RoundAnswer[]>([]);
  const [userCorrections, setUserCorrections] = useState<UserCorrection[]>([]);
  const [summaryUnderstanding, setSummaryUnderstanding] = useState<string[]>([]);
  const [deepInsight, setDeepInsight] = useState<OpenAISummaryResponse['deepInsight'] | null>(null);
  const [careerStoryText, setCareerStoryText] = useState('');
  const [storyUnderstanding, setStoryUnderstanding] = useState<StoryUnderstanding | null>(null);
  const [isStoryUnderstandingLoading, setIsStoryUnderstandingLoading] = useState(false);
  const [selectedStoryTemplate, setSelectedStoryTemplate] = useState<'strategy' | 'growth'>('strategy');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    const lastMessage = scrollRef.current?.lastElementChild as HTMLElement | null;
    lastMessage?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isTyping]);

  const addMessage = (msg: Message) => {
    setMessages(prev => {
      // Avoid duplicate IDs
      if (prev.find(m => m.id === msg.id)) {
        const newMsg = { ...msg, id: `${msg.id}-${Math.random().toString(36).substr(2, 5)}` };
        return [...prev, newMsg];
      }
      return [...prev, msg];
    });
  };

  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const resetDemo = (targetScreen: Screen = 'home') => {
    setScreen(targetScreen);
    setMessages([]);
    setCurrentStep(1);
    setSignals([]);
    setIsTyping(false);
    setTypingMessage('正在思考...');
    setUserInput(ROUNDS_DATA[0]?.presetAnswer || '');
    setShowCorrectionArea(false);
    setFeedbackMode(null);
    setCareerProfile(null);
    setAnswers([]);
    setUserCorrections([]);
    setSummaryUnderstanding([]);
    setDeepInsight(null);
    setCareerStoryText('');
    setStoryUnderstanding(null);
    setIsStoryUnderstandingLoading(false);
    setSelectedStoryTemplate('strategy');
    setDebugInfo({
      lastPayload: null,
      rawResponse: 'handled by backend endpoint',
      parsedResponse: null,
      isUsingFallback: false,
      fallbackReason: null,
      currentRound: 1,
      stageName: ROUNDS_DATA[0]?.stageName,
    });
  };

  useEffect(() => {
    if (!showCorrectionArea && !feedbackMode) {
      setUserInput(currentStep <= 4 ? ROUNDS_DATA[currentStep - 1]?.presetAnswer || '' : '');
    }
  }, [currentStep, showCorrectionArea, feedbackMode]);

  const startJourney = () => {
    resetDemo('initial_data');
  };

  const proceedToCareerStory = () => {
    setScreen('career_story');
  };

  const proceedToJourney = async (storyText = '') => {
    const normalizedStory = storyText.trim();
    const fallbackStoryUnderstanding =
      STORY_UNDERSTANDING_BY_TEMPLATE[selectedStoryTemplate] || STORY_UNDERSTANDING_A;

    setCareerStoryText(normalizedStory);
    setStoryUnderstanding(normalizedStory ? fallbackStoryUnderstanding : null);

    if (mode === 'openai' && normalizedStory) {
      setIsStoryUnderstandingLoading(true);
      try {
        const response = await generateOpenAIStoryUnderstanding({
          mockProfile: MOCK_PROFILE,
          currentRound: 0,
          stageName: '職涯故事暖身',
          question: '請整理使用者在正式 6 輪對話前提供的職涯故事。',
          goal: '產生後續判讀用的故事理解',
          presetAnswer: normalizedStory,
          actualUserAnswer: normalizedStory,
          previousAnswers: [],
          accumulatedSignals: [],
          careerStoryContext: CAREER_STORY_CONTEXT,
          careerStoryText: normalizedStory,
          storyUnderstanding: null,
        });

        setStoryUnderstanding(response.storyUnderstanding || fallbackStoryUnderstanding);
      } catch (error) {
        console.error(error);
        setStoryUnderstanding(fallbackStoryUnderstanding);
      } finally {
        setIsStoryUnderstandingLoading(false);
      }
    }

    setScreen('journey');
    triggerFirstRound();
  };

  const triggerFirstRound = () => {
    setCurrentStep(1);
    addMessage({
      id: generateId(),
      role: 'ai',
      content: (FIXED_QUESTIONS as any)[1],
      stepId: 1
    });
  };

  const upsertAnswer = (answer: RoundAnswer) => {
    setAnswers(prev => [...prev.filter(item => item.round !== answer.round), answer].sort((a, b) => a.round - b.round));
  };

  const structuredAnswers = (override?: RoundAnswer) =>
    ROUNDS_DATA.slice(0, 4).map((round, index) => {
      const roundNumber = index + 1;
      const saved = override?.round === roundNumber ? override : answers.find(item => item.round === roundNumber);
      return {
        round: roundNumber,
        stageName: round.stageName,
        question: round.question,
        answer: saved?.answer || '',
        presetAnswer: round.presetAnswer || '',
      };
    });

  const buildFallbackSummaryForCurrentStory = (correctionsForRequest: UserCorrection[] = userCorrections) => {
    const answerText = structuredAnswers()
      .map(item => item.answer)
      .filter(Boolean)
      .join(' ');
    const correctionText = correctionsForRequest.map(item => item.content).join(' ');
    const sourceText = `${careerStoryText} ${storyUnderstanding?.storySummary || ''} ${answerText} ${correctionText}`;
    const includesAny = (terms: string[]) => terms.some(term => sourceText.includes(term));

    if (includesAny(['薪水', '薪資', '報酬', '付出', '回報', '好累', '錢', '待遇'])) {
      return {
        aiMessage: '我先把目前理解整理成：你不是只在意數字，而是在確認付出、責任與回報是否對等。',
        summaryUnderstanding: [
          '你可能在意貢獻是否被合理定價，而不是單純追求高薪。',
          '當責任、投入與回報不匹配時，長期下來容易形成耗損。',
          '下一步需要確認：你期待的是更高報酬，還是更清楚的責任邊界與價值承認。',
        ],
        signalsToAdd: [
          { type: 'confirm' as const, label: '回報對等' },
          { type: 'risk' as const, label: '長期耗損' },
          { type: 'positive' as const, label: '貢獻定價' },
        ],
      };
    }

    if (includesAny(['完美主義', '焦慮', '標準', '品質', '不確定'])) {
      return {
        aiMessage: '我先把目前理解整理成：你需要清楚的成功標準與品質界線，否則不確定性容易變成壓力。',
        summaryUnderstanding: [
          '你可能重視品質與完整性，但更需要知道怎樣算是足夠好。',
          '標準模糊、責任很重或無法校準期待時，容易把壓力集中到自己身上。',
          '下一步需要確認：你需要的是更高標準，還是更可討論的品質界線。',
        ],
        signalsToAdd: [
          { type: 'confirm' as const, label: '成功標準' },
          { type: 'risk' as const, label: '焦慮壓力' },
          { type: 'positive' as const, label: '品質界線' },
        ],
      };
    }

    if (includesAny(['混亂', '方法', '救火', '系統化', '流程', '沉澱', '可複用'])) {
      return {
        aiMessage: '我先把目前理解整理成：你有投入感的地方，是把混亂整理成可複用的方法，而不是一直救火。',
        summaryUnderstanding: [
          '你可能重視系統化與流程沉澱，喜歡把模糊或混亂整理成可交接的方法。',
          '如果工作長期只是救火，沒有時間形成方法或改善結構，你會很快耗損。',
          '下一步需要確認：你想要的是更穩定的流程，還是能主導整理方法的空間。',
        ],
        signalsToAdd: [
          { type: 'positive' as const, label: '系統化' },
          { type: 'risk' as const, label: '長期救火' },
          { type: 'confirm' as const, label: '方法沉澱' },
        ],
      };
    }

    if (selectedStoryTemplate === 'growth' || includesAny(['主管', '相信', '信任', '更難', '成長', '能力被看見', '安全小任務'])) {
      return {
        aiMessage: '我先把目前理解整理成：你在意的不只是任務內容，而是能力能否被看見、被信任並往下一層成長。',
        summaryUnderstanding: [
          '你可能重視主管是否信任你的判斷，並願意讓你承擔更難的題目。',
          '細碎、低挑戰或成果不可見的任務，容易讓你覺得能力停在原地。',
          '下一步需要確認：你期待的成長，是更大責任、更高難度，還是更明確的授權。',
        ],
        signalsToAdd: [
          { type: 'positive' as const, label: '被信任' },
          { type: 'positive' as const, label: '成長曲線' },
          { type: 'confirm' as const, label: '授權範圍' },
        ],
      };
    }

    return {
      aiMessage: '我先根據目前故事與前四輪回答整理一版理解，請你確認哪裡接近、哪裡需要修正。',
      summaryUnderstanding: [
        '你可能重視能參與問題定義，而不只是完成拆好的執行任務。',
        '高責任低授權、問題被迴避或只有表面協作時，容易造成耗損。',
        '下一步需要確認：你期待的是策略參與、架構整理，還是更清楚的決策脈絡。',
      ],
      signalsToAdd: [
        { type: 'positive' as const, label: '問題定義' },
        { type: 'risk' as const, label: '低授權' },
        { type: 'confirm' as const, label: '策略參與' },
      ],
    };
  };

  const handleAnswerSubmit = async (manualInput?: string) => {
    if (currentStep > 4) return;

    const round = ROUNDS_DATA[currentStep - 1];
    const inputToProcess = manualInput ?? userInput ?? '';
    if (!inputToProcess.trim()) return;

    const currentMsg = inputToProcess.trim();
    const answerRecord = {
      round: currentStep,
      stageName: round.stageName,
      question: round.question,
      answer: currentMsg,
      presetAnswer: round.presetAnswer || '',
    };
    upsertAnswer(answerRecord);
    setUserInput('');
    addMessage({
      id: generateId(),
      role: 'user',
      content: currentMsg,
      stepId: currentStep
    });

    setIsTyping(true);
    setTypingMessage(mode === 'openai' ? 'OpenAI 正在產生短理解...' : '正在整理你的回答...');
    
    // Debug info update
    setDebugInfo((prev: any) => ({
      ...prev,
      currentRound: currentStep,
      stageName: round.stageName,
      question: round.question,
      presetAnswer: round.presetAnswer,
      isUsingFallback: false,
      fallbackReason: null
    }));

    const addFixedRoundResponse = (isFallback = false) => {
      const roundData = ROUNDS_DATA[currentStep - 1];

      addMessage({
        id: generateId(),
        role: 'ai',
        content: roundData.mockResponse,
        type: 'understanding',
        understanding: {
          title: '目前理解',
          content: roundData.mockResponse
        },
        options: QUICK_REPLIES,
        stepId: currentStep,
        isFallback
      });

      if (roundData.mockSignals) {
        addSignals(roundData.mockSignals);
      }
    };

    if (mode === 'mock') {
      setTimeout(() => {
        setIsTyping(false);
        addFixedRoundResponse(false);
      }, 700);
      return;
    }

    const payload = {
      mockProfile: MOCK_PROFILE,
      currentRound: currentStep,
      stageName: round.stageName,
      question: round.question,
      goal: round.goal,
      presetAnswer: round.presetAnswer,
      actualUserAnswer: currentMsg,
      previousAnswers: structuredAnswers(answerRecord),
      accumulatedSignals: signals,
      careerStoryContext: CAREER_STORY_CONTEXT,
      careerStoryText,
      storyUnderstanding
    };

    setDebugInfo((prev: any) => ({ ...prev, lastPayload: payload }));

    try {
      const response = await generateOpenAIRoundResponse(payload);

      if (!response?.aiMessage || !response?.understandingCard || !response?.signalsToAdd) {
        throw new Error('Incomplete OpenAI light insight response');
      }

      setIsTyping(false);
      setDebugInfo((prev: any) => ({
        ...prev,
        rawResponse: 'handled by backend endpoint',
        parsedResponse: response,
        isUsingFallback: false,
        fallbackReason: null
      }));

      addMessage({
        id: generateId(),
        role: 'ai',
        content: response.aiMessage,
        type: 'understanding',
        understanding: buildDeepUnderstanding(response, fallbackByRound[currentStep].understandingCard),
        options: QUICK_REPLIES,
        stepId: currentStep,
        isOpenAI: true
      });

      addSignals(response.signalsToAdd);
    } catch (error) {
      console.error(error);
      setIsTyping(false);
      setDebugInfo((prev: any) => ({ ...prev, isUsingFallback: true, fallbackReason: String(error) }));
      addFixedRoundResponse(true);
    }
  };

  const applyRoundFallback = (reason?: string) => {
    const fallback = fallbackByRound[currentStep];
    const roundData = ROUNDS_DATA[currentStep - 1];
    addSignals(roundData?.mockSignals || fallback.signalsToAdd);

    setDebugInfo((prev: any) => ({ ...prev, isUsingFallback: true, fallbackReason: reason }));

    if (currentStep <= 4) {
      addMessage({
        id: generateId(),
        role: 'ai',
        content: roundData?.mockResponse || fallback.aiMessage || '我先用展示資料保留這輪理解，避免畫面中斷。',
        type: 'understanding',
        understanding: fallback.understandingCard || {
          title: '目前理解',
          content: roundData?.mockResponse || fallback.aiMessage || '我先用展示資料保留這輪理解。'
        },
        options: QUICK_REPLIES,
        stepId: currentStep,
        isFallback: true
      });
    } else if (currentStep === 5) {
      addMessage({
        id: generateId(),
        role: 'ai',
        content: roundData?.mockResponse || fallback.aiMessage,
        type: 'summary',
        summaryList: fallback.summaryUnderstanding,
        options: QUICK_REPLIES,
        stepId: 5,
        isFallback: true
      });
    }
  };

  const generateSummaryForRound5 = async (
    correctionsForRequest: UserCorrection[] = userCorrections,
    isUpdate = false,
  ) => {
    const round = ROUNDS_DATA[4];
    const fallback = buildFallbackSummaryForCurrentStory(correctionsForRequest);

    setCurrentStep(5);
    setUserInput('');
    setShowCorrectionArea(false);
    setFeedbackMode(null);
    setIsTyping(true);
    setTypingMessage(mode === 'openai' ? 'OpenAI 正在整理前四輪回答...' : '正在整理前四輪理解...');

    const addFallbackSummary = (isFallback = false, fallbackReason?: string, payloadForDebug?: unknown) => {
      addSignals(fallback.signalsToAdd || round?.mockSignals);
      console.log("=== ROUND 5 SUMMARY DEBUG ===");
      console.log("mode:", mode);
      console.log("isOpenAIMode:", mode === "openai");
      console.log("careerStoryText:", careerStoryText);
      console.log("storyUnderstanding:", storyUnderstanding);
      console.log("previousAnswers:", answers);
      console.log("userCorrections:", correctionsForRequest);
      console.log("signals:", signals);
      console.log("summary payload:", payloadForDebug || null);
      console.log("summary raw response:", null);
      console.log("summary parsed response:", fallback);
      console.log("using fallback:", isFallback, fallbackReason || (isFallback ? 'OpenAI unavailable or incomplete response' : null));
      addMessage({
        id: generateId(),
        role: 'ai',
        content: fallback.aiMessage || round?.mockResponse || '我先整理目前理解，請你確認準不準。',
        type: 'summary',
        summaryList: fallback.summaryUnderstanding,
        options: isUpdate ? [CONTINUE_PROFILE_LABEL] : QUICK_REPLIES,
        stepId: 5,
        isFallback,
      });
      setSummaryUnderstanding(fallback.summaryUnderstanding || []);
      setDeepInsight(null);
    };

    if (mode === 'mock') {
      setTimeout(() => {
        setIsTyping(false);
        addFallbackSummary(false);
      }, 1000);
      return;
    }

    let payloadForFallbackDebug: unknown = null;
    try {
      const previousAnswers = structuredAnswers();
      const payload = {
        mockProfile: MOCK_PROFILE,
        mode: 'summary' as const,
        currentRound: 5,
        stageName: round.stageName,
        question: round.question,
        goal: round.goal,
        presetAnswer: round.presetAnswer,
        actualUserAnswer: '',
        previousAnswers,
        accumulatedSignals: signals,
        userCorrections: correctionsForRequest,
        careerStoryContext: CAREER_STORY_CONTEXT,
        careerStoryText,
        storyUnderstanding
      };
      payloadForFallbackDebug = payload;

      console.log("=== ROUND 5 SUMMARY DEBUG ===");
      console.log("mode:", mode);
      console.log("isOpenAIMode:", mode === "openai");
      console.log("careerStoryText:", careerStoryText);
      console.log("storyUnderstanding:", storyUnderstanding);
      console.log("previousAnswers:", previousAnswers);
      console.log("userCorrections:", correctionsForRequest);
      console.log("signals:", signals);
      console.log("summary payload:", payload);
      setDebugInfo((prev: any) => ({ ...prev, currentRound: 5, lastPayload: payload }));

      const response = await generateOpenAISummaryResponse(payload);

      console.log("summary raw response:", response);
      console.log("summary parsed response:", response);

      if (!response?.aiMessage || !response?.summaryUnderstanding || !response?.signalsToAdd) {
        throw new Error('Incomplete OpenAI summary response');
      }

      setIsTyping(false);
      setSummaryUnderstanding(response.summaryUnderstanding || []);
      setDeepInsight(response.deepInsight || null);
      setDebugInfo((prev: any) => ({
        ...prev,
        rawResponse: 'handled by backend endpoint',
        parsedResponse: response,
        isUsingFallback: false,
        fallbackReason: null
      }));
      console.log("using fallback:", false, null);

      addMessage({
        id: generateId(),
        role: 'ai',
        content: response.aiMessage,
        type: 'summary',
        summaryList: response.summaryUnderstanding,
        options: isUpdate ? [CONTINUE_PROFILE_LABEL] : QUICK_REPLIES,
        stepId: 5,
        isOpenAI: true
      });
      addSignals(response.signalsToAdd);
    } catch (error) {
      console.error(error);
      setIsTyping(false);
      setDebugInfo((prev: any) => ({ ...prev, isUsingFallback: true, fallbackReason: String(error) }));
      addFallbackSummary(true, String(error), typeof payloadForFallbackDebug === 'undefined' ? null : payloadForFallbackDebug);
    }
  };

  const handleOptionSelect = async (option: string) => {
    // Audit response to AI
    if (option === QUICK_REPLY_ACCEPT || option === CONTINUE_NEXT_LABEL || option === CONTINUE_PROFILE_LABEL) {
      addMessage({
        id: generateId(),
        role: 'user',
        content: option,
        stepId: currentStep
      });
      // Skip AI call, go to next round
      moveToNextRound();
      return;
    }

    addMessage({
      id: generateId(),
      role: 'user',
      content: option,
      stepId: currentStep
    });

    if (option === QUICK_REPLY_SUPPLEMENT || option === QUICK_REPLY_CORRECTION) {
      setFeedbackMode(option === QUICK_REPLY_SUPPLEMENT ? 'supplement' : 'correction');
      setShowCorrectionArea(true);
    } else {
      moveToNextRound();
    }
  };

  const moveToNextRound = async () => {
    setShowCorrectionArea(false);
    setFeedbackMode(null);
    setUserInput('');

    if (currentStep === 4) {
      await generateSummaryForRound5();
      return;
    }

    const nextStep = currentStep + 1;
    if (nextStep > 6) return;

    setCurrentStep(nextStep);

    // Question is fixed, no AI call here for problem generation
    const question = (FIXED_QUESTIONS as any)[nextStep];
    
    if (nextStep === 6) {
      if (mode === 'mock') {
        setIsTyping(true);
        setTypingMessage('正在產出職涯輪廓...');
        setTimeout(() => {
          setCareerProfile(MOCK_CAREER_PROFILE as any);
          if (MOCK_CAREER_PROFILE.signals) {
            addSignals(MOCK_CAREER_PROFILE.signals);
          }
          setIsTyping(false);
          setScreen('result');
        }, 1500);
        return;
      }

      setIsTyping(true);
      setTypingMessage('正在產出職涯價值觀輪廓...');
      
      try {
        const response = await generateOpenAIProfileResponse({
          mockProfile: MOCK_PROFILE,
          currentRound: 6,
          stageName: JOURNEY_STEPS[5].name,
          question: ROUNDS_DATA[5].question,
          goal: JOURNEY_STEPS[5].goal,
          presetAnswer: ROUNDS_DATA[5].presetAnswer || '產出職涯價值觀輪廓',
          actualUserAnswer: '',
          previousAnswers: structuredAnswers(),
          accumulatedSignals: signals,
          summaryUnderstanding,
          deepInsight,
          userCorrections,
          careerStoryContext: CAREER_STORY_CONTEXT,
          careerStoryText,
          storyUnderstanding
        });

        if (!response?.careerProfile) {
          throw new Error('Incomplete OpenAI profile response');
        }
        
        console.log("OpenAI parsed response (Round 6):", response);
        setCareerProfile(response.careerProfile);
        if (response.careerProfile?.signals) {
          addSignals(response.careerProfile.signals);
        }
        setIsTyping(false);
        setScreen('result');
      } catch (error) {
        console.error(error);
        setCareerProfile(MOCK_CAREER_PROFILE as any);
        addSignals(MOCK_CAREER_PROFILE.signals);
        setIsTyping(false);
        setScreen('result');
      }
    } else {
      addMessage({
        id: generateId(),
        role: 'ai',
        content: question,
        stepId: nextStep
      });
    }
  };

  const submitFeedback = async (activeFeedbackMode: 'supplement' | 'correction', correction: string) => {
    const correctionRecord: UserCorrection = {
      round: currentStep,
      type: activeFeedbackMode,
      content: correction,
      createdAt: new Date().toISOString(),
    };
    const nextCorrections = [...userCorrections, correctionRecord];
    setUserCorrections(nextCorrections);

    addMessage({
      id: generateId(),
      role: 'user',
      content: correction,
      stepId: currentStep
    });

    setIsTyping(true);
    setTypingMessage(activeFeedbackMode === 'supplement' ? '正在根據補充更新理解...' : '正在根據修正校正理解...');
    setShowCorrectionArea(false);

    const round = ROUNDS_DATA[currentStep - 1];

    if (currentStep === 5 && mode === 'openai') {
      setFeedbackMode(null);
      await generateSummaryForRound5(nextCorrections, true);
      return;
    }

    const fallbackMessage = {
      id: generateId(),
      role: 'ai' as const,
      content: activeFeedbackMode === 'supplement' ? '已根據你的補充更新理解。' : '已根據你的修正更新理解。',
      type: activeFeedbackMode === 'correction' ? 'correction' as const : 'understanding' as const,
      understanding: {
        title: '更新後理解',
        content: round?.mockResponse || '我先用展示資料更新這輪理解。'
      },
      correction: activeFeedbackMode === 'correction'
        ? { before: '原本理解可能太寬', after: round?.mockResponse || '已改以你的修正為準。' }
        : undefined,
      options: [currentStep === 5 ? CONTINUE_PROFILE_LABEL : CONTINUE_NEXT_LABEL],
      stepId: currentStep,
      isFallback: true
    };

    if (mode === 'mock') {
      setTimeout(() => {
        setIsTyping(false);
        addSignals(round?.mockSignals);
        addMessage(fallbackMessage);
        setFeedbackMode(null);
      }, 1000);
      return;
    }

    try {
      const currentAnswer = answers.find(item => item.round === currentStep)?.answer || '';
      const payload = {
        mockProfile: MOCK_PROFILE,
        currentRound: currentStep,
        stageName: round?.stageName || '',
        question: round?.question || '',
        goal: round?.goal || '',
        presetAnswer: round?.presetAnswer || '',
        actualUserAnswer: currentAnswer,
        supplementText: activeFeedbackMode === 'supplement' ? correction : '',
        correctionText: activeFeedbackMode === 'correction' ? correction : '',
        previousAnswers: structuredAnswers(),
        accumulatedSignals: signals,
        userCorrections: nextCorrections,
        careerStoryContext: CAREER_STORY_CONTEXT,
        careerStoryText,
        storyUnderstanding,
      };

      const response = activeFeedbackMode === 'supplement'
        ? await generateOpenAISupplementResponse(payload)
        : await generateOpenAICorrectionResponse(payload);

      if (!response?.aiMessage || !response?.understandingCard || !response?.signalsToAdd) {
        throw new Error('Incomplete OpenAI feedback response');
      }

      setIsTyping(false);
      addSignals(response.signalsToAdd);
      addMessage({
        id: generateId(),
        role: 'ai',
        content: response.aiMessage,
        type: activeFeedbackMode === 'correction' ? 'correction' : 'understanding',
        understanding: buildDeepUnderstanding(response, fallbackMessage.understanding),
        correction: activeFeedbackMode === 'correction'
          ? response.correction || fallbackMessage.correction
          : undefined,
        options: [currentStep === 5 ? CONTINUE_PROFILE_LABEL : CONTINUE_NEXT_LABEL],
        stepId: currentStep,
        isOpenAI: true,
      });
      setFeedbackMode(null);
    } catch (error) {
      console.error(error);
      setIsTyping(false);
      addSignals(round?.mockSignals);
      addMessage(fallbackMessage);
      setFeedbackMode(null);
    }
  };

  const handleSupplementSubmit = (text: string) => submitFeedback('supplement', text);
  const handleCorrectionSubmit = (text: string) => submitFeedback('correction', text);
  const handleFeedbackSubmit = (text: string) => (
    feedbackMode === 'correction' ? handleCorrectionSubmit(text) : handleSupplementSubmit(text)
  );

  return (
    <div className="min-h-screen bg-bg-primary text-text-main flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-line-light bg-white/50 backdrop-blur-md sticky top-0 z-50 shrink-0">
        <div className="header-inner h-full">
          <div className="flex items-center gap-4">
            <div className="text-xl font-serif font-bold tracking-tight text-text-main">104 <span className="text-accent-orange font-sans text-lg font-medium">AI 職涯價值觀輪廓</span></div>
            <div className="h-4 w-px bg-line-light"></div>
            <div className="flex items-center gap-2 bg-bg-warm px-2 py-1 rounded-full border border-line-light shadow-inner">
              <button 
                onClick={() => {
                  setMode(mode === 'mock' ? 'openai' : 'mock');
                  resetDemo('home');
                }}
                className="flex items-center gap-2 px-1"
              >
                <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${mode === 'mock' ? 'text-accent-orange' : 'text-text-sub opacity-40'}`}>
                  Mock
                </span>
                <div className={`w-9 h-5 rounded-full relative transition-all duration-300 shadow-sm ${mode === 'openai' ? 'bg-accent-orange' : 'bg-gray-300'}`}>
                  <motion.div 
                    className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-md"
                    initial={false}
                    animate={{ x: mode === 'openai' ? 16 : 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${mode === 'openai' ? 'text-accent-orange' : 'text-text-sub opacity-40'}`}>
                  OpenAI
                </span>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[9px] font-bold text-text-sub uppercase tracking-wider bg-white/80 px-2 py-1 rounded border border-line-light hidden lg:block">
              {mode === 'mock' ? 'MOCK 展示模式' : 'OPENAI 整合模式'}
            </div>
            {screen !== 'home' && (
              <button 
                onClick={() => resetDemo('home')}
                className="p-2 hover:bg-bg-warm rounded-full transition-colors"
              >
                <LayoutDashboard size={18} className="text-text-sub" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 w-full flex justify-center">
        <AnimatePresence mode="wait">
          {screen === 'home' && <HomeScreen onStart={startJourney} key="home" />}
          {screen === 'initial_data' && <InitialDataScreen onProceed={proceedToCareerStory} key="data" />}
          {screen === 'career_story' && (
            <CareerStoryWarmupScreen
              selectedStoryTemplate={selectedStoryTemplate}
              setSelectedStoryTemplate={setSelectedStoryTemplate}
              onUseStory={proceedToJourney}
              onSkip={() => proceedToJourney('')}
              isLoading={isStoryUnderstandingLoading}
              key="career-story"
            />
          )}
          {screen === 'journey' && (
            <JourneyScreen 
              currentStep={currentStep}
              mode={mode}
              messages={messages}
              signals={signals}
              isTyping={isTyping}
              typingMessage={typingMessage}
              userInput={userInput}
              setUserInput={setUserInput}
              onSend={handleAnswerSubmit}
              onOptionSelect={handleOptionSelect}
              showCorrectionArea={showCorrectionArea}
              setShowCorrectionArea={setShowCorrectionArea}
              feedbackMode={feedbackMode}
              setFeedbackMode={setFeedbackMode}
              onCorrectionSubmit={handleFeedbackSubmit}
              scrollRef={scrollRef}
              key="journey"
            />
          )}
          {screen === 'result' && (
            <ResultScreen 
              profile={careerProfile}
              signals={signals}
              careerStoryText={careerStoryText}
              storyUnderstanding={storyUnderstanding}
              onReview={() => setScreen('interview_review')}
              key="result"
            />
          )}
          {screen === 'interview_review' && (
            <InterviewReviewScreen 
              profile={careerProfile}
              mode={mode}
              careerStoryText={careerStoryText}
              storyUnderstanding={storyUnderstanding}
              onBack={() => setScreen('result')}
              key="review"
            />
          )}
        </AnimatePresence>
      </main>

      {/* Debug Panel Toggle */}
      <div className="fixed bottom-4 left-4 z-[60] flex items-center gap-2">
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="bg-gray-800 text-white text-[10px] px-3 py-1.5 rounded-full shadow-lg opacity-40 hover:opacity-100 transition-opacity flex items-center gap-2"
        >
          <LayoutDashboard size={12} />
          {showDebug ? '隱藏 Debug' : '顯示 Debug Info'}
        </button>
        {mode === 'openai' && (
          <div className="bg-blue-500 text-white text-[9px] px-3 py-1.5 rounded-full shadow-lg font-bold animate-pulse">
            OPENAI 整合模式
          </div>
        )}
      </div>

      {/* Debug Panel Content */}
      <AnimatePresence>
        {showDebug && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-14 left-4 z-[60] w-96 max-h-[70vh] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-y-auto p-4 text-[11px] font-mono text-gray-300"
          >
            <div className="flex items-center justify-between mb-4 border-b border-gray-700 pb-2">
              <span className="font-bold text-blue-400">Debug Panel</span>
              <button onClick={() => setShowDebug(false)} className="text-gray-500 hover:text-white">Close</button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-gray-500 mb-1 uppercase tracking-wider">Current Round</div>
                <div className="bg-black/30 p-2 rounded">
                  Round: {debugInfo.currentRound || currentStep}<br/>
                  Stage: {debugInfo.stageName || JOURNEY_STEPS[currentStep-1].name}<br/>
                  Goal: {JOURNEY_STEPS[currentStep-1].goal}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1 uppercase tracking-wider">Round Content</div>
                <div className="bg-black/30 p-2 rounded text-blue-200">
                  Question: {ROUNDS_DATA[currentStep-1].question}<br/><br/>
                  PresetAnswer: {ROUNDS_DATA[currentStep-1].presetAnswer}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1 uppercase tracking-wider">Mode & Fallback</div>
                <div className="bg-black/30 p-2 rounded">
                  Mode: {mode}<br/>
                  Using Fallback: {debugInfo.isUsingFallback ? 'YES' : 'NO'}<br/>
                  Fallback Reason: {debugInfo.fallbackReason || 'None'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 mb-1 uppercase tracking-wider">Last Payload sent to OpenAI Endpoint</div>
                <pre className="bg-black/30 p-2 rounded overflow-x-auto text-[10px]">
                  {JSON.stringify(debugInfo.lastPayload, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-gray-500 mb-1 uppercase tracking-wider">Parsed Response</div>
                <pre className="bg-black/30 p-2 rounded overflow-x-auto text-[10px]">
                  {JSON.stringify(debugInfo.parsedResponse, null, 2)}
                </pre>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Hint */}
      <footer className="p-4 text-center opacity-40 pointer-events-none">
        <p className="text-xs">Demo 使用 Mock Data 模擬既有資料來源；OpenAI 整合模式會在第 5 輪與第 6 輪整理理解與產出輪廓，不串正式推薦系統。</p>
      </footer>
    </div>
  );
}

// --- Component: Home Screen ---
function HomeScreen({ onStart }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="page-container max-w-4xl pt-20 flex flex-col items-center gap-16"
    >
      <div className="text-center space-y-6">
        <h2 className="text-5xl font-serif font-bold tracking-tight text-text-main leading-tight">重新理解你的<br/>職涯價值觀</h2>
        <p className="text-text-sub max-w-lg mx-auto leading-relaxed text-lg italic">
          先用既有資料建立初步線索，再透過六輪短問答校正你的職涯價值觀。
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-10 w-full mt-4">
        <div 
          onClick={onStart}
          className="bg-white border border-line-light rounded-2xl p-12 group cursor-pointer hover:border-accent-orange transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-accent-orange/5 transform hover:-translate-y-1"
        >
          <div className="bg-bg-orange-light w-14 h-14 rounded-2xl flex items-center justify-center mb-8 text-accent-orange group-hover:scale-110 transition-transform">
            <Sparkles size={28} />
          </div>
          <h3 className="text-2xl mb-4 font-bold">新人引導 Onboarding</h3>
          <p className="text-text-sub mb-10 leading-relaxed">
            從履歷、測驗與行為資料開始，建立一份可被補充與修正的職涯價值觀輪廓。
          </p>
          <div className="flex items-center text-accent-orange font-bold gap-2 group-hover:gap-4 transition-all">
            開始體驗 <ChevronRight size={20} />
          </div>
        </div>

        <div 
          onClick={onStart}
          className="bg-white border border-line-light rounded-2xl p-12 group cursor-pointer hover:border-accent-orange transition-all duration-500 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transform hover:-translate-y-1"
        >
          <div className="bg-bg-blue-light w-14 h-14 rounded-2xl flex items-center justify-center mb-8 text-blue-500 group-hover:scale-110 transition-transform">
            <ClipboardCheck size={28} />
          </div>
          <h3 className="text-2xl mb-4 font-bold">面試後回饋 / 推薦校正</h3>
          <p className="text-text-sub mb-10 leading-relaxed">
            面試後可以把新的感受回接到輪廓，讓推薦與面試判斷持續校正。
          </p>
          <div className="flex items-center text-blue-500 font-bold gap-2 group-hover:gap-4 transition-all">
            更新輪廓 <ChevronRight size={20} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Component: Initial Data Screen ---
function InitialDataScreen({ onProceed }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="page-container py-20 flex flex-col items-center"
    >
      <div className="text-center mb-16 space-y-3">
        <div className="text-[10px] uppercase tracking-[0.3em] text-text-sub font-bold">SIGNAL INTEGRATION</div>
        <h2 className="text-4xl font-serif font-bold">先整理既有資料</h2>
        <p className="text-text-sub">這裡模擬 104 既有履歷、測驗、行為與 AI 工具資料。</p>
      </div>

      <div className="initial-data-grid">
        {INITIAL_DATA_CARDS.map((card, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white border border-line-light p-8 rounded-2xl flex flex-col gap-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="bg-bg-warm w-12 h-12 rounded-xl flex items-center justify-center text-text-sub mb-2">
              {card.icon === 'FileText' && <FileText size={24} />}
              {card.icon === 'ClipboardCheck' && <ClipboardCheck size={24} />}
              {card.icon === 'MousePointer2' && <MousePointer2 size={24} />}
              {card.icon === 'Sparkles' && <Sparkles size={24} />}
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider">{card.title}</h4>
              <div className="space-y-2">
                {card.content.map((item, j) => (
                  <div key={j} className="text-sm text-text-sub flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-line-light shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-20 text-center space-y-10">
        <div className="max-w-md mx-auto p-6 bg-bg-warm/30 border border-line-light rounded-2xl italic text-sm text-text-sub leading-relaxed">
          這些資料只是起點，接下來會用固定六輪問題校正 AI 的理解。
        </div>
        <button 
          onClick={onProceed}
          className="px-12 py-5 bg-accent-orange text-white rounded-full font-bold hover:bg-opacity-90 transition-all transform hover:scale-105 shadow-xl shadow-accent-orange/20"
        >
          進入六輪問答
        </button>
      </div>
    </motion.div>
  );
}

function CareerStoryWarmupScreen({
  selectedStoryTemplate,
  setSelectedStoryTemplate,
  onUseStory,
  onSkip,
  isLoading,
}: any) {
  const initialTemplate =
    CAREER_STORY_TEMPLATES.find(template => template.id === selectedStoryTemplate) || CAREER_STORY_TEMPLATES[0];
  const [draftStory, setDraftStory] = useState(initialTemplate.content);

  const selectTemplate = (template: typeof CAREER_STORY_TEMPLATES[number]) => {
    setSelectedStoryTemplate(template.id);
    setDraftStory(template.content);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      className="page-container py-16 flex flex-col gap-12"
    >
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="text-[10px] uppercase tracking-[0.3em] text-text-sub font-bold">Career Story Warmup</div>
        <h2 className="text-4xl font-serif font-bold">先說說你的職涯故事</h2>
        <p className="text-text-sub leading-relaxed">
          這段內容會作為 AI 判讀背景，幫助後續 6 輪對話更貼近你的真實經驗。你可以直接使用範例，也可以修改成自己的版本。
        </p>
      </div>

      <div className="grid lg:grid-cols-[360px_minmax(0,720px)] gap-8 justify-center items-start">
        <div className="grid gap-4">
          {CAREER_STORY_TEMPLATES.map(template => {
            const selected = template.id === selectedStoryTemplate;
            return (
              <button
                key={template.id}
                onClick={() => selectTemplate(template)}
                disabled={isLoading}
                className={`text-left border rounded-2xl p-6 transition-all shadow-sm ${
                  selected
                    ? 'bg-bg-orange-light/60 border-accent-orange shadow-accent-orange/10'
                    : 'bg-white border-line-light hover:border-accent-orange/40'
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="font-bold text-text-main">{template.label}</h3>
                  {selected && (
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-orange">Selected</span>
                  )}
                </div>
                <p className="text-sm text-text-sub leading-relaxed">{template.fit}</p>
              </button>
            );
          })}
        </div>

        <div className="bg-white border border-line-light rounded-3xl shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-text-sub font-bold mb-2">Editable Story</div>
              <h3 className="text-xl font-bold">職涯故事背景</h3>
            </div>
            <div className="text-xs font-bold text-text-sub bg-bg-warm rounded-full px-3 py-1">
              {draftStory.length} / 400
            </div>
          </div>

          <textarea
            value={draftStory}
            maxLength={600}
            onChange={(event) => setDraftStory(event.target.value)}
            className="w-full min-h-[360px] bg-bg-warm/30 border border-line-light rounded-[1.8rem] p-6 text-[15px] leading-[1.8] resize-none focus:outline-none focus:ring-2 focus:ring-accent-orange/10 placeholder:text-text-sub/30"
            placeholder="寫一段你希望 AI 先知道的職涯背景..."
          />

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={onSkip}
              disabled={isLoading}
              className="px-7 py-4 rounded-full border border-line-light text-sm font-bold text-text-sub hover:text-text-main hover:bg-bg-warm transition-colors"
            >
              略過，直接開始
            </button>
            <button
              onClick={() => onUseStory(draftStory.trim())}
              disabled={isLoading}
              className="px-9 py-4 rounded-full bg-accent-orange text-white text-sm font-bold shadow-xl shadow-accent-orange/20 hover:bg-opacity-90 transition-all"
            >
              {isLoading ? '正在整理你的職涯故事…' : '使用這段故事開始'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- Component: Journey Screen ---
function JourneyScreen({ 
  currentStep, 
  mode,
  messages, 
  signals, 
  isTyping, 
  typingMessage,
  userInput, 
  setUserInput,
  onSend,
  onOptionSelect,
  showCorrectionArea,
  setShowCorrectionArea,
  feedbackMode,
  setFeedbackMode,
  onCorrectionSubmit,
  scrollRef
}: any) {
  const [correctionText, setCorrectionText] = useState('');
  const currentRoundData = ROUNDS_DATA[currentStep - 1];
  const hasComposer = currentStep <= 4 || showCorrectionArea;

  return (
    <div className="journey-layout min-h-[calc(100vh-4rem)] bg-bg-primary">
      {/* Left Interface: Progress */}
      <aside className="left-sidebar hidden lg:flex flex-col p-6 shrink-0 z-20 custom-scrollbar">
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-line-light shadow-xl shadow-black/5 p-8 space-y-10">
          <div className="text-[11px] uppercase tracking-[0.2em] text-text-sub font-bold border-b border-line-light pb-4">Journey Progress</div>
          <div className="flex flex-col gap-8">
            {JOURNEY_STEPS.map((step) => (
              <div key={step.id} className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] shrink-0 border transition-all duration-500 mt-1 ${
                  step.id < currentStep 
                    ? 'bg-text-main border-text-main text-white shadow-lg shadow-black/10' 
                    : step.id === currentStep 
                      ? 'border-2 border-accent-orange text-accent-orange font-bold ring-4 ring-bg-orange-light shadow-md shadow-accent-orange/10' 
                      : 'border-line-light text-text-sub opacity-30 shadow-sm'
                }`}>
                  {step.id < currentStep ? '✓' : step.id}
                </div>
                <div className="flex flex-col gap-1">
                  <span className={`text-sm ${step.id === currentStep ? 'font-bold text-text-main' : step.id < currentStep ? 'font-medium text-text-main' : 'text-text-sub opacity-30'}`}>
                    {step.name}
                  </span>
                  {step.id === currentStep && (
                    <motion.span 
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[10px] text-text-sub leading-relaxed mt-2 bg-bg-orange-light/30 p-3 rounded-xl border border-accent-orange/10"
                    >
                      {step.goal}
                    </motion.span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-line-light mt-10">
            <div className="p-5 bg-bg-warm/30 rounded-2xl border border-line-light text-[11px] leading-relaxed italic text-text-sub">
              每一輪只校正一件事：先理解，再補充，再決定要不要往下一步。
            </div>
          </div>
        </div>
      </aside>

      {/* Center: Conversation */}
      <section className="chat-column flex flex-col relative min-h-[calc(100vh-4rem)] bg-white/20 border-x border-line-light/40">
        {mode === 'openai' && currentStep <= 4 && (
          <div className="max-w-[820px] w-full mx-auto px-6 md:px-10 pt-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-sub bg-white/70 border border-line-light rounded-full px-4 py-2 inline-flex">
              OpenAI Light Insight：前四輪產生短理解，第五輪整合，第六輪產出輪廓。
            </div>
          </div>
        )}
        <div 
          ref={scrollRef}
          className="flex-1 w-full max-w-[820px] mx-auto px-6 md:px-10 pt-10 pb-[260px] space-y-10"
        >
          {messages.map((msg: any) => (
            <motion.div 
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-5 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md transform transition-transform hover:scale-110 ${
                msg.role === 'user' ? 'bg-text-main text-white' : 'bg-accent-orange text-white'
              }`}>
                <span className="text-[11px] font-bold">{msg.role === 'user' ? '你' : 'AI'}</span>
              </div>
              
              <div className={`flex flex-col max-w-[85%] min-w-0 ${msg.role === 'user' ? 'items-end' : ''}`}>
                {msg.type === 'understanding' && msg.understanding ? (
                  <div className="bg-white p-6 rounded-3xl rounded-tl-none border border-line-light shadow-lg shadow-black/5 space-y-5 relative break-words [overflow-wrap:anywhere] leading-[1.8]">
                    <p className="text-text-main whitespace-pre-wrap text-[15px] leading-[1.8]">{msg.content}</p>
                    <div className="p-5 bg-bg-orange-light/20 border-l-4 border-accent-orange rounded-r-2xl transform hover:translate-x-1 transition-transform">
                      <div className="text-[10px] font-bold text-accent-orange mb-2 uppercase tracking-[0.2em]">目前理解</div>
                      <p className="text-text-main text-sm font-medium whitespace-pre-wrap leading-[1.8] break-words [overflow-wrap:anywhere]">{msg.understanding.content}</p>
                    </div>
                  </div>
                ) : msg.type === 'summary' || msg.type === 'correction' ? (
                  <div className="bg-white p-6 rounded-3xl rounded-tl-none border border-line-light shadow-lg shadow-black/5 space-y-5 break-words [overflow-wrap:anywhere] leading-[1.8]">
                    <div className="p-5 bg-[#FDFCFB] border-l-4 border-accent-orange rounded-r-2xl">
                      <div className="text-[10px] font-bold text-accent-orange mb-3 uppercase tracking-[0.2em]">
                        {msg.type === 'correction' ? '修正理解' : '目前理解整理'}
                      </div>
                      <p className="whitespace-pre-wrap text-text-main leading-relaxed text-[15px] font-medium mb-6">{msg.content}</p>
                      
                      {msg.summaryList && msg.summaryList.length > 0 && (
                        <div className="space-y-4 border-t border-line-light pt-5">
                          {msg.summaryList.map((item: string, i: number) => (
                            <div key={i} className="flex gap-4 text-sm text-text-main leading-relaxed">
                              <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shrink-0 mt-2 shadow-sm" />
                              {item}
                            </div>
                          ))}
                        </div>
                      )}
                      {msg.correction && (
                        <div className="grid gap-3 border-t border-line-light pt-5">
                          <div className="rounded-2xl bg-bg-warm/60 border border-line-light p-4">
                            <div className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] mb-2">修正前</div>
                            <p className="text-sm text-text-sub leading-relaxed">{msg.correction.before}</p>
                          </div>
                          <div className="rounded-2xl bg-bg-orange-light/40 border border-accent-orange/10 p-4">
                            <div className="text-[10px] font-bold text-accent-orange uppercase tracking-[0.2em] mb-2">修正後</div>
                            <p className="text-sm text-text-main leading-relaxed">{msg.correction.after}</p>
                          </div>
                        </div>
                      )}
                      {msg.type === 'correction' && msg.understanding && (
                        <div className="border-t border-line-light pt-5">
                          <div className="text-[10px] font-bold text-accent-orange mb-2 uppercase tracking-[0.2em]">更新後理解</div>
                          <p className="text-text-main leading-relaxed text-sm font-medium">{msg.understanding.content}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`px-6 py-5 rounded-3xl shadow-sm border leading-[1.8] text-[15px] relative break-words [overflow-wrap:anywhere] ${
                    msg.role === 'user' 
                      ? 'bg-bg-blue-light border-blue-100 rounded-tr-none shadow-blue-500/5' 
                      : 'bg-white border-line-light rounded-tl-none shadow-black/5'
                  }`}>
                    {msg.stepId === 5 && msg.role === 'ai' ? (
                      <p className="font-serif italic text-lg leading-relaxed pt-2 text-[#4A4A4A]">{msg.content}</p>
                    ) : (
                      <p className="whitespace-pre-wrap pt-1">{msg.content}</p>
                    )}
                  </div>
                )}

                {msg.options && (
                  <div className="flex flex-wrap gap-2.5 mt-3 mb-8">
                    {(msg.options.length === QUICK_REPLIES.length ? QUICK_REPLIES : msg.options).map((opt: string) => (
                      <button 
                        key={opt}
                        onClick={() => onOptionSelect(opt)}
                        className="px-5 py-2 rounded-full border border-line-light bg-white text-xs font-bold transition-all hover:bg-bg-warm hover:border-accent-orange/30 shadow-sm active:scale-95 text-text-sub hover:text-text-main"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isTyping && (
            <div className="flex gap-5 items-start">
              <div className="w-10 h-10 rounded-full bg-accent-orange text-white flex items-center justify-center shrink-0 shadow-md animate-pulse">
                <span className="text-[11px] font-bold">AI</span>
              </div>
              <div className="bg-white px-8 py-5 rounded-3xl rounded-tl-none border border-line-light shadow-sm flex items-center gap-4">
                <div className="flex gap-1.5">
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-accent-orange rounded-full" />
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-accent-orange rounded-full" />
                  <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-accent-orange rounded-full" />
                </div>
                <span className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em]">{typingMessage}</span>
              </div>
            </div>
          )}

          <div aria-hidden="true" className={hasComposer ? 'h-[260px]' : 'h-12'} />
        </div>

        {/* Input: Merged Integrated Box */}
        <div className="sticky bottom-6 left-0 right-0 mt-8 p-6 md:p-10 pt-6 z-30 pointer-events-none">
          <div className="max-w-[820px] mx-auto pointer-events-auto">
            {!isTyping && currentStep <= 4 && !showCorrectionArea && (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-white/95 backdrop-blur-xl rounded-[2.5rem] border border-line-light shadow-2xl shadow-black/10 overflow-hidden ring-1 ring-black/5"
              >
                <div className="flex gap-4 p-4 items-end">
                  <div className="flex-1 px-4">
                    <textarea 
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && userInput.trim()) {
                          onSend(userInput);
                        }
                      }}
                      placeholder="輸入你的回答..."
                      rows={4}
                      className="w-full text-base focus:outline-none placeholder:text-text-sub/30 font-medium bg-transparent py-4 resize-none leading-[1.7] min-h-[120px]"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      const finalInput = userInput.trim();
                      if (finalInput) {
                        onSend(userInput);
                      }
                    }}
                    className="w-16 h-16 bg-text-main text-white rounded-[1.8rem] hover:bg-black transition-all flex items-center justify-center shrink-0 shadow-xl shadow-black/20 group active:scale-95"
                  >
                    <Send size={24} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}

            {showCorrectionArea && (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white/95 backdrop-blur-xl p-8 rounded-[2.5rem] border border-line-light shadow-2xl space-y-6"
              >
                <div className="flex items-center gap-3 px-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-orange animate-pulse" />
                  <span className="text-[11px] font-bold text-text-sub uppercase tracking-[0.2em]">
                    {feedbackMode === 'correction' ? '校正目前理解' : '補充更多脈絡'}
                  </span>
                </div>
                <textarea 
                  value={correctionText}
                  onChange={(e) => setCorrectionText(e.target.value)}
                  placeholder={feedbackMode === 'correction' ? '哪裡偏掉了？請直接告訴我更準確的說法。' : '你想補充什麼細節？可以寫一段具體情境。'}
                  className="w-full bg-bg-warm/30 border border-line-light rounded-[1.8rem] p-6 text-base min-h-[150px] shadow-inner focus:outline-none focus:ring-2 focus:ring-accent-orange/10 resize-none placeholder:text-text-sub/30"
                />
                <div className="flex justify-end gap-4">
                  <button 
                    onClick={() => {
                      setShowCorrectionArea(false);
                      setFeedbackMode(null);
                    }}
                    className="px-8 py-3 text-sm font-bold text-text-sub hover:text-text-main transition-colors"
                  >
                    取消
                  </button>
                  <button 
                    onClick={() => {
                      onCorrectionSubmit(correctionText);
                      setCorrectionText('');
                    }}
                    disabled={!correctionText.trim()}
                    className="bg-text-main text-white px-12 py-3 rounded-2xl text-sm font-bold hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-30"
                  >
                    送出更新
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Right Interface: Signals */}
      <aside className="right-sidebar hidden xl:flex flex-col p-6 shrink-0 z-20 custom-scrollbar">
        <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-line-light shadow-xl shadow-black/5 p-8 space-y-10">
          <div className="text-[11px] uppercase tracking-[0.2em] text-text-sub font-bold border-b border-line-light pb-4">Career Signals</div>
          <div className="space-y-10">
            <SignalGroup title="正向條件 (Signals)" signals={signals.filter(s => s.type === 'positive')} icon={<CheckCircle2 size={12} className="text-green-500" />} />
            <SignalGroup title="風險提醒 (Risks)" signals={signals.filter(s => s.type === 'risk')} icon={<AlertCircle size={12} className="text-orange-500" />} />
            <SignalGroup title="待確認 (Pending)" signals={signals.filter(s => s.type === 'confirm')} icon={<HelpCircle size={12} className="text-blue-500" />} />
            
            {signals.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center space-y-6 px-8 border-2 border-dashed border-line-light rounded-[2rem] bg-bg-warm/5 shadow-inner">
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-md border border-line-light text-accent-orange/40">
                  <Sparkles size={28} />
                </div>
                <div className="space-y-1">
                  <p className="text-[13px] text-text-main font-bold">尚未累積訊號</p>
                  <p className="text-[10px] leading-relaxed text-text-sub font-medium opacity-60">
                    送出回答後，系統會把理解轉成<br/>正向條件、風險提醒與待確認訊號
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <div className="bg-bg-warm/30 p-6 rounded-[1.8rem] border border-line-light mt-auto">
            <div className="text-[10px] font-bold mb-4 uppercase text-text-sub tracking-[0.2em] border-b border-line-light/50 pb-3">Data Integration</div>
            <div className="grid grid-cols-1 gap-3.5 text-[11px] text-text-sub font-medium">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-sm" />
                <span>104 履歷與偏好資料</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-sm" />
                <span>測驗與行為資料</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-sm" />
                <span>AI 工具摘要與回饋</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function SignalGroup({ title, signals, icon }: any) {
  if (signals.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[10px] font-bold text-text-sub uppercase tracking-tighter">
        {icon} {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {signals.map((s: any) => (
          <motion.span 
            key={s.label}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`px-3 py-1 rounded-full text-[11px] font-medium border ${
              s.type === 'positive' ? 'bg-bg-green-light border-green-100 text-green-700' :
              s.type === 'risk' ? 'bg-bg-orange-light border-orange-100 text-orange-700' :
              'bg-bg-blue-light border-blue-100 text-blue-700'
            }`}
          >
            {s.label}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function indexToStepColor(id: number, current: number) {
  if (id < current) return 'bg-accent-orange border-accent-orange text-white';
  if (id === current) return 'bg-bg-orange-light border-accent-orange text-accent-orange';
  return 'bg-white border-line-light text-text-sub';
}

function StoryUnderstandingBlock({ storyUnderstanding }: { storyUnderstanding: StoryUnderstanding | null }) {
  const storyCore =
    storyUnderstanding?.storySummary ||
    '尚未補充職涯故事，本次分析將以初始資料與 6 輪回答為主。';
  const likelyValues = storyUnderstanding?.likelyValues?.slice(0, 5) || [];
  const hypothesisFallback = storyUnderstanding?.possibleMisreadings?.slice(0, 2).map(
    item => `仍需確認：${item}`,
  );
  const hypotheses = storyUnderstanding?.hypothesesToVerify?.length
    ? storyUnderstanding.hypothesesToVerify.slice(0, 3)
    : hypothesisFallback?.length
      ? hypothesisFallback
      : ['後續將根據 6 輪回答逐步校正。'];

  return (
    <div className="md:col-span-2 rounded-2xl bg-bg-blue-light/40 border border-blue-100 p-6 space-y-6">
      <div>
        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-3">故事初步理解</div>
        <div className="rounded-2xl bg-white/70 border border-white/70 p-5">
          <div className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] mb-2">故事核心</div>
          <p className="text-sm leading-relaxed text-text-main">{storyCore}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white/70 border border-white/70 p-5">
          <div className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] mb-3">可能重視</div>
          {likelyValues.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {likelyValues.map(value => (
                <span key={value} className="px-3 py-1 rounded-full bg-bg-blue-light border border-blue-100 text-[11px] font-medium text-blue-700">
                  {value}
                </span>
              ))}
            </div>
          ) : (
            <span className="px-3 py-1 rounded-full bg-bg-warm border border-line-light text-[11px] font-medium text-text-sub">
              待整理
            </span>
          )}
        </div>

        <div className="rounded-2xl bg-white/70 border border-white/70 p-5">
          <div className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] mb-3">待確認假設</div>
          <div className="space-y-3">
            {hypotheses.map(item => (
              <div key={item} className="flex gap-3 text-sm leading-relaxed text-text-main">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0 mt-2" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Component: Result Screen ---
interface ResultScreenProps {
  onReview: () => void;
  profile: OpenAIProfileResponse['careerProfile'] | null;
  signals: CareerSignal[];
  careerStoryText: string;
  storyUnderstanding: StoryUnderstanding | null;
  key?: string;
}

function ResultScreen({ onReview, profile, signals, careerStoryText, storyUnderstanding }: ResultScreenProps) {
  if (!profile) return null;
  const displaySignals = signals.length > 0 ? signals : profile.signals || [];
  const storySummary = careerStoryText
    ? `${careerStoryText.slice(0, 120)}${careerStoryText.length > 120 ? '...' : ''}`
    : '本次未補充職涯故事，分析以初始資料與 6 輪回答為主。';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="result-page py-16 space-y-12"
    >
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1 bg-bg-orange-light text-accent-orange rounded-full text-[10px] font-bold uppercase tracking-widest border border-accent-orange/20">
          Career Profile Ready
        </div>
        <h2 className="text-5xl font-serif font-bold">你的職涯價值觀輪廓</h2>
      </div>

      {/* Core Card */}
      <div className="bg-white border border-line-light p-16 rounded-3xl relative overflow-hidden shadow-sm">
        <div className="absolute top-0 left-0 w-2 h-full bg-accent-orange shadow-[0_0_15px_rgba(233,130,58,0.3)]" />
        <div className="max-w-2xl space-y-12">
          <div className="space-y-6">
            <h3 className="text-text-sub uppercase tracking-[0.2em] text-[10px] font-bold border-b border-line-light pb-4 inline-block">核心價值敘述</h3>
            <p className="text-4xl font-serif italic font-medium leading-tight text-text-main">
              {profile.coreValueStatement}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 pt-12 border-t border-line-light">
            <div className="space-y-6">
              <h4 className="flex items-center gap-3 text-xs font-bold text-green-700 uppercase tracking-widest">
                <div className="w-6 h-6 rounded-full bg-bg-green-light flex items-center justify-center"><CheckCircle2 size={14} /></div>
                適合的環境
              </h4>
              <ul className="space-y-4 text-[15px] text-text-main leading-relaxed">
                {profile.suitableEnvironments.map((env, i) => (
                  <li key={i} className="flex gap-3"><span className="text-green-500">✓</span> {env}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-6">
              <h4 className="flex items-center gap-3 text-xs font-bold text-orange-700 uppercase tracking-widest">
                <div className="w-6 h-6 rounded-full bg-bg-orange-light flex items-center justify-center"><AlertCircle size={14} /></div>
                不適合的環境
              </h4>
              <ul className="space-y-4 text-[15px] text-text-main leading-relaxed">
                {profile.unsuitableEnvironments.map((env, i) => (
                  <li key={i} className="flex gap-3"><span className="text-orange-500">!</span> {env}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-line-light p-8 rounded-2xl shadow-sm space-y-5">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-sub">分析背景</h3>
        <div className="grid md:grid-cols-[240px_minmax(0,1fr)] gap-5 text-sm leading-relaxed">
          <div className="rounded-2xl bg-bg-warm/40 border border-line-light p-5">
            <div className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] mb-3">已整合資料來源</div>
            <p>履歷、測驗、行為、AI 工具摘要</p>
          </div>
          <div className="rounded-2xl bg-bg-orange-light/30 border border-accent-orange/10 p-5">
            <div className="text-[10px] font-bold text-accent-orange uppercase tracking-[0.2em] mb-3">使用者補充職涯故事</div>
            <p>{storySummary}</p>
          </div>
          <StoryUnderstandingBlock storyUnderstanding={storyUnderstanding} />
        </div>
      </div>

      <div className="bg-white border border-line-light p-10 rounded-2xl shadow-sm space-y-8">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-sub">本次累積的職涯訊號</h3>
        {displaySignals.length > 0 ? (
          <div className="grid md:grid-cols-3 gap-8">
            <SignalGroup title="正向條件" signals={displaySignals.filter(s => s.type === 'positive')} icon={<CheckCircle2 size={12} className="text-green-500" />} />
            <SignalGroup title="風險提醒" signals={displaySignals.filter(s => s.type === 'risk')} icon={<AlertCircle size={12} className="text-orange-500" />} />
            <SignalGroup title="面試待確認" signals={displaySignals.filter(s => s.type === 'confirm')} icon={<HelpCircle size={12} className="text-blue-500" />} />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line-light bg-bg-warm/30 px-6 py-8 text-sm text-text-sub text-center">
            本次對話尚未累積足夠訊號。
          </div>
        )}
      </div>

      {profile.reasoningSummary && (
        <div className="bg-white border border-line-light p-10 rounded-2xl shadow-sm space-y-6">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-sub">為什麼這樣判斷</h3>
          <div className="grid md:grid-cols-3 gap-5 text-sm leading-relaxed">
            <div className="rounded-2xl bg-bg-warm/40 border border-line-light p-5">
              <div className="text-[10px] font-bold text-text-sub uppercase tracking-[0.2em] mb-3">主要模式</div>
              <p>{profile.reasoningSummary.mainPattern}</p>
            </div>
            <div className="rounded-2xl bg-bg-orange-light/30 border border-accent-orange/10 p-5">
              <div className="text-[10px] font-bold text-accent-orange uppercase tracking-[0.2em] mb-3">關鍵依據</div>
              <p>{profile.reasoningSummary.keyEvidence}</p>
            </div>
            <div className="rounded-2xl bg-bg-blue-light/40 border border-blue-100 p-5">
              <div className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mb-3">仍需確認</div>
              <p>{profile.reasoningSummary.stillNeedToConfirm}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Recommendation Example */}
        <div className="bg-white border border-line-light p-10 rounded-2xl flex flex-col gap-8 shadow-sm">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-sub">推薦理由示例</h3>
          <div className="bg-bg-blue-light/40 p-8 rounded-2xl border border-blue-100/50 space-y-6 relative group overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles size={48} />
            </div>
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 bg-white rounded-xl border border-line-light flex items-center justify-center shrink-0 shadow-sm">
                <LayoutDashboard size={24} className="text-blue-500" />
              </div>
              <div>
                <p className="font-bold text-base">資料產品經理 - 推薦理由</p>
                <p className="text-[11px] text-text-sub font-mono uppercase tracking-widest">AI & Strategy</p>
              </div>
            </div>
            <p className="text-[15px] leading-relaxed text-text-main italic border-l-2 border-blue-300 pl-4 py-1">
              {profile.recommendationReasonExample}
              <br />
              <span className="text-sm font-bold text-orange-600 mt-2 block">風險提醒：{profile.riskReminder}</span>
            </p>
          </div>
        </div>

        {/* Interview Questions */}
        <div className="bg-white border border-line-light p-10 rounded-2xl flex flex-col gap-8 shadow-sm">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-sub">面試確認問題</h3>
          <div className="space-y-4">
            {profile.interviewQuestions.map((q, i) => (
              <div key={i} className="flex gap-4 items-center p-4 bg-bg-warm/40 border border-line-light/50 rounded-xl text-sm hover:translate-x-1 transition-transform cursor-default">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm text-accent-orange">
                  <MessageSquare size={14} />
                </div>
                <span className="font-medium">{q}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-6 pt-16">
        <button 
          onClick={onReview}
          className="px-14 py-6 bg-text-main text-white rounded-full font-bold hover:bg-black transition-all flex items-center gap-4 shadow-2xl shadow-text-main/20 transform hover:scale-105"
        >
          面試後更新輪廓 <ChevronRight size={20} />
        </button>
        <p className="text-[11px] text-text-sub uppercase tracking-[0.2em] font-bold opacity-60">Continuous profile evolution</p>
      </div>
    </motion.div>
  );
}

// --- Component: Interview Review Screen ---
interface InterviewReviewScreenProps {
  onBack: () => void;
  profile: any;
  mode: Mode;
  careerStoryText: string;
  storyUnderstanding: StoryUnderstanding | null;
  key?: string;
}

function InterviewReviewScreen({ onBack, profile, mode, careerStoryText, storyUnderstanding }: InterviewReviewScreenProps) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feeling, setFeeling] = useState('');
  const [concerns, setConcerns] = useState('');
  const [aiResponse, setAiResponse] = useState<any>(null);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = mode === 'mock'
        ? {
          aiMessage: '已把這次面試回饋整理成一個待確認訊號。',
          profileUpdateSummary: '這次面試感受可作為後續判斷職涯價值觀是否落地的補充線索。',
          signalsToAdd: [{ type: 'confirm', label: '面試感受' }]
        }
        : await generateOpenAIReviewResponse({
          mockProfile: { ...MOCK_PROFILE, currentCareerProfile: profile, interviewFeeling: feeling, concerns },
          currentRound: 6,
          stageName: '面試回饋',
          question: '這次面試後，你想把哪些感受回接到職涯價值觀輪廓？',
          goal: '回接面試判斷',
          presetAnswer: `${feeling}\n${concerns}`,
          actualUserAnswer: `${feeling}\n${concerns}`,
          previousAnswers: [feeling, concerns].filter(Boolean),
          accumulatedSignals: profile?.signals || [],
          careerStoryContext: CAREER_STORY_CONTEXT,
          careerStoryText,
          storyUnderstanding
        });
      setAiResponse(response);
      setSubmitted(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-2xl w-full px-6 py-20 flex flex-col items-center"
    >
      {!submitted ? (
        <div className="bg-white border border-line-light p-16 rounded-3xl w-full space-y-16 shadow-sm">
          <div className="space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-text-sub hover:text-text-main transition-colors text-xs font-bold uppercase tracking-widest mb-4">
              <ArrowLeft size={16} /> Back to Profile
            </button>
            <h2 className="text-4xl font-serif font-bold">面試後更新職涯輪廓</h2>
            <p className="text-text-sub leading-relaxed italic">
              把面試後的直覺、疑慮或新線索補回來，讓這份輪廓更貼近真實選擇。
            </p>
          </div>

          <div className="space-y-12">
            <div className="space-y-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-text-sub">這次面試後，你的整體感受比較接近哪一種？</h4>
              <div className="flex gap-4">
                {['更有興趣', '有點猶豫', '想先保留'].map(f => (
                  <button 
                    key={f}
                    onClick={() => setFeeling(f)}
                    className={`flex-1 px-4 py-5 rounded-2xl border text-sm font-bold transition-all ${
                      feeling === f ? 'border-accent-orange bg-bg-orange-light text-accent-orange' : 'border-line-light hover:bg-bg-warm'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-text-sub">你還想補充哪些面試觀察？</h4>
              <div className="bg-bg-warm p-2 rounded-2xl border border-line-light">
                <textarea 
                  value={concerns}
                  onChange={(e) => setConcerns(e.target.value)}
                  className="w-full p-4 bg-transparent border-none focus:ring-0 text-sm h-32 resize-none"
                  placeholder="例如：主管很重視問題定義，但決策好像偏 top-down..."
                />
              </div>
            </div>

            <button 
              onClick={handleSubmit}
              disabled={loading || !feeling}
              className="w-full py-6 bg-accent-orange text-white rounded-full font-bold shadow-2xl shadow-accent-orange/20 transform hover:scale-[1.02] transition-transform disabled:opacity-50"
            >
                {loading ? 'AI 整理中...' : '送出回饋，更新輪廓'}
            </button>
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white border border-line-light p-16 rounded-3xl text-center space-y-10 flex flex-col items-center shadow-sm"
        >
          <div className="w-24 h-24 bg-bg-green-light rounded-full flex items-center justify-center text-green-500 mb-4 shadow-inner">
            <CheckCircle2 size={48} />
          </div>
          <div className="space-y-4">
            <h3 className="text-3xl font-serif font-bold">已把面試回饋<br/>補入職涯輪廓</h3>
            <p className="text-text-sub">{aiResponse?.aiMessage || '這次回饋已整理成新的待確認訊號。'}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 max-w-sm">
            {(aiResponse?.signalsToAdd || aiResponse?.updatedSignals || []).map((s: any, i: number) => (
              <span key={i} className="px-5 py-2 bg-bg-blue-light border border-blue-100 text-blue-700 text-[11px] font-bold rounded-lg uppercase tracking-tight">
                {s.label}
              </span>
            ))}
            <span className="px-5 py-2 bg-text-main/5 border border-line-light text-text-sub text-[11px] font-bold rounded-lg uppercase tracking-tight">待確認</span>
          </div>
          <p className="text-xs text-text-sub italic px-8">{aiResponse?.profileUpdateSummary}</p>
          <button 
            onClick={onBack}
            className="mt-8 px-10 py-4 border border-line-light rounded-full text-xs font-bold uppercase tracking-widest hover:bg-bg-warm transition-all"
          >
            Back to Profile
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}
