import { JourneyStep } from './types';

export const JOURNEY_STEPS: JourneyStep[] = [
  { id: 1, name: '回望經驗', goal: '找出投入感來源' },
  { id: 2, name: '找出空洞', goal: '找出消耗來源' },
  { id: 3, name: '確認底線', goal: '找出價值邊界' },
  { id: 4, name: '定義未來', goal: '轉成未來選擇條件' },
  { id: 5, name: '校正理解', goal: '讓使用者確認、補充或修正 AI 理解' },
  { id: 6, name: '產出輪廓', goal: '形成可回接推薦與面試判斷的職涯輪廓' },
];

export const INITIAL_DATA_CARDS = [
  {
    title: '履歷 / 工作經驗',
    content: ['產品經理', 'AI 工具導入', '跨部門協作', '策略規劃'],
    icon: 'FileText',
  },
  {
    title: '測驗資料',
    content: ['工作價值觀', '職涯偏好', '風險訊號'],
    icon: 'ClipboardCheck',
  },
  {
    title: '行為資料',
    content: ['瀏覽職缺', '收藏公司', '投遞紀錄', '推薦回饋'],
    icon: 'MousePointer2',
  },
  {
    title: 'AI 工具摘要',
    content: ['履歷健檢', '職涯顧問', '推薦理由'],
    icon: 'Sparkles',
  },
];

export const ROUNDS_DATA = [
  {
    id: 1,
    stageName: '回望經驗',
    question:
      '你做過的工作裡，有沒有哪一段時間，讓你覺得就算很累，這件事還是值得的？那個時候，你在做什麼？周圍是什麼感覺？',
    goal: '找出投入感來源',
    presetAnswer:
      '有一次我負責把客服與產品資料整理成一套內部 AI 工具。那段時間很累，但大家真的在用同一份資料討論問題，客服回饋、產品判斷和工程限制可以被放在同一張桌上，我覺得那很有價值。',
    mockResponse:
      '我不想直接把它整理成團隊合作。更精準地說，你在意的可能是：大家是不是都在認真想同一個問題，而且你的整理能讓討論變得更清楚。',
    mockSignals: [
      { type: 'positive' as const, label: '共同解題' },
      { type: 'positive' as const, label: '資料整合' },
    ],
  },
  {
    id: 2,
    stageName: '找出空洞',
    question:
      '有沒有相反的時刻——工作不難、壓力不大，但你就是提不起勁？那個時候，是什麼讓你感覺空洞？',
    goal: '找出消耗來源',
    presetAnswer:
      '有一段時間我只是照著既有流程整理報表。工作不難，也沒有太大壓力，但我看不出這些報表會影響什麼決策。每週交出去以後好像就結束了。',
    mockResponse:
      '讓你消耗的可能不是重複工作本身，而是工作和決策之間斷掉了。當你看不見成果如何被使用，投入感就會很快下降。',
    mockSignals: [
      { type: 'risk' as const, label: '低決策連結' },
      { type: 'risk' as const, label: '成果不可見' },
    ],
  },
  {
    id: 3,
    stageName: '確認底線',
    question: '用這個句型告訴我：我無法在一個＿＿＿的環境工作。',
    goal: '找出價值邊界',
    presetAnswer:
      '我無法在一個大家只想趕快交差、沒有人願意把問題講清楚的環境工作。',
    mockResponse:
      '這句話裡的底線不是單純討厭混亂，而是你需要一個願意面對問題的環境。即使答案還不清楚，至少大家願意把問題攤開。',
    mockSignals: [
      { type: 'risk' as const, label: '敷衍交差' },
      { type: 'confirm' as const, label: '問題透明' },
    ],
  },
  {
    id: 4,
    stageName: '定義未來',
    question:
      '如果下一份工作，有一件事你希望它跟過去所有工作都不一樣，那件事是什麼？',
    goal: '轉成未來選擇條件',
    presetAnswer:
      '我希望下一份工作不要只是接需求和排時程。我想更早參與問題定義，知道為什麼現在要做這件事，以及成功之後會改變什麼。',
    mockResponse:
      '你的未來條件可能是：不只負責執行，也要能參與問題定義。你需要看見策略、使用者問題和實際產出之間的連結。',
    mockSignals: [
      { type: 'positive' as const, label: '參與定義' },
      { type: 'confirm' as const, label: '策略連結' },
    ],
  },
  {
    id: 5,
    stageName: '校正理解',
    question:
      '根據前面四輪，我會先整理目前理解，請你確認這份理解準不準。',
    goal: '讓使用者確認、補充或修正 AI 理解',
    presetAnswer:
      '這很接近。不過我想補充：我不是一定要主導所有決策，而是希望決策過程是透明的，我知道自己做的事為什麼重要。',
    mockResponse:
      '目前理解是：你重視能把模糊問題整理清楚的工作；你會被沒有決策連結的任務消耗；你需要一個願意面對問題、讓脈絡透明的環境。',
    mockSignals: [
      { type: 'confirm' as const, label: '脈絡透明' },
      { type: 'confirm' as const, label: '非主導需求' },
    ],
  },
  {
    id: 6,
    stageName: '產出輪廓',
    question: '根據前面的回答，產出你的職涯價值觀輪廓。',
    goal: '形成可回接推薦與面試判斷的職涯輪廓',
    presetAnswer: '請產出我的職涯價值觀輪廓。',
    mockResponse:
      '你的核心不是追求職稱本身，而是希望工作能把模糊問題變清楚，並且讓努力和實際決策產生連結。',
    mockSignals: [
      { type: 'positive' as const, label: '釐清問題' },
      { type: 'positive' as const, label: '決策連結' },
      { type: 'confirm' as const, label: '面試驗證' },
    ],
  },
];

