const fs = require('fs');

let content = fs.readFileSync('lib/site-content.ts', 'utf8');

const additions = [
  { slug: "master-bedroom", eyebrowEn: "Calculated Privacy", summaryEn: "A calm space with hotel details, layered lighting, and long-lasting materials.", outcomeEn: "A design that transforms the room from mere furnishing to a comfortable and cohesive daily experience.", bulletsEn: ["Clear movement distribution", "Hidden storage solutions", "Warm materials palette", "Harmony between bed and dressing"] },
  { slug: "living-room", eyebrowEn: "Confident Reception", summaryEn: "A hall that carries the social character of the home with a balance between comfort and the overall scene.", outcomeEn: "Visually and practically studied seating with a strong visual center and comfortable movement paths.", bulletsEn: ["TV and main wall treatment", "Flexible seating distribution", "Hospitality lighting solutions", "Choosing fabrics suitable for daily use"] },
  { slug: "kitchen", eyebrowEn: "Cleaner Daily Performance", summaryEn: "Modern kitchens balancing function and form with care for storage and ease of use.", outcomeEn: "A practical kitchen with meticulous facades, shortened usage paths, and a finish that looks more expensive than its cost.", bulletsEn: ["Smart movement triangle", "Vertical exploitation of storage", "Resistant and easy to clean materials", "Lighting solutions above workspaces"] },
  { slug: "dressing-room", eyebrowEn: "Luxurious Organization", summaryEn: "A clearly divided dressing room that elevates the daily experience and reduces clutter.", outcomeEn: "Calculated storage units, mirrors, and lighting that make the space practical and luxurious at the same time.", bulletsEn: ["Effective internal divisions", "Cosmetic mirrors and lighting", "Maximum use of space", "Materials consistent with the main room"] },
  { slug: "home-office", eyebrowEn: "Focus Without Distraction", summaryEn: "A home office that maintains the home's identity with real readiness for long work.", outcomeEn: "A comfortable workspace, clean visual background, and storage that makes the space productive and not temporary.", bulletsEn: ["Practical task lighting", "Meeting background treatment", "Files and accessories storage", "Visual comfort for long sessions"] },
  { slug: "youth-room", eyebrowEn: "Flexibility That Grows Over Time", summaryEn: "Rooms that combine personality and practicality with scalable solutions instead of rapid change.", outcomeEn: "A flexible space for sleeping, studying, and storage, with an identity that suits age and use.", bulletsEn: ["Clear study corners", "Storage that reduces clutter", "Calculated colors", "Furniture that can be developed later"] },
  { slug: "dining-room", eyebrowEn: "Elegant Family Gatherings", summaryEn: "A design that combines elegance and practicality for exceptional dining experiences.", outcomeEn: "An interconnected dining space with warm lighting and comfortable distribution.", bulletsEn: ["Expandable tables", "Comfortable chairs", "Display cabinets"] },
  { slug: "interior-design", eyebrowEn: "Integrated Vision", summaryEn: "Comprehensive design for the entire home with harmony between all spaces.", outcomeEn: "A harmonious home that reflects your personality.", bulletsEn: ["Comprehensive design", "Material selection", "Execution supervision"] }
];

for (const add of additions) {
  content = content.replace(
    new RegExp(`(slug:\\s*"${add.slug}"[\\s\\S]*?eyebrow:\\s*".*?",)`, 'g'),
    `$1\n    eyebrowEn: "${add.eyebrowEn}",\n    summaryEn: "${add.summaryEn}",\n    outcomeEn: "${add.outcomeEn}",\n    bulletsEn: ${JSON.stringify(add.bulletsEn)},`
  );
}

// Fix Furniture
const furnAdditions = [
  { slug: "master-bed", titleEn: "Luxury Master Bed" },
  { slug: "nightstands", titleEn: "Nightstands" },
  { slug: "sofa-master", titleEn: "Master Bedroom Sofa" },
  { slug: "living-sofa", titleEn: "Classic Living Sofa" },
  { slug: "corner-sofa-living", titleEn: "Living Room Corner Sofa" },
  { slug: "kitchen-sofa", titleEn: "Small Kitchen Sofa" },
  { slug: "dressing-sofa", titleEn: "Small Dressing Sofa" },
  { slug: "office-sofa", titleEn: "Home Office Sofa" },
  { slug: "youth-sofa", titleEn: "Versatile Youth Sofa" },
  { slug: "corner-sofa-youth", titleEn: "Youth Room Corner Sofa" },
  { slug: "dining-table", titleEn: "Luxury Dining Table" },
];

for (const f of furnAdditions) {
  content = content.replace(
    new RegExp(`(slug:\\s*"${f.slug}",[\\s\\S]*?title:\\s*".*?",)`, 'g'),
    `$1\n        titleEn: "${f.titleEn}",`
  );
}

fs.writeFileSync('lib/site-content.ts', content);
console.log("Updated site-content.ts");
