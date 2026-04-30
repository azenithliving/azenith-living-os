"use client";

import { motion } from "framer-motion";

import type { FurnitureScope as ScopeType } from "@/lib/constants/furniture-data";

/**
 * Investment Brackets Component
 * Non-binding estimated ranges based on project scope
 * No fixed items, brand names, or specific materials mentioned
 */

export type { ScopeType };

export type InvestmentTier = {
  level: "Essential" | "Refined" | "Bespoke";
  emoji: string;
  description: string;
  rangeEGP: string;
  disclaimer: string;
  characteristics: string[];
};

const INVESTMENT_TIERS: Record<ScopeType, InvestmentTier[]> = {
  "Living Room": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Welcoming space with essential comfort",
      rangeEGP: "100,000 - 200,000 EGP",
      disclaimer: "Estimates vary based on room size and furnishing scope",
      characteristics: [
        "Comfortable seating arrangement",
        "Cohesive color scheme",
        "Practical storage solutions",
        "Ambient lighting foundation",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Sophisticated entertaining space with curated details",
      rangeEGP: "200,000 - 400,000 EGP",
      disclaimer: "Investment reflects design complexity and material selections",
      characteristics: [
        "Designer-grade furnishings",
        "Integrated media solutions",
        "Layered lighting design",
        "Textural sophistication",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Signature living space with master craftsmanship",
      rangeEGP: "400,000+ EGP",
      disclaimer: "Requires detailed survey for accurate investment scope",
      characteristics: [
        "Custom commissioned pieces",
        "Architectural millwork",
        "Art-integrated design",
        "Smart home integration",
      ],
    },
  ],
  "Dining Room": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Functional elegance for gatherings",
      rangeEGP: "80,000 - 150,000 EGP",
      disclaimer: "Varies based on seating capacity and spatial requirements",
      characteristics: [
        "Comfortable dining setup",
        "Practical storage buffet",
        "Adequate task lighting",
        "Flow-friendly layout",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Elevated dining experience with refined details",
      rangeEGP: "150,000 - 300,000 EGP",
      disclaimer: "Final cost depends on custom element complexity",
      characteristics: [
        "Designer dining collection",
        "Statement lighting feature",
        "Display cabinetry",
        "Luxurious textiles",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Couture dining environment with artisan touches",
      rangeEGP: "300,000+ EGP",
      disclaimer: "Precise quote requires technical assessment",
      characteristics: [
        "Custom table design",
        "Bespoke storage walls",
        "Wine integration systems",
        "Gallery-quality finishes",
      ],
    },
  ],
  Kitchen: [
    {
      level: "Essential",
      emoji: "✨",
      description: "Functional elegance with essential refinements",
      rangeEGP: "80,000 - 150,000 EGP",
      disclaimer: "Estimates vary significantly based on final technical specifications",
      characteristics: [
        "Streamlined spatial flow",
        "Essential functional upgrades",
        "Cohesive visual palette",
        "Practical storage solutions",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Elevated aesthetics with curated design elements",
      rangeEGP: "150,000 - 300,000 EGP",
      disclaimer: "Final investment depends on blueprint complexity and custom requirements",
      characteristics: [
        "Harmonious material interplay",
        "Advanced spatial optimization",
        "Integrated lighting concepts",
        "Designer-grade finishes",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Tailored luxury with artisan-level craftsmanship",
      rangeEGP: "300,000+ EGP",
      disclaimer: "Requires detailed technical survey for accurate scope definition",
      characteristics: [
        "Fully customized spatial design",
        "Premium imported elements",
        "Integrated smart systems",
        "Master-level craftsmanship",
      ],
    },
  ],
  "Master Bedroom": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Serene master suite with comfort focus",
      rangeEGP: "70,000 - 150,000 EGP",
      disclaimer: "Varies based on room dimensions and ensuite connectivity",
      characteristics: [
        "Restful sleeping environment",
        "Adequate wardrobe storage",
        "Calming color palette",
        "Reading nook potential",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Luxurious master retreat with sophisticated details",
      rangeEGP: "150,000 - 250,000 EGP",
      disclaimer: "Investment reflects ensuite integration and finish selections",
      characteristics: [
        "Walk-in wardrobe design",
        "Seating area integration",
        "Layered lighting scheme",
        "Textile luxury layers",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Ultimate master sanctuary with bespoke elements",
      rangeEGP: "250,000+ EGP",
      disclaimer: "Precise quote requires on-site technical assessment",
      characteristics: [
        "Custom bed design",
        "Integrated dressing suite",
        "Wellness features",
        "Signature design statement",
      ],
    },
  ],
  "Guest Bedroom": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Comfortable hospitality with smart design",
      rangeEGP: "50,000 - 100,000 EGP",
      disclaimer: "Varies based on room size and guest frequency",
      characteristics: [
        "Comfortable guest setup",
        "Multi-functional storage",
        "Welcoming atmosphere",
        "Practical lighting",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Thoughtful guest experience with refined touches",
      rangeEGP: "100,000 - 180,000 EGP",
      disclaimer: "Investment reflects hospitality-focused amenities",
      characteristics: [
        "Hotel-style comforts",
        "Dedicated work space",
        "Luggage storage solutions",
        "Ambient lighting design",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Luxury guest suite with premium amenities",
      rangeEGP: "180,000+ EGP",
      disclaimer: "Requires detailed survey for accurate scope",
      characteristics: [
        "Suite-like experience",
        "Ensuite bathroom design",
        "Custom joinery",
        "Premium furnishing package",
      ],
    },
  ],
  "Kids Bedroom": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Safe, playful space with growth potential",
      rangeEGP: "60,000 - 120,000 EGP",
      disclaimer: "Varies based on age group and safety requirements",
      characteristics: [
        "Age-appropriate design",
        "Safe material selections",
        "Flexible storage systems",
        "Playful color palette",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Creative environment with refined organization",
      rangeEGP: "120,000 - 200,000 EGP",
      disclaimer: "Investment reflects adaptability and quality finishes",
      characteristics: [
        "Study zone integration",
        "Creative play areas",
        "Growing room flexibility",
        "Themed design elements",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Dream room with custom features",
      rangeEGP: "200,000+ EGP",
      disclaimer: "Precise quote requires child-specific needs assessment",
      characteristics: [
        "Custom bunk or loft",
        "Integrated study suite",
        "Theme-based design",
        "Safety-integrated luxury",
      ],
    },
  ],
  "Dressing Room": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Organized elegance with smart storage",
      rangeEGP: "40,000 - 80,000 EGP",
      disclaimer: "Depends on space configuration and access requirements",
      characteristics: [
        "Efficient storage systems",
        "Streamlined accessibility",
        "Clean visual organization",
        "Practical lighting solutions",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Luxurious dressing experience with refined details",
      rangeEGP: "80,000 - 150,000 EGP",
      disclaimer: "Final cost varies with custom element complexity",
      characteristics: [
        "Premium hardware integration",
        "Atmospheric vanity lighting",
        "Textile display systems",
        "Mirrored spatial enhancement",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Couture-level dressing suite with artisan touches",
      rangeEGP: "150,000+ EGP",
      disclaimer: "Requires detailed survey for accurate investment estimate",
      characteristics: [
        "Boutique-style display systems",
        "Climate-controlled storage",
        "Integrated jewelry safes",
        "Signature vanity design",
      ],
    },
  ],
  "Home Office": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Productive workspace with ergonomic focus",
      rangeEGP: "60,000 - 120,000 EGP",
      disclaimer: "Varies based on work requirements and technology needs",
      characteristics: [
        "Ergonomic desk setup",
        "Adequate task lighting",
        "File storage solutions",
        "Video-call ready backdrop",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Professional suite with sophisticated design",
      rangeEGP: "120,000 - 200,000 EGP",
      disclaimer: "Investment reflects technology integration and finish quality",
      characteristics: [
        "Built-in desk systems",
        "Cable management solutions",
        "Display shelving",
        "Acoustic considerations",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Executive workspace with custom solutions",
      rangeEGP: "200,000+ EGP",
      disclaimer: "Requires detailed workflow assessment",
      characteristics: [
        "Custom millwork desk",
        "Integrated technology hub",
        "Meeting area integration",
        "Biophilic design elements",
      ],
    },
  ],
  "Study Room": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Focused learning environment with basics",
      rangeEGP: "50,000 - 100,000 EGP",
      disclaimer: "Varies based on student age and study requirements",
      characteristics: [
        "Dedicated study desk",
        "Book storage solutions",
        "Concentration lighting",
        "Quiet zone designation",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Inspiring study space with refined organization",
      rangeEGP: "100,000 - 180,000 EGP",
      disclaimer: "Investment reflects storage complexity and finish quality",
      characteristics: [
        "Built-in study unit",
        "Library wall system",
        "Tutoring space potential",
        "Mood-enhancing palette",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Library-quality study with custom features",
      rangeEGP: "180,000+ EGP",
      disclaimer: "Precise quote requires educational needs assessment",
      characteristics: [
        "Custom library millwork",
        "Reading nook integration",
        "Display collections",
        "Heritage-quality finishes",
      ],
    },
  ],
  Bathroom: [
    {
      level: "Essential",
      emoji: "✨",
      description: "Clean functionality with modern updates",
      rangeEGP: "50,000 - 100,000 EGP",
      disclaimer: "Major variation based on plumbing repositioning needs",
      characteristics: [
        "Water-efficient fixtures",
        "Adequate ventilation",
        "Practical storage niches",
        "Safe flooring solutions",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Spa-like experience with quality finishes",
      rangeEGP: "100,000 - 200,000 EGP",
      disclaimer: "Investment reflects fixture quality and tile selections",
      characteristics: [
        "Rain shower experience",
        "Heated towel solutions",
        "Vanity storage integration",
        "Ambient lighting design",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Luxury spa retreat with premium features",
      rangeEGP: "200,000+ EGP",
      disclaimer: "Requires detailed plumbing and layout assessment",
      characteristics: [
        "Freestanding soaking tub",
        "Smart mirror technology",
        "Stone surround finishes",
        "Wellness feature integration",
      ],
    },
  ],
  "Guest Bathroom": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Functional powder room with smart updates",
      rangeEGP: "30,000 - 60,000 EGP",
      disclaimer: "Compact space optimization focused",
      characteristics: [
        "Space-efficient fixtures",
        "Clever storage niches",
        "Easy-clean surfaces",
        "Guest-ready amenities",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Elegant powder room with statement elements",
      rangeEGP: "60,000 - 100,000 EGP",
      disclaimer: "Investment reflects fixture statement quality",
      characteristics: [
        "Designer vanity piece",
        "Statement mirror design",
        "Accent lighting feature",
        "Luxury material touches",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Gallery-quality powder room experience",
      rangeEGP: "100,000+ EGP",
      disclaimer: "Requires detailed spatial and fixture assessment",
      characteristics: [
        "Custom vanity design",
        "Art-integrated concept",
        "Premium stone finishes",
        "Signature fixture selection",
      ],
    },
  ],
  "Entrance/Lobby": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Welcoming entry with practical organization",
      rangeEGP: "80,000 - 150,000 EGP",
      disclaimer: "Varies based on entry dimensions and traffic patterns",
      characteristics: [
        "Shoe storage solutions",
        "Seating for dressing",
        "Key organization",
        "First impression styling",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Grand entrance with sophisticated details",
      rangeEGP: "150,000 - 300,000 EGP",
      disclaimer: "Investment reflects millwork complexity and finishes",
      characteristics: [
        "Statement console piece",
        "Mirror art integration",
        "Concealed storage walls",
        "Layered lighting drama",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Dramatic arrival experience with custom features",
      rangeEGP: "300,000+ EGP",
      disclaimer: "Requires detailed architectural assessment",
      characteristics: [
        "Custom entry millwork",
        "Sculptural staircase",
        "Gallery wall systems",
        "Architectural lighting design",
      ],
    },
  ],
  "Full Unit": [
    {
      level: "Essential",
      emoji: "✨",
      description: "Cohesive home transformation with essential luxury",
      rangeEGP: "1,500,000 - 3,000,000 EGP",
      disclaimer: "Major variation based on unit size and structural scope",
      characteristics: [
        "Unified design language",
        "Essential space optimization",
        "Cohesive material palette",
        "Functional flow enhancement",
      ],
    },
    {
      level: "Refined",
      emoji: "🌟",
      description: "Comprehensive luxury with curated sophistication",
      rangeEGP: "3,000,000 - 5,000,000 EGP",
      disclaimer: "Investment reflects scope complexity and finish specifications",
      characteristics: [
        "Multi-room design narrative",
        "Integrated smart concepts",
        "Premium finish selections",
        "Architectural detail enhancements",
      ],
    },
    {
      level: "Bespoke",
      emoji: "💎",
      description: "Landmark residence with master-level execution",
      rangeEGP: "5,000,000+ EGP",
      disclaimer: "Precise investment requires comprehensive technical documentation",
      characteristics: [
        "Fully custom architectural elements",
        "Imported artisan features",
        "Integrated home systems",
        "Gallery-level finish execution",
      ],
    },
  ],
};

interface InvestmentBracketsProps {
  scope: ScopeType;
  selectedTier?: InvestmentTier["level"] | null;
  onSelect?: (tier: InvestmentTier) => void;
  className?: string;
}

export function InvestmentBrackets({
  scope,
  selectedTier,
  onSelect,
  className = "",
}: InvestmentBracketsProps) {
  const tiers = INVESTMENT_TIERS[scope];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.28em] text-amber-400/70">
          Investment Guidance
        </p>
        <h3 className="mt-2 text-2xl font-semibold text-white">
          Estimated Investment Ranges
        </h3>
        <p className="mt-2 text-sm text-white/60">
          For {scope} projects • Final costs vary significantly
        </p>
      </div>

      {/* Master Disclaimer */}
      <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4">
        <p className="text-xs text-amber-200/80">
          <span className="font-semibold">Important:</span> These are estimated ranges only. 
          Actual investment depends on final technical specifications, blueprint complexity, 
          material selections, and project timeline. A detailed technical survey is required 
          for accurate quoting.
        </p>
      </div>

      {/* Tiers */}
      <div className="grid gap-4">
        {tiers.map((tier, index) => (
          <motion.div
            key={tier.level}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelect?.(tier)}
            className={`relative cursor-pointer rounded-2xl border p-5 transition-all ${
              selectedTier === tier.level
                ? "border-amber-400 bg-gradient-to-r from-amber-500/20 to-yellow-400/10"
                : "border-white/10 bg-white/[0.02] hover:border-white/30"
            }`}
          >
            {/* Selection Indicator */}
            {selectedTier === tier.level && (
              <div className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-sm text-black">
                ✓
              </div>
            )}

            {/* Tier Header */}
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">{tier.emoji}</span>
              <div>
                <h4 className={`text-lg font-semibold ${
                  tier.level === "Bespoke" ? "text-amber-300" :
                  tier.level === "Refined" ? "text-yellow-300" : "text-white"
                }`}>
                  {tier.level}
                </h4>
                <p className="text-xs text-white/50">{tier.description}</p>
              </div>
            </div>

            {/* Investment Range */}
            <div className="mb-4 rounded-xl bg-black/20 p-3">
              <p className="text-xs text-white/40">Estimated Range</p>
              <p className={`text-xl font-bold ${
                tier.level === "Bespoke" ? "text-amber-400" :
                tier.level === "Refined" ? "text-yellow-400" : "text-white"
              }`}>
                {tier.rangeEGP}
              </p>
            </div>

            {/* Characteristics */}
            <ul className="mb-3 space-y-1">
              {tier.characteristics.map((char, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/70">
                  <span className="text-amber-400/70">•</span>
                  {char}
                </li>
              ))}
            </ul>

            {/* Tier Disclaimer */}
            <p className="text-[10px] text-white/30 italic">
              {tier.disclaimer}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
        <p className="text-sm text-white/70">
          Ready to define your exact scope?
        </p>
        <p className="mt-1 text-xs text-white/50">
          Our technical survey provides precise investment documentation
        </p>
      </div>
    </div>
  );
}

export default InvestmentBrackets;
