/**
 * Centralized Furniture Scope Constants
 * Single source of truth for all furniture categories across the application
 */

export const ALL_FURNITURE_SCOPES = [
  "Living Room",
  "Dining Room",
  "Kitchen",
  "Master Bedroom",
  "Guest Bedroom",
  "Kids Bedroom",
  "Dressing Room",
  "Home Office",
  "Study Room",
  "Bathroom",
  "Guest Bathroom",
  "Entrance/Lobby",
  "Full Unit",
] as const;

export type FurnitureScope = (typeof ALL_FURNITURE_SCOPES)[number];

// Budget ranges for each furniture scope (in EGP)
export const BUDGET_RANGES: Record<
  FurnitureScope,
  Array<{ label: string; value: string; min: number; max: number | null }>
> = {
  "Living Room": [
    { label: "100,000 - 200,000 EGP", value: "100k-200k", min: 100000, max: 200000 },
    { label: "200,000 - 400,000 EGP", value: "200k-400k", min: 200000, max: 400000 },
    { label: "400,000+ EGP", value: "400k+", min: 400000, max: null },
  ],
  "Dining Room": [
    { label: "80,000 - 150,000 EGP", value: "80k-150k", min: 80000, max: 150000 },
    { label: "150,000 - 300,000 EGP", value: "150k-300k", min: 150000, max: 300000 },
    { label: "300,000+ EGP", value: "300k+", min: 300000, max: null },
  ],
  Kitchen: [
    { label: "80,000 - 150,000 EGP", value: "80k-150k", min: 80000, max: 150000 },
    { label: "150,000 - 300,000 EGP", value: "150k-300k", min: 150000, max: 300000 },
    { label: "300,000+ EGP", value: "300k+", min: 300000, max: null },
  ],
  "Master Bedroom": [
    { label: "70,000 - 150,000 EGP", value: "70k-150k", min: 70000, max: 150000 },
    { label: "150,000 - 250,000 EGP", value: "150k-250k", min: 150000, max: 250000 },
    { label: "250,000+ EGP", value: "250k+", min: 250000, max: null },
  ],
  "Guest Bedroom": [
    { label: "50,000 - 100,000 EGP", value: "50k-100k", min: 50000, max: 100000 },
    { label: "100,000 - 180,000 EGP", value: "100k-180k", min: 100000, max: 180000 },
    { label: "180,000+ EGP", value: "180k+", min: 180000, max: null },
  ],
  "Kids Bedroom": [
    { label: "60,000 - 120,000 EGP", value: "60k-120k", min: 60000, max: 120000 },
    { label: "120,000 - 200,000 EGP", value: "120k-200k", min: 120000, max: 200000 },
    { label: "200,000+ EGP", value: "200k+", min: 200000, max: null },
  ],
  "Dressing Room": [
    { label: "40,000 - 80,000 EGP", value: "40k-80k", min: 40000, max: 80000 },
    { label: "80,000 - 150,000 EGP", value: "80k-150k", min: 80000, max: 150000 },
    { label: "150,000+ EGP", value: "150k+", min: 150000, max: null },
  ],
  "Home Office": [
    { label: "60,000 - 120,000 EGP", value: "60k-120k", min: 60000, max: 120000 },
    { label: "120,000 - 200,000 EGP", value: "120k-200k", min: 120000, max: 200000 },
    { label: "200,000+ EGP", value: "200k+", min: 200000, max: null },
  ],
  "Study Room": [
    { label: "50,000 - 100,000 EGP", value: "50k-100k", min: 50000, max: 100000 },
    { label: "100,000 - 180,000 EGP", value: "100k-180k", min: 100000, max: 180000 },
    { label: "180,000+ EGP", value: "180k+", min: 180000, max: null },
  ],
  Bathroom: [
    { label: "50,000 - 100,000 EGP", value: "50k-100k", min: 50000, max: 100000 },
    { label: "100,000 - 200,000 EGP", value: "100k-200k", min: 100000, max: 200000 },
    { label: "200,000+ EGP", value: "200k+", min: 200000, max: null },
  ],
  "Guest Bathroom": [
    { label: "40,000 - 80,000 EGP", value: "40k-80k", min: 40000, max: 80000 },
    { label: "80,000 - 150,000 EGP", value: "80k-150k", min: 80000, max: 150000 },
    { label: "150,000+ EGP", value: "150k+", min: 150000, max: null },
  ],
  "Entrance/Lobby": [
    { label: "80,000 - 150,000 EGP", value: "80k-150k", min: 80000, max: 150000 },
    { label: "150,000 - 300,000 EGP", value: "150k-300k", min: 150000, max: 300000 },
    { label: "300,000+ EGP", value: "300k+", min: 300000, max: null },
  ],
  "Full Unit": [
    { label: "1,500,000 - 3,000,000 EGP", value: "1.5M-3M", min: 1500000, max: 3000000 },
    { label: "3,000,000 - 5,000,000 EGP", value: "3M-5M", min: 3000000, max: 5000000 },
    { label: "5,000,000+ EGP", value: "5M+", min: 5000000, max: null },
  ],
};

// Timeline options
export const TIMELINE_OPTIONS = [
  { value: "Immediate", label: "Immediate (ASAP)", priority: 10 },
  { value: "1-3 Months", label: "1-3 Months", priority: 7 },
  { value: "3-6 Months", label: "3-6 Months", priority: 5 },
  { value: "Flexible", label: "Flexible", priority: 3 },
] as const;

export type TimelineOption = (typeof TIMELINE_OPTIONS)[number]["value"];
