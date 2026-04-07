import { create } from "zustand";

import { classifyIntent, getEventWeight, type Intent } from "@/lib/conversion-engine";

interface SessionState {
  sessionId: string;
  score: number;
  leadScore: number;
  intent: Intent;
  intentProfile: string[];
  styleSwitches: number;
  lastPage: string;
  roomType: string;
  budget: string;
  style: string;
  serviceType: string;
  quizStyle: string;
  wishlist: string[];
  updateProfile: (updates: Partial<Omit<SessionState, "updateProfile" | "trackEvent" | "toggleWishlist" | "processInteraction">>) => void;
  trackEvent: (type: string, value?: string) => void;
  toggleWishlist: (slug: string) => void;
  processInteraction: (type: string, weight: number) => void;
}

const useSessionStore = create<SessionState>((set, get) => ({
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
  updateProfile: (updates) => set((state) => ({ ...state, ...updates })),
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
    if (process.env.NODE_ENV !== "production") {
      console.log("Interaction:", type, { leadScore: newLeadScore, profile: profileUpdate });
    }
  },
  trackEvent: (type, value) => {
    const state = get();
    const newScore = state.score + getEventWeight(type);
    const intent = classifyIntent(newScore);
    set((state) => ({ ...state, score: newScore, intent }));
    if (process.env.NODE_ENV !== "production") {
      console.log("Event:", type, value, { score: newScore, intent });
    }
  },
}));

export default useSessionStore;

