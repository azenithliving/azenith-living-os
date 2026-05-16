const fs = require('fs');

let content = fs.readFileSync('lib/site-content.ts', 'utf8');

content = content.replace(
  /export type FurnitureDefinition = \{[\s\S]*?\};/,
  `export type FurnitureDefinition = {
  slug: string;
  title: string;
  titleEn?: string;
  images: string[];
  video?: string;
  description: string;
  descriptionEn?: string;
  priceRange: string;
  features: string[];
  featuresEn?: string[];
  variations: string[];
  variationsEn?: string[];
};`
);

content = content.replace(
  /export type RoomDefinition = \{[\s\S]*?\};/,
  `export type RoomDefinition = {
  slug: string;
  title: string;
  titleEn?: string;
  eyebrow: string;
  eyebrowEn?: string;
  summary: string;
  summaryEn?: string;
  outcome: string;
  outcomeEn?: string;
  bullets: string[];
  bulletsEn?: string[];
  furniture: FurnitureDefinition[];
};`
);

fs.writeFileSync('lib/site-content.ts', content);
console.log("Updated types in site-content.ts");