export const MOCK_CAREER_PROFILE = {
  coreValueStatement:
    '你重視能把模糊問題整理清楚，並讓努力和真實決策產生連結的工作。',
  suitableEnvironments: [
    '問題定義開放，允許跨部門一起釐清脈絡',
    '成果會被用於產品、服務或策略決策',
    '團隊願意面對不確定性，而不是只追求交差',
  ],
  unsuitableEnvironments: [
    '需求來源不透明，只要求快速執行',
    '產出交出去後沒有回饋，也看不見影響',
    '表面上協作，實際上各自守住資訊',
  ],
  recommendationReasonExample:
    '這類工作若能讓你參與問題定義、整合使用者與業務資料，會更容易讓你感到投入；但仍要確認 PM 是否真的能參與決策，而不只是排程。',
  riskReminder:
    '面試時要確認決策流程是否透明，以及你的角色能否接觸到問題定義。',
  interviewQuestions: [
    '這個職位通常在什麼階段參與問題定義？',
    '產品決策會使用哪些使用者或業務資料？',
    '跨部門意見衝突時，團隊通常怎麼做決定？',
  ],
  signals: [
    { type: 'positive' as const, label: '問題定義' },
    { type: 'positive' as const, label: '資料整合' },
    { type: 'confirm' as const, label: '決策透明' },
  ],
};

export const FIXED_QUESTIONS = {
  1: ROUNDS_DATA[0].question,
  2: ROUNDS_DATA[1].question,
  3: ROUNDS_DATA[2].question,
  4: ROUNDS_DATA[3].question,
  5: ROUNDS_DATA[4].question,
  6: ROUNDS_DATA[5].question,
};

