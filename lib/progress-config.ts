/**
 * PROGRESS MAP CONFIGURATION
 * Fixed progress values - NO calculations, NO interpolation
 * Admin is the only source of truth
 */

export const STAGE_NAMES = {
  1: "مرحلة التعاقد والتصميم",
  2: "مرحلة تجهيز الخامات",
  3: "مرحلة التنفيذ والتجميع",
  4: "مرحلة التسليم",
} as const;

export type StageNumber = 1 | 2 | 3 | 4;

// Stage 1: 0 → 50% (4 steps)
const STAGE_1_PROGRESS: Record<number, number> = {
  1: 12.5,
  2: 25,
  3: 37.5,
  4: 50,
};

// Stage 2: 50 → 70% (4 steps)
const STAGE_2_PROGRESS: Record<number, number> = {
  1: 55,
  2: 60,
  3: 65,
  4: 70,
};

// Stage 3: 70 → 90% (5 steps)
const STAGE_3_PROGRESS: Record<number, number> = {
  1: 74,
  2: 78,
  3: 82,
  4: 86,
  5: 90,
};

// Stage 4: 90 → 100% (5 steps)
const STAGE_4_PROGRESS: Record<number, number> = {
  1: 92,
  2: 94,
  3: 96,
  4: 98,
  5: 100,
};

// Complete progress map
export const PROGRESS_MAP: Record<StageNumber, Record<number, number>> = {
  1: STAGE_1_PROGRESS,
  2: STAGE_2_PROGRESS,
  3: STAGE_3_PROGRESS,
  4: STAGE_4_PROGRESS,
};

// Get max steps per stage
export const MAX_STEPS_PER_STAGE: Record<StageNumber, number> = {
  1: 4,
  2: 4,
  3: 5,
  4: 5,
};

/**
 * Get progress percentage from map
 * STRICT: NO calculation, direct lookup only
 */
export function getProgressPercentage(
  stage: StageNumber,
  step: number
): number {
  const progress = PROGRESS_MAP[stage]?.[step];
  
  if (progress === undefined) {
    throw new Error(`Invalid stage ${stage} or step ${step}`);
  }
  
  return progress;
}

/**
 * Check if current step is the last step in stage
 */
export function isLastStepInStage(
  stage: StageNumber,
  step: number
): boolean {
  return step === MAX_STEPS_PER_STAGE[stage];
}

/**
 * Check if current step is pre-final (before last step)
 */
export function isPreFinalStep(
  stage: StageNumber,
  step: number
): boolean {
  return step === MAX_STEPS_PER_STAGE[stage] - 1;
}

/**
 * Get payment number triggered at end of stage
 * Stage 1 → payment_2 (20%)
 * Stage 2 → payment_3 (20%)
 * Stage 3 → payment_4 (10%)
 * Stage 4 → none (completed)
 */
export function getPaymentForStageEnd(stage: StageNumber): number | null {
  const paymentMap: Record<number, number | null> = {
    1: 2,
    2: 3,
    3: 4,
    4: null,
  };
  return paymentMap[stage] ?? null;
}

/**
 * Calculate payment amounts based on total price
 * payment_1 = 50%
 * payment_2 = 20%
 * payment_3 = 20%
 * payment_4 = 10%
 */
export function calculatePayments(totalPrice: number): {
  payment_1: number;
  payment_2: number;
  payment_3: number;
  payment_4: number;
} {
  return {
    payment_1: totalPrice * 0.50,
    payment_2: totalPrice * 0.20,
    payment_3: totalPrice * 0.20,
    payment_4: totalPrice * 0.10,
  };
}
