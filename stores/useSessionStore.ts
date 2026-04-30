import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { classifyIntent, getEventWeight, type Intent } from "@/lib/conversion-engine";

type Language = 'ar' | 'en';

export interface UserPersona {
  certainty: "Low" | "Medium" | "High";
  preferredStyle?: string;
  interestLevel: "Low" | "Moderate" | "Strong";
  focusQuality?: "Interrupted" | "High";
}

export interface BehavioralReport {
  totalFocusTime: number;
  weightedScore: number;
  topInterest: string;
  certainty: "Low" | "Medium" | "High";
  behaviorSummary: string;
  styleAffinity: Record<string, number>;
  roomEngagement: Record<string, number>;
}

// Neural Analytics: Psychological Profile for Interior Design Intelligence
export interface PsychologicalProfile {
  preferredMaterials: string[]; // e.g., ["Marble", "Oak", "Velvet"]
  lightingPreference: "warm" | "cool" | "natural" | "mixed" | null;
  colorPsychology: {
    dominant: string[]; // Primary colors user gravitates toward
    avoided: string[]; // Colors they skip
    emotionalResponse: Record<string, "calm" | "energized" | "luxury" | "cozy">;
  };
  spatialFocus: {
    kitchens: number; // Engagement score for kitchen images
    bedrooms: number;
    livingRooms: number;
    bathrooms: number;
    dressingRooms: number;
  };
  // Interaction weights
  interactionScores: {
    hoverScore: number; // +2 per image hover
    modalScore: number; // +5 per modal open
    downloadScore: number; // +10 per download
    rejectScore: number; // +1 per reject
    total: number;
  };
  // Raw interaction data for Gemini analysis
  interactedImages: Array<{
    id: number;
    timestamp: number;
    interactionType: "hover" | "modal" | "download" | "reject";
    metadata?: {
      colorPalette?: string[];
      materials?: string[];
      roomType?: string;
      style?: string;
      [key: string]: any;
    };
  }>;
}

export interface StylePreference {
  roomCount: number;
  totalTimeSpent: number;
  lastViewedAt: number;
}

export interface UserProfile {
  roomType?: string;
  budget?: string;
  style?: string;
  serviceType?: string;
  stylePreferences?: Record<string, StylePreference>;
  userPersona?: UserPersona;
  behavioralReport?: BehavioralReport;
  [key: string]: string | number | undefined | Record<string, unknown> | UserPersona | BehavioralReport;
}

export interface SessionState {
  // Core session tracking
  sessionId: string;
  score: number;
  leadScore: number;
  intent: Intent;
  intentProfile: string[];
  styleSwitches: number;
  lastPage: string;

  // User profile data
  roomType: string;
  budget: string;
  style: string;
  serviceType: string;
  quizStyle: string;
  wishlist: string[];
  userProfile: UserProfile;

  // UI State (persisted across sessions)
  selectedStyle: string;
  roomIntent: string[];

  // Multilingual Engine State
  language: Language;

  // Behavioral Intelligence
  userPersona: UserPersona;
  behavioralReport: BehavioralReport | null;

  // Neural Analytics: Deep Psychological Profile
  psychologicalProfile: PsychologicalProfile;

  // Hydration guard
  isHydrated: boolean;

  // Actions
  updateProfile: (updates: Partial<Omit<SessionState, "updateProfile" | "trackEvent" | "toggleWishlist" | "processInteraction" | "setSelectedStyle" | "addRoomIntent" | "setHydrated" | "trackNeuralInteraction" | "setLanguage">>) => void;
  trackEvent: (type: string, value?: string) => void;
  toggleWishlist: (slug: string) => void;
  processInteraction: (type: string, weight: number) => void;
  setSelectedStyle: (style: string) => void;
  addRoomIntent: (roomSlug: string) => void;
  setHydrated: (value: boolean) => void;
  setLanguage: (lang: Language) => void;
  resetSession: () => void;
  // Neural Analytics: Track weighted interactions
  trackNeuralInteraction: (
    imageId: number,
    interactionType: "hover" | "modal" | "download" | "reject",
    metadata?: {
      colorPalette?: string[];
      materials?: string[];
      roomType?: string;
      style?: string;
      [key: string]: any;
    }
  ) => void;
}