export const FALLBACK_RESPONSES = {
  round: {
    aiMessage: '我先用展示資料保留這輪理解，避免流程中斷。',
    understandingCard: {
      title: '目前理解',
      content:
        '你重視問題被認真釐清，也在意自己的投入能否連回真實決策。',
    },
    signalsToAdd: [{ type: 'confirm' as const, label: '待確認' }],
    quickReplies: ['這很接近', '我想補充', '理解有點偏掉'],
    nextRoundAllowed: true,
  },
  summary: {
    aiMessage: '我先整理目前的理解，請你確認是否貼近。',
    summaryUnderstanding: [
      '你容易投入在能釐清問題、整合脈絡的工作。',
      '你會被看不見決策用途的工作消耗。',
      '你需要透明、願意面對問題的合作環境。',
    ],
    quickReplies: ['這很接近', '我想補充', '理解有點偏掉'],
    nextRoundAllowed: true,
  },
  profile: {
    aiMessage: '我先用展示資料產出職涯價值觀輪廓。',
    careerProfile: MOCK_CAREER_PROFILE,
  },
};

export const MOCK_PROFILE = {
  resumePreference: {
    role: '產品經理',
    interests: ['AI 工具導入', '跨部門協作', '策略規劃', '資料整合'],
    avoid: ['純執行角色', '決策不透明', '成果無回饋'],
  },
  assessmentData: {
    workStyle: '偏好釐清問題、整合資訊、推動共識',
    values: ['問題透明', '有意義的產出', '跨部門協作'],
    riskSignals: ['長期低回饋會降低投入', '不適合只照流程交差'],
  },
  behaviorData: {
    viewedJobs: ['AI 產品經理', '策略產品經理', '資料產品 PM'],
    savedJobs: ['AI 工具 PM', 'B2B SaaS PM'],
    appliedJobs: ['資料平台產品經理'],
  },
  aiToolSummary: {
    resumeCheck:
      '履歷中多次出現資料整合、跨部門溝通與 AI 工具導入經驗。',
    careerAdvisor:
      '職涯偏好顯示使用者重視問題定義、決策透明與產出影響。',
  },
};

export const CAREER_STORY_CONTEXT = [
  '使用者過去多次處理模糊需求、跨系統整合、支付、會員與 AI 工具應用相關工作。',
  '使用者有投入感的時刻，通常不是因為工作輕鬆，而是能參與問題定義，並且團隊真的在面對同一個問題。',
  '使用者不排斥壓力，但排斥高責任、低授權，或問題被包裝成進度卻沒有人真正處理。',
  '使用者對組織透明度、推責文化、表面協作特別敏感。',
  '使用者偏好策略、架構、問題定義、跨部門協作，不適合長期純維運或小功能執行。',
  '使用者使用 AI 的目的不是炫技，而是把模糊問題拆成可討論、可執行、可估價的版本。',
];

export const CAREER_STORY_TEMPLATES = [
  {
    id: 'strategy',
    label: '故事 A｜策略與問題定義型',
    fit: '適合：想釐清投入感、問題定義、策略參與的人',
    content:
      '我過去最有投入感的工作，通常不是單純把功能做完，而是能參與問題定義、把模糊需求整理成可討論、可執行的版本。像是處理會員、支付、跨系統串接或 AI 工具導入時，雖然壓力很大，但只要團隊真的在同一個問題上討論，我就會覺得這件事值得。相反地，如果一份工作只是接需求、排程、維護小功能，卻沒有人討論為什麼要做，我很容易覺得空洞。我不排斥壓力，但如果責任很大、授權很小，或組織不願意面對問題，我會很快耗損。下一份工作我希望更接近策略、架構、問題定義與跨部門協作，而不是長期處理低影響力的執行任務。',
  },
  {
    id: 'growth',
    label: '故事 B｜成長與被信任型',
    fit: '適合：想釐清成長感、信任、能力被看見的人',
    content:
      '我在工作中很在意自己是否有持續成長，也在意能力是否被真正看見。有些時候，我原本只是被要求做資料整理或支援任務，但當主管願意採用我的判斷，甚至讓我去和其他部門說明時，我會感覺自己不只是執行者，而是能對產品方向產生影響。相反地，如果一份工作薪水還可以、事情也不難，但每天都只是細碎維護、改文案、處理安全的小任務，我會覺得自己在原地踏步。我不是單純想升職或追求頭銜，而是希望被信任能處理更難的題目。即使一開始壓力比較大，只要責任、授權與學習空間是對等的，我會願意投入。下一份工作我希望能讓自己往下一個層級成長。',
  },
] as const;

