/**
 * Seed script to populate curated_images table with Pexels IDs and metadata
 * Run: npx ts-node scripts/seed-images.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

// Real Pexels image IDs with metadata by category
const seedData = [
  // Classic/White-Gold interiors
  {
    id: 1571453,
    url: "https://images.pexels.com/photos/1571453/pexels-photo-1571453.jpeg",
    room_type: "master-bedroom",
    style: "classic",
    metadata: {
      colorPalette: {
        primary: "#F5F5DC",
        secondary: "#D4AF37",
        accent: "#8B7355",
        neutrals: ["#FFFFFF", "#F0F0F0"]
      },
      materials: [
        { name: "Italian Marble", type: "stone", finish: "polished" },
        { name: "Brass", type: "metal", finish: "polished" }
      ],
      styleConfidence: 0.92,
      analyzedAt: new Date().toISOString()
    }
  },
  {
    id: 164595,
    url: "https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg",
    room_type: "master-bedroom",
    style: "classic",
    metadata: {
      colorPalette: {
        primary: "#FFF8DC",
        secondary: "#DAA520",
        accent: "#8B4513",
        neutrals: ["#FFFAF0", "#F5F5DC"]
      },
      materials: [
        { name: "Oak Wood", type: "wood", finish: "matte" },
        { name: "Velvet", type: "fabric", finish: "soft" }
      ],
      styleConfidence: 0.88,
      analyzedAt: new Date().toISOString()
    }
  },
  // Modern/Grey interiors
  {
    id: 1457842,
    url: "https://images.pexels.com/photos/1457842/pexels-photo-1457842.jpeg",
    room_type: "living-room",
    style: "modern",
    metadata: {
      colorPalette: {
        primary: "#708090",
        secondary: "#2F4F4F",
        accent: "#4682B4",
        neutrals: ["#D3D3D3", "#C0C0C0"]
      },
      materials: [
        { name: "Concrete", type: "stone", finish: "matte" },
        { name: "Steel", type: "metal", finish: "brushed" }
      ],
      styleConfidence: 0.95,
      analyzedAt: new Date().toISOString()
    }
  },
  // Nature/Green-Wood interiors
  {
    id: 1080696,
    url: "https://images.pexels.com/photos/1080696/pexels-photo-1080696.jpeg",
    room_type: "living-room",
    style: "nature",
    metadata: {
      colorPalette: {
        primary: "#228B22",
        secondary: "#8B4513",
        accent: "#90EE90",
        neutrals: ["#F5F5DC", "#DEB887"]
      },
      materials: [
        { name: "Bamboo", type: "wood", finish: "natural" },
        { name: "Linen", type: "fabric", finish: "woven" }
      ],
      styleConfidence: 0.90,
      analyzedAt: new Date().toISOString()
    }
  },
  {
    id: 280232,
    url: "https://images.pexels.com/photos/280232/pexels-photo-280232.jpeg",
    room_type: "kitchen",
    style: "modern",
    metadata: {
      colorPalette: {
        primary: "#FFFFFF",
        secondary: "#C0C0C0",
        accent: "#4169E1",
        neutrals: ["#F5F5F5", "#E0E0E0"]
      },
      materials: [
        { name: "Quartz", type: "stone", finish: "polished" },
        { name: "Chrome", type: "metal", finish: "polished" }
      ],
      styleConfidence: 0.93,
      analyzedAt: new Date().toISOString()
    }
  },
  // Dressing Room
  {
    id: 1860193,
    url: "https://images.pexels.com/photos/1860193/pexels-photo-1860193.jpeg",
    room_type: "dressing-room",
    style: "luxury",
    metadata: {
      colorPalette: {
        primary: "#FFD700",
        secondary: "#4A4A4A",
        accent: "#FF6347",
        neutrals: ["#FFFFFF", "#F8F8F8"]
      },
      materials: [
        { name: "Walnut", type: "wood", finish: "glossy" },
        { name: "Glass", type: "glass", finish: "clear" }
      ],
      styleConfidence: 0.91,
      analyzedAt: new Date().toISOString()
    }
  },
  // Modern Classic Mix
  {
    id: 1571460,
    url: "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg",
    room_type: "living-room",
    style: "modern-classic",
    metadata: {
      colorPalette: {
        primary: "#2F4F4F",
        secondary: "#D4AF37",
        accent: "#DC143C",
        neutrals: ["#F5F5F5", "#D3D3D3"]
      },
      materials: [
        { name: "Velvet", type: "fabric", finish: " plush" },
        { name: "Marble", type: "stone", finish: "honed" }
      ],
      styleConfidence: 0.87,
      analyzedAt: new Date().toISOString()
    }
  },
  // Interior Design (for the missing card)
  {
    id: 1648771,
    url: "https://images.pexels.com/photos/1648771/pexels-photo-1648771.jpeg",
    room_type: "interior-design",
    style: "contemporary",
    metadata: {
      colorPalette: {
        primary: "#E0E0E0",
        secondary: "#808080",
        accent: "#FFD700",
        neutrals: ["#FFFFFF", "#F0F0F0"]
      },
      materials: [
        { name: "Plaster", type: "stone", finish: "matte" },
        { name: "Leather", type: "fabric", finish: "polished" }
      ],
      styleConfidence: 0.89,
      analyzedAt: new Date().toISOString()
    }
  },
  {
    id: 1648776,
    url: "https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg",
    room_type: "interior-design",
    style: "contemporary",
    metadata: {
      colorPalette: {
        primary: "#F5F5DC",
        secondary: "#8B7355",
        accent: "#CD853F",
        neutrals: ["#FFF8DC", "#F0E68C"]
      },
      materials: [
        { name: "Oak", type: "wood", finish: "natural" },
        { name: "Cotton", type: "fabric", finish: "woven" }
      ],
      styleConfidence: 0.85,
      analyzedAt: new Date().toISOString()
    }
  }
];

async function seedImages() {
  console.log("[Seed] Starting curated_images seed...");
  
  for (const image of seedData) {
    try {
      const { error } = await supabase
        .from("curated_images")
        .upsert(image, { onConflict: "id" });
      
      if (error) {
        console.warn(`[Seed] Failed to insert ${image.id}:`, error.message);
      } else {
        console.log(`[Seed] ✓ Inserted ${image.id} (${image.room_type})`);
      }
    } catch (err) {
      console.error(`[Seed] Error inserting ${image.id}:`, err);
    }
  }
  
  console.log("[Seed] Complete!");
  process.exit(0);
}

seedImages();
