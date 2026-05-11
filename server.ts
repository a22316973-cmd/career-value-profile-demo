import 'dotenv/config';
import express from 'express';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

type JsonSchema = Record<string, unknown>;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '1mb' }));

const SYSTEM_INSTRUCTION = `你是「104 AI 職涯引導」。

你不負責問問題，問題已由前端固定提供。
你的任務是根據 Mock Data、使用者回答、前面累積回答與目前輪次，產出短小、精準、有洞察的小結。

你必須遵守：
1. 不得改寫題目。
2. 不得新增新流程。
3. 不得提前產出最終輪廓。
4. 不得直接推薦真實職缺。
5. 不得新增不存在的履歷、公司、測驗結果或行為資料。
6. 不得把推測寫成事實。
7. 不得使用心理診斷或人格診斷語氣。
8. 不要說「我理解你的感受」這種制式安慰語。
9. 每次回應要短。
10. 必須依照 JSON Schema 輸出。
11. 不輸出 Markdown。
12. 不輸出 HTML。
13. 不輸出多餘說明。

語氣：
溫和、克制、精準。
像資深職涯顧問，不像聊天機器人。

洞察方式：
不要只貼標籤。
請遵守：
具體故事 → 對比差異 → 提出假設 → 邀請使用者校正。

範例語氣：
「我不想直接把它整理成團隊合作。更精準地說，你在意的可能是：大家是不是都在認真想同一個問題。」

請不要每一輪都回到透明溝通、共同解決問題或自主權。你必須根據使用者本輪回答判斷不同價值訊號。若使用者回答與薪資、穩定、成就、學習、主管、團隊、職稱、工時有關，請分別做不同詮釋。

分類提示：
- 薪資 / 錢：貢獻被定價、安全感、價值被承認
- 主管：信任、授權、判斷是否被看見
- 團隊：合作方式、問題是否被共同面對
- 工時 / 壓力：負荷是否有意義、投入是否值得
- 職稱 / 大公司：外部認可、成長階梯、身份感
- 會議 / 流程：決策品質、效率、是否真正推進問題
- AI / 工具：是否能把模糊問題變成可討論版本`;

