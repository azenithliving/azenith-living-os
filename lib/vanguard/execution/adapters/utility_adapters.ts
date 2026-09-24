/**
 * VANGUARD Utility Tool Adapters
 * 
 * أدوات مساعدة - حسابات، تواريخ، عملات، تنسيق أرقام عربية
 * Calculator, date/time utilities, currency conversion, Arabic number formatting
 */

import { z } from 'zod';
import type {
  ToolAdapter,
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionResult
} from '../tool_registry';

// ============================================================================
// Types
// ============================================================================

export interface CalculationResult {
  expression: string;
  result: number;
  formatted: string;
  formattedAr: string;
}

export interface DateTimeResult {
  date: string;
  time: string;
  timestamp: string;
  formatted: string;
  formattedAr: string;
  timezone: string;
}

export interface CurrencyConversionResult {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  convertedAmount: number;
  formatted: string;
  formattedAr: string;
}

export interface ArabicNumberResult {
  original: number;
  arabicNumerals: string;
  formatted: string;
  spelled: string;
}

// ============================================================================
// Schemas
// ============================================================================

const CalculateSchema = z.object({
  expression: z.string().min(1).max(200),
  precision: z.number().min(0).max(10).optional()
});

const GetDateTimeSchema = z.object({
  format: z.enum(['iso', 'date', 'time', 'datetime']).optional(),
  timezone: z.string().optional()
});

const ConvertCurrencySchema = z.object({
  amount: z.number().positive(),
  from: z.enum(['EGP', 'USD', 'EUR', 'SAR', 'AED']),
  to: z.enum(['EGP', 'USD', 'EUR', 'SAR', 'AED'])
});

const FormatArabicNumberSchema = z.object({
  number: z.number(),
  format: z.enum(['numerals', 'formatted', 'spelled']).optional()
});

const CalculateDurationSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  unit: z.enum(['days', 'weeks', 'months', 'years']).optional()
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely evaluate mathematical expressions
 */
function safeEval(expression: string): number {
  // Remove any non-math characters
  const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
  
  // Check for dangerous patterns
  if (/[a-zA-Z_$]/.test(sanitized)) {
    throw new Error('Invalid expression: contains non-numeric characters');
  }

  // Use Function constructor for safer evaluation
  try {
    const result = new Function(`'use strict'; return (${sanitized})`)();
    if (typeof result !== 'number' || !isFinite(result)) {
      throw new Error('Invalid calculation result');
    }
    return result;
  } catch {
    throw new Error('Invalid mathematical expression');
  }
}

/**
 * Convert Western numerals to Arabic-Indic numerals
 */
function toArabicNumerals(num: number | string): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/\d/g, (digit) => arabicNumerals[parseInt(digit)]);
}

/**
 * Format number with Arabic thousands separator
 */
function formatArabicNumber(num: number): string {
  const parts = num.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const decimalPart = parts[1];
  return decimalPart ? `${integerPart}٫${decimalPart}` : integerPart;
}

/**
 * Spell out number in Arabic (basic implementation for common ranges)
 */
