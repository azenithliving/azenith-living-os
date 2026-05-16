const fs = require('fs');

const constantsPath = 'lib/constants/rooms.ts';
let code = fs.readFileSync(constantsPath, 'utf8');

code = code.replace(
  /export type LandingRoom = \{[\s\S]*?\};/,
  `export type LandingRoom = {
  slug: string;
  eyebrow: string;
  eyebrowEn?: string;
  title: string;
  titleEn?: string;
  summary: string;
  summaryEn?: string;
};`
);

fs.writeFileSync(constantsPath, code);