const DEEP_ANALYSIS_INSTRUCTION = `
你是「104 AI 職涯引導」。

你不負責問問題，問題已由前端固定提供。
你的任務是根據 Mock Data、careerStoryContext、使用者回答、前面累積回答與目前輪次，產出短小、精準、有洞察的小結。

你必須遵守：
1. 不得改寫題目。
2. 不得新增新流程。
3. 不得提前產出最終輪廓。
4. 不得直接推薦真實職缺。
5. 不得新增不存在的履歷、公司、測驗結果或行為資料。
6. 不得把推測寫成事實。
7. 不得使用心理診斷或人格診斷語氣。
8. 不要說「我理解你的感受」這種制式安慰語。
9. 每次回應要短。
10. 必須依照 JSON Schema 輸出。
11. 不輸出 Markdown。
12. 不輸出 HTML。
13. 不輸出多餘說明。

語氣：溫和、克制、精準，像資深職涯顧問，不像聊天機器人。

你的回應不可以只做分類或貼標籤。每次回應都要包含三層判斷：
1. 使用者表面上說了什麼。
2. 這背後可能真正重視的是什麼。
3. 這個推論來自哪個具體回答或前後對比。

請用「具體故事 → 對比差異 → 提出假設 → 邀請使用者校正」的方式分析。

請避免只說「你重視自主權」、「你重視透明溝通」、「你適合跨部門協作」，也不要每一輪都回到同一個價值觀。
請不要直接下定論，要把判斷寫成可校正假設。

當使用者回答很短，例如「錢變多」，請先承認答案很短，再提出可校正假設：
「這表面上是薪資，但可能不只是數字。它也可能代表你想確認自己的投入、責任與能力有沒有被合理定價。這樣理解接近嗎？」

當 actualUserAnswer 是「我有一點完美主義，這導致我焦慮」時，請優先回應完美主義、焦慮、品質標準、不確定性，不可回透明決策或共同解決問題。
可用方向：這句話的重點不是單純要求完美，而是可能很難接受標準模糊、成果不完整，或責任很大但判斷依據不清楚的狀態。
signalsToAdd 可包含「品質標準」、「焦慮壓力」、「成功標準」。

careerStoryContext 只能作為背景脈絡。若它與 actualUserAnswer 衝突，必須優先相信 actualUserAnswer。
careerStoryText 是使用者在正式對話前提供的職涯故事背景。它的優先級高於 mockProfile 與 careerStoryContext，但低於 actualUserAnswer 與 userCorrections。
如果 actualUserAnswer 與 careerStoryText 有衝突，請優先相信 actualUserAnswer，並把差異視為需要校正的地方。
storyUnderstanding 是 AI 對使用者職涯故事的初步理解。它可以幫助判讀，但不可覆蓋 actualUserAnswer。
如果 actualUserAnswer 和 storyUnderstanding 不一致，請優先處理 actualUserAnswer，並把差異列為待確認。

分析優先順序：
actualUserAnswer > userCorrections > storyUnderstanding > careerStoryText > previousAnswers > accumulatedSignals > mockProfile > careerStoryContext。

每次回應必須優先回應 actualUserAnswer 中明確出現的概念。
previousAnswers、accumulatedSignals、mockProfile、careerStoryContext 只能作為背景，不可覆蓋 actualUserAnswer。
如果 actualUserAnswer 和既有脈絡不同，請先處理 actualUserAnswer，再用一句話說明它可能如何補充既有輪廓。

回答順序必須是：
1. 先回應 actualUserAnswer 中最明確的概念。
2. 再做深層詮釋。
3. 再連回職涯輪廓。
4. 最後提出一個待確認問題。

請避免：
- 使用者提到完美主義，卻回透明溝通。
- 使用者提到薪資，卻回共同解決問題。
- 使用者提到焦慮，卻回主動權。
- 使用者提到主管，卻回跨部門協作。

當 payload.explicitConcepts 有內容時，必須優先使用 explicitConcepts[0] 的分析方向。不要從 previousAnswers 或 accumulatedSignals 的舊結論開始。

當使用者提到焦慮、憂鬱、完美主義等詞時，不要做心理診斷，不要使用醫療語氣。請只從工作情境、壓力來源、合作方式與職涯選擇條件來分析。
`;

const signalSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'label'],
  properties: {
    type: { type: 'string', enum: ['positive', 'risk', 'confirm'] },
    label: { type: 'string', maxLength: 12 },
  },
} satisfies JsonSchema;

const understandingCardSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'content'],
  properties: {
    title: { type: 'string', maxLength: 20 },
    content: { type: 'string', maxLength: 220 },
  },
} satisfies JsonSchema;

const signalsToAddSchema = {
  type: 'array',
  minItems: 1,
  maxItems: 3,
  items: signalSchema,
} satisfies JsonSchema;

const quickRepliesSchema = {
  type: 'array',
  minItems: 3,
  maxItems: 3,
  items: {
    type: 'string',
    enum: ['這很接近', '我想補充', '理解有點偏掉'],
  },
} satisfies JsonSchema;

const deepInsightSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['surfacePattern', 'deeperPattern', 'evidence', 'uncertainty'],
  properties: {
    surfacePattern: { type: 'string', maxLength: 100 },
    deeperPattern: { type: 'string', maxLength: 140 },
    evidence: { type: 'string', maxLength: 140 },
    uncertainty: { type: 'string', maxLength: 100 },
  },
} satisfies JsonSchema;

const storyUnderstandingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['storyUnderstanding'],
  properties: {
    storyUnderstanding: {
      type: 'object',
      additionalProperties: false,
      required: [
        'storySummary',
        'likelyValues',
        'riskSignals',
        'hypothesesToVerify',
        'possibleMisreadings',
      ],
      properties: {
        storySummary: { type: 'string', maxLength: 180 },
        likelyValues: {
          type: 'array',
          minItems: 2,
          maxItems: 5,
          items: { type: 'string', maxLength: 20 },
        },
        riskSignals: {
          type: 'array',
          minItems: 2,
          maxItems: 5,
          items: { type: 'string', maxLength: 20 },
        },
        hypothesesToVerify: {
          type: 'array',
          minItems: 2,
          maxItems: 5,
          items: { type: 'string', maxLength: 60 },
        },
        possibleMisreadings: {
          type: 'array',
          minItems: 1,
          maxItems: 4,
          items: { type: 'string', maxLength: 60 },
        },
      },
    },
  },
} satisfies JsonSchema;

const roundResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'aiMessage',
    'understandingCard',
    'followUpQuestion',
    'surfaceMeaning',
    'deeperInterpretation',
    'evidenceFromUser',
    'uncertainty',
    'signalsToAdd',
  ],
  properties: {
    aiMessage: { type: 'string', maxLength: 140 },
    understandingCard: understandingCardSchema,
    followUpQuestion: { type: 'string', maxLength: 60 },
    surfaceMeaning: { type: 'string', maxLength: 50 },
    deeperInterpretation: { type: 'string', maxLength: 100 },
    evidenceFromUser: { type: 'string', maxLength: 80 },
    uncertainty: { type: 'string', maxLength: 60 },
    signalsToAdd: signalsToAddSchema,
  },
} satisfies JsonSchema;

const supplementResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['aiMessage', 'understandingCard', 'signalsToAdd', 'nextActionLabel'],
  properties: {
    aiMessage: { type: 'string', maxLength: 120 },
    understandingCard: understandingCardSchema,
    signalsToAdd: signalsToAddSchema,
    nextActionLabel: { type: 'string', enum: ['繼續下一題'] },
  },
} satisfies JsonSchema;

const correctionResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['aiMessage', 'correction', 'understandingCard', 'signalsToAdd', 'nextActionLabel'],
  properties: {
    aiMessage: { type: 'string', maxLength: 120 },
    correction: {
      type: 'object',
      additionalProperties: false,
      required: ['before', 'after'],
      properties: {
        before: { type: 'string', maxLength: 60 },
        after: { type: 'string', maxLength: 100 },
      },
    },
    understandingCard: understandingCardSchema,
    signalsToAdd: signalsToAddSchema,
    nextActionLabel: { type: 'string', enum: ['繼續下一題'] },
  },
} satisfies JsonSchema;

const summaryResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['aiMessage', 'summaryUnderstanding', 'deepInsight', 'signalsToAdd', 'quickReplies', 'correctionExample'],
  properties: {
    aiMessage: { type: 'string', maxLength: 120 },
    summaryUnderstanding: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: { type: 'string', maxLength: 80 },
    },
    deepInsight: deepInsightSchema,
    signalsToAdd: signalsToAddSchema,
    quickReplies: quickRepliesSchema,
    correctionExample: {
      type: 'object',
      additionalProperties: false,
      required: ['before', 'after'],
      properties: {
        before: { type: 'string', maxLength: 60 },
        after: { type: 'string', maxLength: 100 },
      },
    },
  },
} satisfies JsonSchema;

const finalProfileSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['aiMessage', 'careerProfile'],
  properties: {
    aiMessage: { type: 'string', maxLength: 120 },
    careerProfile: {
      type: 'object',
      additionalProperties: false,
      required: [
        'coreValueStatement',
        'suitableEnvironments',
        'unsuitableEnvironments',
        'recommendationReasonExample',
        'riskReminder',
        'interviewQuestions',
        'signals',
        'reasoningSummary',
      ],
      properties: {
        coreValueStatement: { type: 'string', maxLength: 100 },
        suitableEnvironments: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: { type: 'string', maxLength: 50 },
        },
        unsuitableEnvironments: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: { type: 'string', maxLength: 50 },
        },
        recommendationReasonExample: { type: 'string', maxLength: 160 },
        riskReminder: { type: 'string', maxLength: 100 },
        interviewQuestions: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: { type: 'string', maxLength: 80 },
        },
        signals: {
          type: 'array',
          minItems: 1,
          maxItems: 5,
          items: signalSchema,
        },
        reasoningSummary: {
          type: 'object',
          additionalProperties: false,
          required: ['mainPattern', 'keyEvidence', 'stillNeedToConfirm'],
          properties: {
            mainPattern: { type: 'string', maxLength: 120 },
            keyEvidence: { type: 'string', maxLength: 140 },
            stillNeedToConfirm: { type: 'string', maxLength: 100 },
          },
        },
      },
    },
  },
} satisfies JsonSchema;

const reviewResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['aiMessage', 'profileUpdateSummary', 'signalsToAdd'],
  properties: {
    aiMessage: { type: 'string', maxLength: 120 },
    profileUpdateSummary: { type: 'string', maxLength: 160 },
    signalsToAdd: signalsToAddSchema,
  },
} satisfies JsonSchema;

function selectSchema(payload: Record<string, unknown>) {
  const mode = payload.mode;
  const currentRound = Number(payload.currentRound || 1);

  if (mode === 'storyUnderstanding') return { name: 'storyUnderstandingResponse', schema: storyUnderstandingSchema };
  if (mode === 'supplement') return { name: 'supplementResponse', schema: supplementResponseSchema };
  if (mode === 'correction') return { name: 'correctionResponse', schema: correctionResponseSchema };
  if (mode === 'summary') return { name: 'summaryResponse', schema: summaryResponseSchema };
  if (mode === 'interviewReview') return { name: 'interviewReviewResponse', schema: reviewResponseSchema };
  if (mode === 'final' || currentRound === 6) return { name: 'finalProfile', schema: finalProfileSchema };
  if (currentRound === 5) return { name: 'summaryResponse', schema: summaryResponseSchema };
  return { name: 'roundResponse', schema: roundResponseSchema };
}

function detectExplicitConcepts(answer: string) {
  const text = answer.toLowerCase();
  const rules = [
    {
      concept: '完美主義 / 品質標準',
      terms: ['完美主義', '完美', '標準很高'],
      priorityAnalysis: [
        '對品質與完整性的要求',
        '害怕交付不夠好',
        '對模糊標準或不完整結果不安',
        '可能需要清楚的成功標準與可接受誤差範圍',
      ],
    },
    {
      concept: '焦慮 / 工作壓力',
      terms: ['焦慮', '不安', '壓力很大'],
      priorityAnalysis: [
        '不要做心理診斷，只描述工作情境中的壓力來源',
        '可能和不確定性、失控感、標準不清、責任過重有關',
        '需要詢問是哪一種情境引發焦慮',
      ],
    },
    {
      concept: '薪資 / 報酬',
      terms: ['錢', '薪水', '薪資', '待遇', '報酬', '加薪', 'income', 'salary'],
      priorityAnalysis: ['貢獻是否被合理定價', '安全感', '價值被承認', '投入是否值得'],
    },
    {
      concept: '主管 / 老闆',
      terms: ['主管', '老闆'],
      priorityAnalysis: ['信任', '授權', '回饋方式', '是否讓能力被看見'],
    },
    {
      concept: '會議 / 流程',
      terms: ['會議', '流程'],
      priorityAnalysis: ['決策品質', '是否推進問題', '是否只是形式', '資訊是否清楚'],
    },
  ];

  return rules
    .map((rule) => ({
      concept: rule.concept,
      matchedTerms: rule.terms.filter((term) => text.includes(term.toLowerCase())),
      priorityAnalysis: rule.priorityAnalysis,
    }))
    .filter((rule) => rule.matchedTerms.length > 0);
}

