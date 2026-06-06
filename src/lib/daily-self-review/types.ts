export const DAILY_SELF_REVIEW_SAFETY_NOTICE =
  "Daily AI self-review is advisory only — it cannot execute trades, change risk settings, or enable live trading. Rule and strategy proposals require human approval.";

export type DailyReviewVerdict = "yes" | "partial" | "no" | "unclear";

export interface DailyReviewQuestionAnswer {
  verdict: DailyReviewVerdict;
  detail: string;
}

export interface DailyReviewQuestions {
  followedMission: DailyReviewQuestionAnswer;
  overtraded: DailyReviewQuestionAnswer;
  missedGoodTrades: DailyReviewQuestionAnswer;
  tookBadTrades: DailyReviewQuestionAnswer;
  riskGatesWorked: DailyReviewQuestionAnswer;
  executionWorked: DailyReviewQuestionAnswer;
  improveTomorrow: string;
}

export interface DailySelfReviewRecord {
  reviewId: string;
  date: string;
  generatedAt: string;
  trigger: "cron" | "manual" | "automation";
  dailyScore: number;
  biggestMistake: string;
  bestDecision: string;
  lessonLearned: string;
  ruleProposal: string;
  strategyProposal: string;
  tomorrowPlan: string;
  questions: DailyReviewQuestions;
  summary: string;
  sourceCounts: {
    analyzeCyclesToday: number;
    tradesClosedToday: number;
    lossesToday: number;
    winsToday: number;
    missionMode: string;
    executionGate: string;
    riskStatus: string;
    tradeQualityAvg: number | null;
    tradeQualityGrade: string | null;
  };
  safetyNotice: typeof DAILY_SELF_REVIEW_SAFETY_NOTICE;
  advisoryOnly: true;
  cannotAutoChangeLive: true;
}

export interface DailySelfReviewStore {
  workspaceId: string;
  reviews: DailySelfReviewRecord[];
  lastRunAt: string | null;
  nextDailyReviewAt: string | null;
  updatedAt: string;
}

export interface DailySelfReviewStatus {
  workspaceId: string;
  latest: DailySelfReviewRecord | null;
  lastRunAt: string | null;
  nextDailyReviewAt: string | null;
  reviewCount: number;
  safetyNotice: typeof DAILY_SELF_REVIEW_SAFETY_NOTICE;
}
