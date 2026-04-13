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
 * Returns top 5 results with title, link, and snippet
 */
export async function searchWeb(query: string): Promise<{
  success: boolean;
  results?: Array<{
    title: string;
    link: string;
    snippet: string;
  }>;
  message?: string;
}> {
  try {
    if (!APIFY_TOKEN) {
      return {
        success: false,
        message: "APIFY_API_TOKEN not configured",
      };
    }

    // Start Apify actor run
    const startResponse = await axios.post(
      "https://api.apify.com/v2/acts/apify~google-search-scraper/runs",
      {
        queries: query,
        maxResults: 5,
      },
      {
        headers: {
          Authorization: `Bearer ${APIFY_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const runId = startResponse.data.data.id;

    // Wait for the run to complete (poll every 2 seconds, max 30 seconds)
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await axios.get(
        `https://api.apify.com/v2/acts/apify~google-search-scraper/runs/${runId}`,
        {
          headers: {
            Authorization: `Bearer ${APIFY_TOKEN}`,
          },
        }
      );

      const status = statusResponse.data.data.status;

      if (status === "SUCCEEDED") {
        // Get the dataset items
        const datasetResponse = await axios.get(
          `https://api.apify.com/v2/acts/apify~google-search-scraper/runs/${runId}/dataset/items`,
          {
            headers: {
              Authorization: `Bearer ${APIFY_TOKEN}`,
            },
          }
        );

        const items = datasetResponse.data;

        if (!items || items.length === 0) {
          return {
            success: false,
            message: "لم يتم العثور على نتائج للبحث",
          };
        }

        // Parse results from Apify output
        const results: Array<{ title: string; link: string; snippet: string }> = [];

        for (const item of items) {
          if (item.organicResults) {
            for (const result of item.organicResults.slice(0, 5)) {
              if (results.length >= 5) break;
              results.push({
                title: result.title || "No title",
                link: result.url || result.link || "",
                snippet: result.description || result.snippet || "No description available",
              });
            }
          }
        }

        if (results.length === 0) {
          return {
            success: false,
            message: "لم يتم العثور على نتائج للبحث",
          };
        }

        return {
          success: true,
          results,
        };
      }

      if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
        return {
          success: false,
          message: `Search failed with status: ${status}`,
        };
      }

      attempts++;
    }

    return {
      success: false,
      message: "Search timed out",
    };
  } catch (error) {
    console.error("[WebTools] Search error:", error);
    return {
      success: false,
      message: `خطأ في البحث: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
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
