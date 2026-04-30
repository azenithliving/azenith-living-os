/**
 * GLOBAL TACTICAL ATLAS v1.0
 * A comprehensive dataset of countries, timezones, and primary languages.
 * Used for deep-level regional identity spoofing.
 */

export interface TacticalRegion {
  code: string;
  name: string;
  timezone: string;
  primaryLanguage: string;
}

export const TACTICAL_REGIONS: TacticalRegion[] = [
  { code: "US", name: "United States", timezone: "America/New_York", primaryLanguage: "en-US" },
  { code: "GB", name: "United Kingdom", timezone: "Europe/London", primaryLanguage: "en-GB" },
  { code: "EG", name: "Egypt", timezone: "Africa/Cairo", primaryLanguage: "ar-EG" },
  { code: "SA", name: "Saudi Arabia", timezone: "Asia/Riyadh", primaryLanguage: "ar-SA" },
  { code: "AE", name: "United Arab Emirates", timezone: "Asia/Dubai", primaryLanguage: "ar-AE" },
  { code: "FR", name: "France", timezone: "Europe/Paris", primaryLanguage: "fr-FR" },
  { code: "DE", name: "Germany", timezone: "Europe/Berlin", primaryLanguage: "de-DE" },
  { code: "RU", name: "Russia", timezone: "Europe/Moscow", primaryLanguage: "ru-RU" },
  { code: "CN", name: "China", timezone: "Asia/Shanghai", primaryLanguage: "zh-CN" },
  { code: "JP", name: "Japan", timezone: "Asia/Tokyo", primaryLanguage: "ja-JP" },
  { code: "CA", name: "Canada", timezone: "America/Toronto", primaryLanguage: "en-CA" },
  { code: "AU", name: "Australia", timezone: "Australia/Sydney", primaryLanguage: "en-AU" },
  { code: "BR", name: "Brazil", timezone: "America/Sao_Paulo", primaryLanguage: "pt-BR" },
  { code: "IN", name: "India", timezone: "Asia/Kolkata", primaryLanguage: "hi-IN" },
  { code: "TR", name: "Turkey", timezone: "Europe/Istanbul", primaryLanguage: "tr-TR" },
  { code: "IT", name: "Italy", timezone: "Europe/Rome", primaryLanguage: "it-IT" },
  { code: "ES", name: "Spain", timezone: "Europe/Madrid", primaryLanguage: "es-ES" },
  { code: "CH", name: "Switzerland", timezone: "Europe/Zurich", primaryLanguage: "de-CH" },
  { code: "NL", name: "Netherlands", timezone: "Europe/Amsterdam", primaryLanguage: "nl-NL" },
  { code: "SE", name: "Sweden", timezone: "Europe/Stockholm", primaryLanguage: "sv-SE" }
];

export const TACTICAL_LANGUAGES = [
  { code: "en-US", name: "English (US)" },
  { code: "en-GB", name: "English (UK)" },
  { code: "ar-EG", name: "Arabic (Egypt)" },
  { code: "ar-SA", name: "Arabic (Saudi)" },
  { code: "fr-FR", name: "French" },
  { code: "de-DE", name: "German" },
  { code: "es-ES", name: "Spanish" },
  { code: "ru-RU", name: "Russian" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "ja-JP", name: "Japanese" }
];

export const getRegionByCode = (code: string) => {
  return TACTICAL_REGIONS.find(r => r.code === code) || TACTICAL_REGIONS[0];
};