function buildUserInput(payload: Record<string, unknown>) {
  const actualUserAnswer = String(payload.actualUserAnswer || payload.presetAnswer || '');
  const supplementText = String(payload.supplementText || '');
  const correctionText = String(payload.correctionText || '');
  const mode = String(payload.mode || 'round');
  const primaryUserInput =
    mode === 'supplement'
      ? supplementText || actualUserAnswer
      : mode === 'correction'
        ? correctionText || actualUserAnswer
        : actualUserAnswer;
  const normalizedPayload = {
    mode,
    currentRound: payload.currentRound || 1,
    stageName: payload.stageName || '',
    question: payload.question || '',
    goal: payload.goal || '',
    presetAnswer: payload.presetAnswer || '',
    actualUserAnswer,
    primaryUserInput,
    explicitConcepts: detectExplicitConcepts(primaryUserInput),
    supplementText,
    correctionText,
    previousAnswers: Array.isArray(payload.previousAnswers) ? payload.previousAnswers : [],
    accumulatedSignals: Array.isArray(payload.accumulatedSignals) ? payload.accumulatedSignals : [],
    userCorrections: Array.isArray(payload.userCorrections) ? payload.userCorrections : [],
    summaryUnderstanding: Array.isArray(payload.summaryUnderstanding) ? payload.summaryUnderstanding : [],
    deepInsight: payload.deepInsight || {},
    mockProfile: payload.mockProfile || {},
    careerStoryContext: Array.isArray(payload.careerStoryContext) ? payload.careerStoryContext : [],
    careerStoryText: payload.careerStoryText || '',
    storyUnderstanding: payload.storyUnderstanding || null,
  };

  return JSON.stringify(
    {
      task: [
        '如果 mode = "storyUnderstanding"：你正在閱讀使用者在正式 6 輪對話前提供的職涯故事。請不要產出最終職涯輪廓，只整理這段故事中可供後續判讀使用的背景理解。',
        'storyUnderstanding 任務請分析：使用者可能重視什麼工作條件、哪些情境容易投入、哪些情境容易耗損、後續 6 輪應驗證哪些假設，以及 AI 後續最容易誤讀什麼。',
        'storyUnderstanding 任務請避免：做心理診斷、直接下定論、把故事當成完整結論、忽略後續使用者回答的修正可能。',
        'storyUnderstanding 是 AI 對使用者職涯故事的初步理解。它可以幫助判讀，但不可覆蓋 actualUserAnswer。',
        '如果 actualUserAnswer 和 storyUnderstanding 不一致，請優先處理 actualUserAnswer，並把差異列為待確認。',
        'payload 優先順序是：actualUserAnswer > userCorrections > storyUnderstanding > careerStoryText > previousAnswers > accumulatedSignals > mockProfile > careerStoryContext。',
        '補充 / 修正模式的最高優先順序不同：如果 mode = "supplement"，必須以 supplementText 作為最高優先；如果 mode = "correction"，必須以 correctionText 作為最高優先。',
        '補充 / 修正模式的優先順序是：supplementText 或 correctionText > actualUserAnswer > userCorrections > storyUnderstanding > careerStoryText > previousAnswers > accumulatedSignals > mockProfile > careerStoryContext。',
        '補充 / 修正模式回應的第一句必須直接回應 supplementText 或 correctionText 的明確概念，不可先提 actualUserAnswer、storyUnderstanding、careerStoryContext 或舊 signals。',
        '補充 / 修正模式回應必須先回應 primaryUserInput 中明確出現的概念，再說它如何更新原本理解。不可先回到 storyUnderstanding、careerStoryContext 或舊 signals 的結論。',
        '補充 / 修正模式若 primaryUserInput 提到完美主義、焦慮、標準、品質界線，不可回到透明決策、共同解決或工作意義；必須優先處理完美主義、焦慮、成功標準、品質界線與不確定性壓力。',
        '請只根據 payload 內容輸出符合 JSON Schema 的 JSON。題目與流程由前端控制，不得改題目、不得控制 UI、不得輸出 schema 以外欄位。請優先根據 actualUserAnswer 分析。Mock Profile 只能作為背景，不可覆蓋使用者本輪回答。',
        '每次回應必須優先回應 actualUserAnswer 中明確出現的概念。previousAnswers、accumulatedSignals、mockProfile、careerStoryContext 只能作為背景，不可覆蓋 actualUserAnswer。',
        '如果 actualUserAnswer 和既有脈絡不同，請先處理 actualUserAnswer，再用一句話說明它可能如何補充既有輪廓。',
        '回答順序必須是：先回應 actualUserAnswer 中最明確的概念，再做深層詮釋，再連回職涯輪廓，最後提出一個待確認問題。不要一開始就使用 previousAnswers 或 accumulatedSignals 的舊結論。',
        '若 payload.explicitConcepts 有內容，必須優先使用 explicitConcepts[0] 的 concept、matchedTerms 與 priorityAnalysis。aiMessage、understandingCard、surfaceMeaning、deeperInterpretation、evidenceFromUser、uncertainty 都要對齊這個明確概念。',
        '當使用者提到焦慮、憂鬱、完美主義等詞時，不要做心理診斷，不要使用醫療語氣。請只從工作情境、壓力來源、合作方式與職涯選擇條件來分析。',
        '禁止答非所問：使用者提到完美主義時不可改回透明溝通；提到薪資時不可改回共同解決問題；提到焦慮時不可改回主動權；提到主管時不可改回跨部門協作。',
        'careerStoryContext 只能作為背景脈絡。若它與 actualUserAnswer 衝突，必須優先相信 actualUserAnswer。',
        'careerStoryText 是使用者在正式對話前提供的職涯故事背景。優先順序是 actualUserAnswer > userCorrections > storyUnderstanding > careerStoryText > previousAnswers > accumulatedSignals > mockProfile > careerStoryContext。',
        '如果 actualUserAnswer 與 careerStoryText 有衝突，請優先相信 actualUserAnswer，並把差異視為需要校正的地方。',
        '請避免只根據 careerStoryContext 套用固定結論。careerStoryText 是使用者自己補充的背景，應比預設 mockProfile 更重要。',
        'presetAnswer 只是前端預填範例。若 actualUserAnswer 與 presetAnswer 不同，請以 actualUserAnswer 為準，不要把 presetAnswer 當成使用者同時說過的內容。',
        '第 1 到第 4 輪請填寫 surfaceMeaning、deeperInterpretation、evidenceFromUser、uncertainty。不要只貼標籤，要說出推論依據。',
        '如果 mode = "summary"：你現在不是單輪聊天。你正在根據使用者前四輪工作故事，整理一份可校正的職涯理解。請分析投入感、耗損來源、價值邊界、下一份工作想改變的核心條件、前四輪共同模式，以及仍需要使用者校正的地方。',
        'summary 模式必須根據 previousAnswers 的四輪 answer 整合，不得只看 careerStoryContext。短回答可以分析，但必須保留不確定性。',
        'summary 模式必須根據以下資料產生 summary：careerStoryText、storyUnderstanding、previousAnswers、userCorrections。',
        'summary 模式回應中至少要引用一個 careerStoryText 或 storyUnderstanding 的重點，以及兩個 previousAnswers 中的具體內容；若有 userCorrections，必須優先反映 userCorrections。',
        'summary 模式不要只輸出通用結論，不要每次都回「透明、面對問題、共同解決」。如果資料不足，請明確標示仍需確認，不要硬套模板。',
        'summary 模式若資料重點是方法、秩序、救火，請回到系統化、流程沉澱、可複用方法；若重點是成長與信任，請回到被信任、能力被看見、成長曲線；若重點是付出與回報，請回到貢獻是否被合理定價與長期耗損。',
        '如果 mode = "final"：請根據完整 previousAnswers、accumulatedSignals、summaryUnderstanding、deepInsight、userCorrections 產出 careerProfile，並在 reasoningSummary 說明主要模式、關鍵依據與仍需確認處。',
        '所有文字請保持短句。aiMessage 最多 140 字，deeperInterpretation 最多 100 字，evidenceFromUser 最多 80 字，uncertainty 最多 60 字。',
      ].join('\n'),
      interpretationRules: {
        perfectionism:
          '如果 actualUserAnswer 包含「完美主義、完美、標準很高」，請優先分析對品質與完整性的要求、害怕交付不夠好、對模糊標準或不完整結果不安、需要清楚成功標準與可接受誤差範圍。',
        anxiety:
          '如果 actualUserAnswer 包含「焦慮、不安、壓力很大」，請只描述工作情境中的壓力來源，不做心理診斷。優先分析不確定性、失控感、標準不清、責任過重，並詢問是哪一種情境引發焦慮。',
        money:
          '如果使用者回答包含「錢、薪水、薪資、待遇、報酬、加薪、income、salary」，請優先往貢獻是否被正確定價、安全感、生活穩定或價值被承認詮釋。不要自動解讀成透明溝通或共同解決問題。範例：使用者回答「錢變多」時，應指出表面是薪資，但可能是在確認投入、責任與能力是否被合理定價，並連到安全感、被承認、是否值得投入。',
        manager: '主管相關回答請優先思考信任、授權、判斷是否被看見。',
        team: '團隊相關回答請優先思考合作方式、問題是否被共同面對。',
        workload: '工時或壓力相關回答請優先思考負荷是否有意義、投入是否值得。',
        titleOrCompany: '職稱或大公司相關回答請優先思考外部認可、成長階梯、身份感。',
        meetingsOrProcess: '會議或流程相關回答請優先思考決策品質、效率、是否真正推進問題。',
        aiOrTools: 'AI 或工具相關回答請優先思考是否能把模糊問題變成可討論版本。',
      },
      modeInstructions: {
        storyUnderstanding:
          '如果 mode = "storyUnderstanding"：請只輸出 storyUnderstanding，不要輸出 round insight、summary 或 final profile。',
        round:
          '如果 mode = "round"：請根據本輪題目、目的與使用者回答，產出本輪小結、理解卡片、可選追問與 signalsToAdd。不得跳到其他輪次。',
        supplement:
          '如果 mode = "supplement"：請根據 supplementText 更新當輪理解。supplementText 是這次回應的最高優先輸入，aiMessage 與 understandingCard 的第一個語意重點都必須來自 supplementText，不可先從 actualUserAnswer 開始。請回傳 updated understanding，不要進入下一輪。',
        correction:
          '如果 mode = "correction"：請根據 correctionText 產生修正前 / 修正後對比與更新後理解。correctionText 是這次回應的最高優先輸入，不可被舊答案、storyUnderstanding 或 careerStoryContext 覆蓋。',
        round5:
          '如果 currentRound = 5：請整合前四輪內容，讓使用者確認、補充或修正。若 mode = supplement 或 correction，不要使用 summary schema，應使用 correction / supplement schema。',
        round6:
          '如果 currentRound = 6：請產出最終職涯價值觀輪廓。',
      },
      payload: normalizedPayload,
    },
    null,
    2,
  );
}

function readOutputText(response: unknown) {
  const direct = (response as { output_text?: string }).output_text;
  if (direct) return direct;

  const output = (response as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }).output;
  return output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text;
}

app.post('/api/career-insight', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      res.status(503).json({ error: 'OpenAI API key is not configured.' });
      return;
    }

    const payload = req.body || {};
    const { name, schema } = selectSchema(payload);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const response = await client.responses.create(
      {
        model,
        instructions: DEEP_ANALYSIS_INSTRUCTION,
        input: buildUserInput(payload),
        temperature: 0.2,
        max_output_tokens: 1200,
        text: {
          format: {
            type: 'json_schema',
            name,
            strict: true,
            schema,
          },
        },
      } as OpenAI.Responses.ResponseCreateParamsNonStreaming,
      { timeout: 8000 },
    );

    const outputText = readOutputText(response);
    if (!outputText) {
      res.status(502).json({ error: 'OpenAI returned an empty response.' });
      return;
    }

    res.json(JSON.parse(outputText));
  } catch {
    res.status(502).json({ error: 'OpenAI request failed.' });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Demo server running at http://127.0.0.1:${port}`);
});