const DEFAULT_STYLE = "modern";
const DEFAULT_LANGUAGE: Language = "ar"; // Default to Arabic for Egyptian market
const UPDATE_THROTTLE_MS = 500; // 500ms throttle for store updates

// Throttle utility for store updates
let lastUpdateTime = 0;
let pendingUpdate: (() => void) | null = null;
let throttleTimer: ReturnType<typeof setTimeout> | null = null;

function throttledSet(setFn: () => void) {
  const now = Date.now();
  const timeSinceLastUpdate = now - lastUpdateTime;
  
  if (timeSinceLastUpdate >= UPDATE_THROTTLE_MS) {
    lastUpdateTime = now;
    setFn();
  } else {
    pendingUpdate = setFn;
    if (throttleTimer) {
      clearTimeout(throttleTimer);
    }
    throttleTimer = setTimeout(() => {
      if (pendingUpdate) {
        lastUpdateTime = Date.now();
        pendingUpdate();
        pendingUpdate = null;
      }
    }, UPDATE_THROTTLE_MS - timeSinceLastUpdate);
  }
}

const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      // Core session tracking
      sessionId: crypto.randomUUID(),
      score: 0,
      leadScore: 0,
      intent: "browsing",
      intentProfile: [],
      styleSwitches: 0,
      lastPage: "/",

      // User profile data
      roomType: "",
      budget: "",
      style: "",
      serviceType: "",
      wishlist: [],
      quizStyle: "",
      userProfile: {},

      // UI State (persisted)
      selectedStyle: DEFAULT_STYLE,
      roomIntent: [],

      // Multilingual Engine State
      language: DEFAULT_LANGUAGE,

      // Behavioral Intelligence
      userPersona: {
        certainty: "Low",
        interestLevel: "Low",
      },
      behavioralReport: null,
      
      // Neural Analytics
      psychologicalProfile: {
        preferredMaterials: [],
        lightingPreference: null,
        colorPsychology: {
          dominant: [],
          avoided: [],
          emotionalResponse: {},
        },
        spatialFocus: {
          kitchens: 0,
          bedrooms: 0,
          livingRooms: 0,
          bathrooms: 0,
          dressingRooms: 0,
        },
        interactionScores: {
          hoverScore: 0,
          modalScore: 0,
          downloadScore: 0,
          rejectScore: 0,
          total: 0,
        },
        interactedImages: [],
      },

      isHydrated: false,

      updateProfile: (updates) => throttledSet(() => set((state) => {
        const newState = { ...state, ...updates };
        if (updates.style && updates.style !== state.style) {
          newState.selectedStyle = updates.style;
        }
        const profileUpdates: UserProfile = {};
        if (updates.roomType) profileUpdates.roomType = updates.roomType;
        if (updates.budget) profileUpdates.budget = updates.budget;
        if (updates.style) profileUpdates.style = updates.style;
        if (updates.serviceType) profileUpdates.serviceType = updates.serviceType;
        if (Object.keys(profileUpdates).length > 0) {
          newState.userProfile = { ...state.userProfile, ...profileUpdates };
        }
        return newState;
      })),

      toggleWishlist: (slug: string) => set((state) => {
        const newWishlist = state.wishlist.includes(slug)
          ? state.wishlist.filter((s: string) => s !== slug)
          : [...state.wishlist, slug];
        return { wishlist: newWishlist };
      }),

      processInteraction: (type: string, weight: number) => {
        const state = get();
        const newLeadScore = state.leadScore + weight;
        const profileUpdate = type.includes('style') ? [...state.intentProfile, type] : state.intentProfile;
        const switchesUpdate = type.includes('style_switch') ? state.styleSwitches + 1 : state.styleSwitches;
        set((state) => ({
          ...state,
          leadScore: newLeadScore,
          intentProfile: profileUpdate,
          styleSwitches: switchesUpdate
        }));
      },

      trackEvent: (type, value) => {
        const state = get();
        const newScore = state.score + getEventWeight(type);
        const intent = classifyIntent(newScore);
        set((state) => ({ ...state, score: newScore, intent }));
      },

      setSelectedStyle: (style: string) => set((state) => {
        if (state.selectedStyle !== style && state.selectedStyle !== "") {
          get().processInteraction("style_switch", 2);
        }
        get().processInteraction("style_select", 1);
        return {
          ...state,
          selectedStyle: style,
          style: style,
          userProfile: { ...state.userProfile, style }
        };
      }),

      addRoomIntent: (roomSlug: string) => set((state) => {
        if (state.roomIntent.includes(roomSlug)) return state;
        get().processInteraction("room_view", 3);
        return {
          roomIntent: [...state.roomIntent, roomSlug],
          roomType: roomSlug
        };
      }),

      setHydrated: (value: boolean) => set((state) => ({ ...state, isHydrated: value })),

      setLanguage: (lang: Language) => set((state) => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("languagechange", { detail: lang }));
        }
        return { ...state, language: lang };
      }),

      trackNeuralInteraction: (imageId, interactionType, metadata) => set((state) => {
        const weights = { hover: 2, modal: 5, download: 10, reject: 1 };
        const weight = weights[interactionType];
        const now = Date.now();
        
        const newInteractionScores = {
          ...state.psychologicalProfile.interactionScores,
          [`${interactionType}Score`]: state.psychologicalProfile.interactionScores[`${interactionType}Score`] + weight,
          total: state.psychologicalProfile.interactionScores.total + weight,
        };
        
        const newInteractedImages = [
          ...state.psychologicalProfile.interactedImages,
          { id: imageId, timestamp: now, interactionType, metadata },
        ];
        
        const newColorPsychology = { ...state.psychologicalProfile.colorPsychology };
        if (metadata?.colorPalette) {
          metadata.colorPalette.forEach((color) => {
            if (!newColorPsychology.dominant.includes(color)) {
              newColorPsychology.dominant.push(color);
            }
          });
        }
        
        const newSpatialFocus = { ...state.psychologicalProfile.spatialFocus };
        if (metadata?.roomType) {
          const roomKey = metadata.roomType.toLowerCase().replace(/\s+/g, '') as keyof typeof newSpatialFocus;
          if (roomKey in newSpatialFocus) {
            newSpatialFocus[roomKey] = (newSpatialFocus[roomKey] || 0) + weight;
          }
        }
        
        const newPreferredMaterials = [...state.psychologicalProfile.preferredMaterials];
        if (metadata?.materials) {
          metadata.materials.forEach((material) => {
            if (!newPreferredMaterials.includes(material)) {
              newPreferredMaterials.push(material);
            }
          });
        }
        
        return {
          psychologicalProfile: {
            ...state.psychologicalProfile,
            interactionScores: newInteractionScores,
            interactedImages: newInteractedImages,
            colorPsychology: newColorPsychology,
            spatialFocus: newSpatialFocus,
            preferredMaterials: newPreferredMaterials,
          },
          score: state.score + weight,
        };
      }),

      resetSession: () => set(() => ({
        sessionId: crypto.randomUUID(),
        score: 0,
        leadScore: 0,
        intent: "browsing",
        intentProfile: [],
        styleSwitches: 0,
        lastPage: "/",
        roomType: "",
        budget: "",
        style: "",
        serviceType: "",
        wishlist: [],
        quizStyle: "",
        userProfile: {},
        selectedStyle: DEFAULT_STYLE,
        roomIntent: [],
        language: DEFAULT_LANGUAGE,
        userPersona: { certainty: "Low", interestLevel: "Low" },
        behavioralReport: null,
        psychologicalProfile: {
          preferredMaterials: [],
          lightingPreference: null,
          colorPsychology: {
            dominant: [],
            avoided: [],
            emotionalResponse: {},
          },
          spatialFocus: {
            kitchens: 0,
            bedrooms: 0,
            livingRooms: 0,
            bathrooms: 0,
            dressingRooms: 0,
          },
          interactionScores: {
            hoverScore: 0,
            modalScore: 0,
            downloadScore: 0,
            rejectScore: 0,
            total: 0,
          },
          interactedImages: [],
        },
        isHydrated: true,
      })),
    }),
    {
      name: "azenith-session",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        sessionId: state.sessionId,
        score: state.score,
        leadScore: state.leadScore,
        intent: state.intent,
        intentProfile: state.intentProfile,
        styleSwitches: state.styleSwitches,
        lastPage: state.lastPage,
        roomType: state.roomType,
        budget: state.budget,
        style: state.style,
        serviceType: state.serviceType,
        quizStyle: state.quizStyle,
        wishlist: state.wishlist,
        userProfile: state.userProfile,
        selectedStyle: state.selectedStyle,
        roomIntent: state.roomIntent,
        language: state.language,
        userPersona: state.userPersona,
        behavioralReport: state.behavioralReport,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true);
        }
      },
    }
  )
);

