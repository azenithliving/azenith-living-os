/**
 * Web Tools - Search and Read Web Pages
 *
 * Provides web browsing capabilities for Mastermind AI
 * - searchWeb: Search using Apify Google Search Scraper
 * - readPage: Read and summarize web page content
 */

import axios from "axios";
import * as cheerio from "cheerio";

const APIFY_TOKEN = process.env.APIFY_API_TOKEN;

/**
 * Search the web using Apify Google Search Scraper
 * Returns top 5 results with title and link
 */
export async function searchWeb(query: string): Promise<string[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return ["⚠️ Apify API token غير موجود. أضف APIFY_API_TOKEN إلى متغيرات البيئة."];
  }

  try {
    // استخدام Actor جوجل الرسمي من Apify
    const runResponse = await axios.post(
      'https://api.apify.com/v2/acts/apify~google-search-scraper/runs',
      {
        "searchKeywords": query,
        "maxResults": 5,
        "resultsPerPage": 5,
      },
      {
        params: { token },
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    );

    const runId = runResponse.data.data.id;
    // انتظر قليلاً لانتهاء التشغيل (يمكن تحسينه)
    await new Promise(resolve => setTimeout(resolve, 8000));

    const datasetResponse = await axios.get(
      `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
      { params: { token, format: 'json' }, timeout: 10000 }
    );

    const items = datasetResponse.data;
    if (!items || items.length === 0) {
      return [`لا توجد نتائج لـ "${query}"`];
    }

    const results = items.slice(0, 5).map((item: any) => {
      const title = item.title || 'بدون عنوان';
      const link = item.link || '#';
      return `${title}: ${link}`;
    });
    return results;
  } catch (error: any) {
    console.error('[Search] Apify error:', error.response?.data || error.message);
    return [`❌ فشل البحث: ${error.message}. تأكد من التوكن وحصة الاستخدام.`];
  }
}

/**
 * Read a web page and extract its text content
 * Returns the page title and main content text
 */
export async function readPage(url: string): Promise<{
  success: boolean;
  title?: string;
  content?: string;
  message?: string;
}> {
  try {
    // Validate URL
    let validUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      validUrl = `https://${url}`;
    }

    const response = await axios.get(validUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
      },
      timeout: 15000,
      maxContentLength: 5 * 1024 * 1024, // 5MB limit
    });

    const $ = cheerio.load(response.data);

    // Extract title
    const title = $("title").text().trim() || $("h1").first().text().trim() || "No title";

    // Remove script and style elements
    $("script, style, nav, footer, header, aside").remove();

    // Try to find main content area
    let content = "";
    const contentSelectors = [
      "article",
      "main",
      "[role='main']",
      ".content",
      "#content",
      ".main-content",
      ".article-content",
      ".post-content",
      "body",
    ];

    for (const selector of contentSelectors) {
      const text = $(selector).text().trim();
      if (text.length > 100) {
        content = text;
        break;
      }
    }

    // If no main content found, get all text
    if (!content) {
      content = $("body").text().trim();
    }

    // Clean up the text
    content = content
      .replace(/\s+/g, " ")
      .replace(/\n+/g, "\n")
      .trim();

    // Limit content length
    const maxLength = 3000;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + "\n\n[تم تقصير المحتوى...]";
    }

    return {
      success: true,
      title,
      content: content || "No content available",
    };
  } catch (error) {
    console.error("[WebTools] Read page error:", error);
    return {
      success: false,
      message: `خطأ في قراءة الصفحة: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Format search results for display
 */
export function formatSearchResults(results: Array<{ title: string; link: string; snippet: string }>): string {
  if (results.length === 0) {
    return "لم يتم العثور على نتائج.";
  }

  return results
    .map((r, i) => `${i + 1}. **${r.title}**\n   🔗 ${r.link}\n   📝 ${r.snippet.substring(0, 150)}${r.snippet.length > 150 ? "..." : ""}`)
    .join("\n\n");
}

/**
 * Format page content for display
 */
export function formatPageContent(title: string, content: string): string {
  return `📄 **${title}**\n\n${content.substring(0, 2000)}${content.length > 2000 ? "\n\n[تم تقصير المحتوى...]" : ""}`;
}