function spellArabicNumber(num: number): string {
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  
  if (num === 0) return 'صفر';
  if (num < 0) return 'سالب ' + spellArabicNumber(-num);
  if (num >= 1000000) return num.toLocaleString('ar-EG');
  
  let result = '';
  
  // Thousands
  if (num >= 1000) {
    const thousands = Math.floor(num / 1000);
    if (thousands === 1) {
      result += 'ألف ';
    } else if (thousands === 2) {
      result += 'ألفان ';
    } else if (thousands <= 10) {
      result += ones[thousands] + ' آلاف ';
    } else {
      result += spellArabicNumber(thousands) + ' ألف ';
    }
    num %= 1000;
  }
  
  // Hundreds
  if (num >= 100) {
    result += hundreds[Math.floor(num / 100)] + ' ';
    num %= 100;
  }
  
  // Tens and ones
  if (num >= 20) {
    result += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  } else if (num >= 11) {
    const teens = ['', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    result += teens[num - 10];
    num = 0;
  } else if (num === 10) {
    result += 'عشرة';
    num = 0;
  }
  
  if (num > 0) {
    result += ones[num];
  }
  
  return result.trim();
}

/**
 * Get approximate currency exchange rates (EGP base)
 * Note: In production, fetch from a real API
 */
function getExchangeRates(): Record<string, number> {
  return {
    EGP: 1.0,
    USD: 0.032,    // ~31 EGP per USD
    EUR: 0.030,    // ~33 EGP per EUR
    SAR: 0.120,    // ~8.3 EGP per SAR
    AED: 0.118     // ~8.5 EGP per AED
  };
}

// ============================================================================
// Calculator Adapter
// ============================================================================

class CalculatorAdapter implements ToolAdapter<z.infer<typeof CalculateSchema>, CalculationResult> {
  definition: ToolDefinition = {
    id: 'calculate',
    name: 'Calculate',
    nameAr: 'حاسبة',
    description: 'Perform mathematical calculations',
    descriptionAr: 'تنفيذ العمليات الحسابية',
    category: 'calculation',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'expression',
        type: 'string',
        description: 'Mathematical expression',
        required: true,
        examples: ['10 + 20', '150000 * 0.15', '(100 + 50) / 2']
      },
      {
        name: 'precision',
        type: 'number',
        description: 'Decimal precision',
        required: false,
        default: 2,
        examples: [0, 2, 4]
      }
    ],
    returns: {
      type: 'CalculationResult',
      description: 'Calculation result with formatting',
      descriptionAr: 'نتيجة الحساب مع التنسيق'
    },
    examples: [
      {
        input: { expression: '150000 * 0.15', precision: 2 },
        output: {
          expression: '150000 * 0.15',
          result: 22500,
          formatted: '22,500.00',
          formattedAr: '٢٢٬٥٠٠٫٠٠'
        },
        description: 'Calculate 15% of 150,000 EGP'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = CalculateSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  async execute(
    input: z.infer<typeof CalculateSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<CalculationResult>> {
    const startTime = Date.now();

    try {
      const result = safeEval(input.expression);
      const precision = input.precision ?? 2;
      const rounded = Number(result.toFixed(precision));
      
      const formatted = rounded.toLocaleString('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision
      });
      
      const formattedAr = formatArabicNumber(rounded);

      return {
        success: true,
        data: {
          expression: input.expression,
          result: rounded,
          formatted,
          formattedAr
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: error instanceof Error ? error.message : 'Invalid expression',
          messageAr: 'خطأ في العملية الحسابية'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// Date/Time Adapter
// ============================================================================

class DateTimeAdapter implements ToolAdapter<z.infer<typeof GetDateTimeSchema>, DateTimeResult> {
  definition: ToolDefinition = {
    id: 'get_datetime',
    name: 'Get Date/Time',
    nameAr: 'الحصول على التاريخ والوقت',
    description: 'Get current date and time',
    descriptionAr: 'الحصول على التاريخ والوقت الحالي',
    category: 'calculation',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'format',
        type: 'string',
        description: 'Output format',
        required: false,
        default: 'datetime',
        examples: ['iso', 'date', 'time', 'datetime']
      },
      {
        name: 'timezone',
        type: 'string',
        description: 'Timezone',
        required: false,
        default: 'Africa/Cairo',
        examples: ['Africa/Cairo', 'Asia/Riyadh', 'UTC']
      }
    ],
    returns: {
      type: 'DateTimeResult',
      description: 'Current date and time information',
      descriptionAr: 'معلومات التاريخ والوقت الحالي'
    },
    examples: [
      {
        input: { format: 'datetime', timezone: 'Africa/Cairo' },
        output: {
          date: '2024-01-15',
          time: '14:30:00',
          timestamp: '2024-01-15T14:30:00+02:00',
          formatted: 'January 15, 2024 2:30 PM',
          formattedAr: '١٥ يناير ٢٠٢٤ ٢:٣٠ مساءً',
          timezone: 'Africa/Cairo'
        },
        description: 'Get current Cairo time'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = GetDateTimeSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async execute(
    input: z.infer<typeof GetDateTimeSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<DateTimeResult>> {
    const startTime = Date.now();

    try {
      const timezone = input.timezone || 'Africa/Cairo';
      const now = new Date();
      
      // Format date and time
      const date = now.toISOString().split('T')[0];
      const time = now.toTimeString().split(' ')[0];
      const timestamp = now.toISOString();
      
      const formatted = now.toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      const formattedAr = now.toLocaleString('ar-EG', {
        timeZone: timezone,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      return {
        success: true,
        data: {
          date,
          time,
          timestamp,
          formatted,
          formattedAr,
          timezone
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DATETIME_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'خطأ في الحصول على التاريخ والوقت'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// Currency Converter Adapter
// ============================================================================

class CurrencyConverterAdapter implements ToolAdapter<z.infer<typeof ConvertCurrencySchema>, CurrencyConversionResult> {
  definition: ToolDefinition = {
    id: 'convert_currency',
    name: 'Convert Currency',
    nameAr: 'تحويل العملات',
    description: 'Convert between currencies (EGP, USD, EUR, SAR, AED)',
    descriptionAr: 'التحويل بين العملات (جنيه، دولار، يورو، ريال)',
    category: 'calculation',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'amount',
        type: 'number',
        description: 'Amount to convert',
        required: true,
        examples: [1000, 50000]
      },
      {
        name: 'from',
        type: 'string',
        description: 'Source currency',
        required: true,
        examples: ['EGP', 'USD', 'EUR']
      },
      {
        name: 'to',
        type: 'string',
        description: 'Target currency',
        required: true,
        examples: ['USD', 'EUR', 'EGP']
      }
    ],
    returns: {
      type: 'CurrencyConversionResult',
      description: 'Converted amount with formatting',
      descriptionAr: 'المبلغ المحول مع التنسيق'
    },
    examples: [
      {
        input: { amount: 1000, from: 'USD', to: 'EGP' },
        output: {
          amount: 1000,
          fromCurrency: 'USD',
          toCurrency: 'EGP',
          rate: 31.0,
          convertedAmount: 31000,
          formatted: '31,000.00 EGP',
          formattedAr: '٣١٬٠٠٠٫٠٠ جنيه'
        },
        description: 'Convert 1000 USD to EGP'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = ConvertCurrencySchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async execute(
    input: z.infer<typeof ConvertCurrencySchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<CurrencyConversionResult>> {
    const startTime = Date.now();

    try {
      if (input.from === input.to) {
        return {
          success: true,
          data: {
            amount: input.amount,
            fromCurrency: input.from,
            toCurrency: input.to,
            rate: 1.0,
            convertedAmount: input.amount,
            formatted: `${input.amount.toFixed(2)} ${input.to}`,
            formattedAr: `${formatArabicNumber(input.amount)} ${input.to}`
          },
          metadata: {
            toolId: this.definition.id,
            executionTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };
      }

      const rates = getExchangeRates();
      
      // Convert to EGP first, then to target currency
      const amountInEGP = input.amount / rates[input.from];
      const convertedAmount = amountInEGP * rates[input.to];
      const rate = rates[input.to] / rates[input.from];
      
      const currencyNames: Record<string, string> = {
        EGP: 'جنيه',
        USD: 'دولار',
        EUR: 'يورو',
        SAR: 'ريال سعودي',
        AED: 'درهم إماراتي'
      };
      
      const formatted = `${convertedAmount.toFixed(2)} ${input.to}`;
      const formattedAr = `${formatArabicNumber(convertedAmount)} ${currencyNames[input.to]}`;

      return {
        success: true,
        data: {
          amount: input.amount,
          fromCurrency: input.from,
          toCurrency: input.to,
          rate,
          convertedAmount,
          formatted,
          formattedAr
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CURRENCY_CONVERSION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'خطأ في تحويل العملة'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// Arabic Number Formatter Adapter
// ============================================================================

class ArabicNumberFormatterAdapter implements ToolAdapter<z.infer<typeof FormatArabicNumberSchema>, ArabicNumberResult> {
  definition: ToolDefinition = {
    id: 'format_arabic_number',
    name: 'Format Arabic Number',
    nameAr: 'تنسيق الأرقام العربية',
    description: 'Format numbers in Arabic numerals and text',
    descriptionAr: 'تنسيق الأرقام بالأرقام العربية والنص',
    category: 'calculation',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'number',
        type: 'number',
        description: 'Number to format',
        required: true,
        examples: [1234, 50000]
      },
      {
        name: 'format',
        type: 'string',
        description: 'Format type',
        required: false,
        default: 'formatted',
        examples: ['numerals', 'formatted', 'spelled']
      }
    ],
    returns: {
      type: 'ArabicNumberResult',
      description: 'Formatted Arabic number',
      descriptionAr: 'الرقم المنسق بالعربية'
    },
    examples: [
      {
        input: { number: 1234, format: 'formatted' },
        output: {
          original: 1234,
          arabicNumerals: '١٢٣٤',
          formatted: '١٬٢٣٤',
          spelled: 'ألف ومئتان وأربعة وثلاثون'
        },
        description: 'Format 1234 in Arabic'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = FormatArabicNumberSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async execute(
    input: z.infer<typeof FormatArabicNumberSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<ArabicNumberResult>> {
    const startTime = Date.now();

    try {
      const arabicNumerals = toArabicNumerals(input.number);
      const formatted = formatArabicNumber(input.number);
      const spelled = spellArabicNumber(Math.floor(input.number));

      return {
        success: true,
        data: {
          original: input.number,
          arabicNumerals,
          formatted,
          spelled
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ARABIC_NUMBER_FORMAT_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'خطأ في تنسيق الرقم العربي'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// Duration Calculator Adapter
// ============================================================================

class DurationCalculatorAdapter implements ToolAdapter<z.infer<typeof CalculateDurationSchema>, { duration: number; unit: string; formatted: string; formattedAr: string }> {
  definition: ToolDefinition = {
    id: 'calculate_duration',
    name: 'Calculate Duration',
    nameAr: 'حساب المدة',
    description: 'Calculate duration between two dates',
    descriptionAr: 'حساب المدة الزمنية بين تاريخين',
    category: 'calculation',
    riskLevel: 'LOW',
    parameters: [
      {
        name: 'startDate',
        type: 'string',
        description: 'Start date (ISO format)',
        required: true,
        examples: ['2024-01-01', '2024-06-15']
      },
      {
        name: 'endDate',
        type: 'string',
        description: 'End date (ISO format)',
        required: true,
        examples: ['2024-12-31', '2024-07-15']
      },
      {
        name: 'unit',
        type: 'string',
        description: 'Duration unit',
        required: false,
        default: 'days',
        examples: ['days', 'weeks', 'months']
      }
    ],
    returns: {
      type: 'object',
      description: 'Duration between dates',
      descriptionAr: 'المدة الزمنية بين التاريخين'
    },
    examples: [
      {
        input: { startDate: '2024-01-01', endDate: '2024-01-31', unit: 'days' },
        output: { duration: 30, unit: 'days', formatted: '30 days', formattedAr: '٣٠ يوماً' },
        description: 'Calculate days in January 2024'
      }
    ]
  };

  validate(input: unknown): { valid: boolean; errors?: string[] } {
    const result = CalculateDurationSchema.safeParse(input);
    if (result.success) {
      return { valid: true };
    }
    return {
      valid: false,
      errors: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
    };
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async execute(
    input: z.infer<typeof CalculateDurationSchema>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult<{ duration: number; unit: string; formatted: string; formattedAr: string }>> {
    const startTime = Date.now();

    try {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error('Invalid date format');
      }

      const diffMs = end.getTime() - start.getTime();
      const unit = input.unit || 'days';
      
      let duration: number;
      let unitAr: string;
      
      switch (unit) {
        case 'days':
          duration = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          unitAr = 'يوماً';
          break;
        case 'weeks':
          duration = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7));
          unitAr = 'أسبوعاً';
          break;
        case 'months':
          duration = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
          unitAr = 'شهراً';
          break;
        case 'years':
          duration = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365));
          unitAr = 'سنة';
          break;
        default:
          duration = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          unitAr = 'يوماً';
      }

      const formatted = `${duration} ${unit}`;
      const formattedAr = `${toArabicNumerals(duration)} ${unitAr}`;

      return {
        success: true,
        data: {
          duration,
          unit,
          formatted,
          formattedAr
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DURATION_CALCULATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
          messageAr: 'خطأ في حساب المدة'
        },
        metadata: {
          toolId: this.definition.id,
          executionTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

export const calculatorAdapter = new CalculatorAdapter();
export const dateTimeAdapter = new DateTimeAdapter();
export const currencyConverterAdapter = new CurrencyConverterAdapter();
export const arabicNumberFormatterAdapter = new ArabicNumberFormatterAdapter();
export const durationCalculatorAdapter = new DurationCalculatorAdapter();

// Register all utility adapters
export function registerUtilityAdapters(registry: { register: (adapter: ToolAdapter) => void }) {
  registry.register(calculatorAdapter);
  registry.register(dateTimeAdapter);
  registry.register(currencyConverterAdapter);
  registry.register(arabicNumberFormatterAdapter);
  registry.register(durationCalculatorAdapter);
}