export function useHydrationReady() {
  return useSessionStore((state) => state.isHydrated);
}

export function usePersistedStyle(defaultStyle = DEFAULT_STYLE) {
  const selectedStyle = useSessionStore((state) => state.selectedStyle);
  const isHydrated = useSessionStore((state) => state.isHydrated);
  return isHydrated ? selectedStyle : defaultStyle;
}

export function getAIPersonaPrompt(state: SessionState): string {
  const { leadScore, intent, roomIntent, styleSwitches, userPersona, behavioralReport, userProfile } = state;
  const stylePrefs = userProfile.stylePreferences || {};
  const styleEntries = Object.entries(stylePrefs);
  const focusedRooms = roomIntent.slice(0, 5).join(", ") || "None tracked";
  const styleAffinity = styleEntries.map(([style, data]) => `${style}(${data.roomCount} rooms)`).join(", ") || "No style preferences";

  let budgetEstimate = "Unknown";
  if (leadScore > 70) budgetEstimate = "Premium/Luxury (High Intent)";
  else if (leadScore > 40) budgetEstimate = "Mid-to-High Range";
  else if (leadScore > 20) budgetEstimate = "Exploring Options";
  else budgetEstimate = "Early Research Phase";

  return `## Lead Analysis Request

**Lead Score:** ${leadScore}/100
**Intent Classification:** ${intent}
**Certainty Level:** ${userPersona.certainty}
**Interest Level:** ${userPersona.interestLevel}
**Focus Quality:** ${userPersona.focusQuality || "Not assessed"}

**Behavioral Summary:**
- Rooms/Furniture Focused On: ${focusedRooms}
- Preferred Style: ${userPersona.preferredStyle || "Unknown"}
- Style Exploration: ${styleAffinity}
- Style Switches: ${styleSwitches} (indicates comparison behavior)

**Estimated Budget Range:** ${budgetEstimate}

${behavioralReport ? `**Detailed Behavioral Report:**
${behavioralReport.behaviorSummary}

**Top Interest Area:** ${behavioralReport.topInterest || "N/A"}
**Weighted Engagement Score:** ${behavioralReport.weightedScore}
**Time Spent on Site:** ${Math.floor(behavioralReport.totalFocusTime / 60000)} minutes` : "No detailed behavioral report available"}

---

Analyze this luxury real estate visitor profile and provide:
1. Their primary design style preference
2. Likely budget range and purchase timeline
3. Specific rooms/furniture they value most
4. Sales approach recommendation in Arabic`;
}

if (typeof window !== "undefined") {
  let syncTimeout: ReturnType<typeof setTimeout> | null = null;
  useSessionStore.subscribe((state, prevState) => {
    if (
      state.leadScore !== prevState.leadScore ||
      state.intent !== prevState.intent ||
      state.styleSwitches !== prevState.styleSwitches ||
      state.selectedStyle !== prevState.selectedStyle ||
      state.roomType !== prevState.roomType ||
      state.score !== prevState.score
    ) {
      if (syncTimeout) clearTimeout(syncTimeout);
      syncTimeout = setTimeout(() => {
        const data = {
          sessionId: state.sessionId,
          leadScore: state.leadScore,
          intent: state.intent,
          styleSwitches: state.styleSwitches,
          userPersona: state.userPersona,
          psychologicalProfile: state.psychologicalProfile,
          behavioralReport: state.behavioralReport,
          lastPage: window.location.pathname,
          language: state.language
        };
        fetch('/api/analytics/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          keepalive: true
        }).catch(() => {});
      }, 2000);
    }
  });
}

export default useSessionStore;
