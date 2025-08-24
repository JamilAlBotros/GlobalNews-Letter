#!/usr/bin/env node

/**
 * Google News RSS URL Generator
 * Generates RSS URLs for Google News based on topics or search queries
 */

import inquirer from 'inquirer';

// Type definitions
interface Topics {
  readonly [key: string]: string;
}

interface Countries {
  readonly [key: string]: string;
}

interface Languages {
  readonly [key: string]: string;
}

interface TimeFrames {
  readonly [key: string]: string;
}

interface UserAnswers {
  mode: 'topic' | 'search';
  topic?: string;
  searchQuery?: string;
  timeFrame?: string;
  country: string;
  language: string;
}

// Predefined topics with their Google News topic IDs
const topics: Topics = {
  World: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB',
  Business: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB',
  Technology: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVA',
  Science: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB'
} as const;

// Predefined countries and languages
const countries: Countries = {
  'United States': 'US',
  'United Kingdom': 'GB',
  'France': 'FR',
  'Germany': 'DE',
  'Spain': 'ES',
  'Brazil': 'BR',
  'Canada': 'CA',
  'Australia': 'AU'
} as const;

const languages: Languages = {
  'English': 'en',
  'French': 'fr',
  'German': 'de',
  'Spanish': 'es',
  'Portuguese': 'pt'
} as const;

// Time frame options for search queries
const timeFrames: TimeFrames = {
  'Last hour': '1h',
  'Last 24 hours': '24h',
  'Last 7 days': '7d',
  'Last 30 days': '30d',
  'Last year': '1y'
} as const;

/**
 * Validate that selected options exist in their respective objects
 */
function validateSelections(answers: UserAnswers): boolean {
  const commonValid = answers.country in countries && answers.language in languages;
  
  if (answers.mode === 'topic') {
    return commonValid && !!answers.topic && answers.topic in topics;
  } else {
    return commonValid && !!answers.searchQuery && !!answers.timeFrame && answers.timeFrame in timeFrames;
  }
}

/**
 * Generate Google News RSS URL for topics
 */
function generateTopicRSSUrl(topicId: string, countryCode: string, langCode: string): string {
  return `https://news.google.com/rss/topics/${topicId}?hl=${langCode}&gl=${countryCode}&ceid=${countryCode}:${langCode}`;
}

/**
 * Generate Google News RSS URL for search queries
 */
function generateSearchRSSUrl(query: string, timeFrame: string, countryCode: string, langCode: string): string {
  const encodedQuery = encodeURIComponent(`${query} when:${timeFrame}`);
  return `https://news.google.com/rss/search?q=${encodedQuery}&hl=${langCode}&gl=${countryCode}&ceid=${countryCode}:${langCode}`;
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    console.log('\n🌍 Google News RSS URL Generator\n');

    // First, ask for the mode
    const modeAnswer = await inquirer.prompt<{ mode: 'topic' | 'search' }>([
      {
        type: 'list',
        name: 'mode',
        message: 'How would you like to generate the RSS URL?',
        choices: [
          { name: '📂 Browse by topic (World, Business, Tech, etc.)', value: 'topic' },
          { name: '🔍 Search by custom query', value: 'search' }
        ]
      }
    ]);

    let answers: UserAnswers;

    if (modeAnswer.mode === 'topic') {
      // Topic-based flow
      const topicAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'topic',
          message: 'Select a news topic:',
          choices: Object.keys(topics)
        },
        {
          type: 'list',
          name: 'country',
          message: 'Select a country:',
          choices: Object.keys(countries)
        },
        {
          type: 'list',
          name: 'language',
          message: 'Select a language:',
          choices: Object.keys(languages)
        }
      ]);

      answers = { mode: 'topic', ...topicAnswers };
    } else {
      // Search-based flow
      const searchAnswers = await inquirer.prompt([
        {
          type: 'input',
          name: 'searchQuery',
          message: 'Enter your search query:',
          validate: (input: string) => input.trim().length > 0 || 'Search query cannot be empty'
        },
        {
          type: 'list',
          name: 'timeFrame',
          message: 'Select time frame:',
          choices: Object.keys(timeFrames)
        },
        {
          type: 'list',
          name: 'country',
          message: 'Select a country:',
          choices: Object.keys(countries)
        },
        {
          type: 'list',
          name: 'language',
          message: 'Select a language:',
          choices: Object.keys(languages)
        }
      ]);

      answers = { mode: 'search', ...searchAnswers };
    }

    // Validate selections
    if (!validateSelections(answers)) {
      throw new Error('Invalid selection detected');
    }

    const countryCode = countries[answers.country];
    const langCode = languages[answers.language];

    if (!countryCode || !langCode) {
      throw new Error('Failed to retrieve country or language values');
    }

    let rssUrl: string;

    if (answers.mode === 'topic' && answers.topic) {
      const topicId = topics[answers.topic];
      if (!topicId) {
        throw new Error('Failed to retrieve topic ID');
      }
      rssUrl = generateTopicRSSUrl(topicId, countryCode, langCode);
    } else if (answers.mode === 'search' && answers.searchQuery && answers.timeFrame) {
      const timeFrameCode = timeFrames[answers.timeFrame];
      if (!timeFrameCode) {
        throw new Error('Failed to retrieve time frame code');
      }
      rssUrl = generateSearchRSSUrl(answers.searchQuery, timeFrameCode, countryCode, langCode);
    } else {
      throw new Error('Invalid mode or missing required fields');
    }

    console.log('\n✅ Generated Google News RSS URL:');
    console.log(`📡 ${rssUrl}\n`);

    if (answers.mode === 'search') {
      console.log(`🔍 Search Query: "${answers.searchQuery}"`);
      console.log(`⏰ Time Frame: ${answers.timeFrame}`);
    } else {
      console.log(`📂 Topic: ${answers.topic}`);
    }
    console.log(`🌍 Country: ${answers.country}`);
    console.log(`🗣️  Language: ${answers.language}\n`);

    console.log('💡 You can now test this URL with:');
    console.log(`   npm run rss-test "${rssUrl}"`);

  } catch (error) {
    console.error('❌ Error generating RSS URL:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run main function if this file is executed directly
main().catch(console.error);