export const STORY_UNDERSTANDING_A = {
  storySummary:
    '使用者的投入感來自參與問題定義、整理模糊需求，並看見團隊真的在面對同一個問題。若只剩接需求、排程與低影響力維護，容易感到空洞。',
  likelyValues: ['問題定義', '策略參與', '跨部門協作', '成果可驗證', '授權對等'],
  riskSignals: ['純執行任務', '高責任低授權', '表面協作', '低影響力維護', '問題被迴避'],
  hypothesesToVerify: [
    '使用者是否真正重視影響力，而不只是專案規模。',
    '使用者是否需要責任與授權維持對等。',
    '使用者是否需要能參與判斷，而不只是完成交辦。',
  ],
  possibleMisreadings: [
    '不要把想參與問題定義誤讀成一定要掌控所有決策。',
    '不要把不喜歡維護任務誤讀成不願意做細節。',
    '不要把壓力承受度誤讀成可以接受高責任低授權。',
  ],
};

export const STORY_UNDERSTANDING_B = {
  storySummary:
    '使用者在意持續成長與能力是否被看見。當主管願意信任其判斷、給予更難題目與跨部門說明機會時，投入感會明顯提高。',
  likelyValues: ['被信任', '成長空間', '能力被看見', '授權對等', '挑戰難題'],
  riskSignals: ['原地踏步', '細碎維護', '成果不可見', '低挑戰任務', '責任授權不對等'],
  hypothesesToVerify: [
    '使用者是否重視成長階梯，而不只是職稱提升。',
    '使用者是否需要主管信任其判斷。',
    '使用者是否願意承擔壓力，前提是能換到學習與授權。',
  ],
  possibleMisreadings: [
    '不要把想成長誤讀成只想升職或追求頭銜。',
    '不要把需要被信任誤讀成不能接受回饋。',
    '不要把薪資或職稱議題只解讀成外在條件。',
  ],
};

export const MOCK_ROUNDS = {
  1: {
    aiQuestion: ROUNDS_DATA[0].question,
    userPreFill: ROUNDS_DATA[0].presetAnswer,
    aiInterpretation: ROUNDS_DATA[0].mockResponse,
    options: ['這很接近', '我想補充', '理解有點偏掉'],
    signals: ROUNDS_DATA[0].mockSignals,
  },
  2: {
    aiQuestion: ROUNDS_DATA[1].question,
    userPreFill: ROUNDS_DATA[1].presetAnswer,
    aiInterpretation: ROUNDS_DATA[1].mockResponse,
    signals: ROUNDS_DATA[1].mockSignals,
  },
  3: {
    aiQuestion: ROUNDS_DATA[2].question,
    userPreFill: ROUNDS_DATA[2].presetAnswer,
    aiInterpretation: ROUNDS_DATA[2].mockResponse,
    signals: ROUNDS_DATA[2].mockSignals,
  },
  4: {
    aiQuestion: ROUNDS_DATA[3].question,
    userPreFill: ROUNDS_DATA[3].presetAnswer,
    aiInterpretation: ROUNDS_DATA[3].mockResponse,
    signals: ROUNDS_DATA[3].mockSignals,
  },
  5: {
    aiSummary: ROUNDS_DATA[4].mockResponse,
    options: ['這很接近', '我想補充', '理解有點偏掉'],
    signals: ROUNDS_DATA[4].mockSignals,
  },
  6: {
    aiFinal: MOCK_CAREER_PROFILE.coreValueStatement,
  },
};
