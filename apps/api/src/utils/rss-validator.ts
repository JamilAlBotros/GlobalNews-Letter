import { z } from "zod";

export interface RSSValidationResult {
  isValid: boolean;
  message: string;
  hasEntries?: boolean;
  feedTitle?: string;
  entryCount?: number;
}

export const RSSValidationInput = z.object({
  url: z.string().url(),
  timeout: z.number().optional().default(10000)
});

export type RSSValidationInputType = z.input<typeof RSSValidationInput>;

export async function validateRSSFeed(input: RSSValidationInputType): Promise<RSSValidationResult> {
  const validated = RSSValidationInput.parse(input);
  const { url, timeout } = validated;

  try {
    // Import feedparser dynamically to avoid issues with ESM/CJS
    const Parser = await import('rss-parser');
    const parser = new Parser.default();

    // Set up timeout for the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const feed = await parser.parseURL(url);
      clearTimeout(timeoutId);

      if (!feed) {
        return {
          isValid: false,
          message: "Failed to parse feed - no data returned"
        };
      }

      const entryCount = feed.items?.length || 0;
      const hasEntries = entryCount > 0;

      if (hasEntries) {
        return {
          isValid: true,
          message: `Valid RSS feed with ${entryCount} entries`,
          hasEntries: true,
          feedTitle: feed.title,
          entryCount
        };
      } else {
        return {
          isValid: true,
          message: "Valid RSS feed structure but no entries found",
          hasEntries: false,
          feedTitle: feed.title,
          entryCount: 0
        };
      }
    } catch (parseError: any) {
      clearTimeout(timeoutId);
      
      if (parseError.name === 'AbortError') {
        return {
          isValid: false,
          message: `Request timed out after ${timeout}ms`
        };
      }

      return {
        isValid: false,
        message: `Failed to parse RSS feed: ${parseError.message}`
      };
    }
  } catch (error: any) {
    return {
      isValid: false,
      message: `Network error: ${error.message}`
    };
  }
}

export class RSSValidationError extends Error {
  constructor(
    message: string,
    public readonly validationResult: RSSValidationResult
  ) {
    super(message);
    this.name = 'RSSValidationError';
  }
}