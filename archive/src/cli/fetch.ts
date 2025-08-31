#!/usr/bin/env node

import inquirer from 'inquirer';
import { ArticleService } from '../services/articles.js';
import type { Category, Language, FilterOptions } from '../types/index.js';

/**
 * CLI for fetching articles from NewsAPI
 */
class FetchCLI {
  private articleService: ArticleService;

  constructor() {
    this.articleService = new ArticleService();
  }

  async run(): Promise<void> {
    console.log('🌍 GlobalNews Letter - Article Fetcher\n');

    try {
      // Test services
      console.log('Testing services...');
      const status = await this.articleService.testServices();
      console.log(`NewsAPI: ${status.newsAPI ? '✅' : '❌'}`);
      console.log(`LLM Service: ${status.llm ? '✅' : '❌'}`);
      
      if (!status.newsAPI) {
        console.error('❌ NewsAPI is not available. Check your API key and connection.');
        process.exit(1);
      }

      if (!status.llm) {
        console.warn('⚠️  LLM service is not available. Summaries will use fallback text.');
      }

      console.log('');

      const choice = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Fetch articles by category (NewsAPI)', value: 'category' },
            { name: 'Fetch top headlines (NewsAPI)', value: 'headlines' },
            { name: 'Search articles by keyword (NewsAPI)', value: 'search' },
            { name: 'Fetch from RSS feeds', value: 'rss' },
            { name: 'Manage RSS subscriptions', value: 'manage-rss' },
            { name: 'View stored articles', value: 'view' },
            { name: 'View statistics', value: 'stats' },
            { name: 'Cleanup old articles', value: 'cleanup' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      switch (choice.action) {
        case 'category':
          await this.fetchByCategory();
          break;
        case 'headlines':
          await this.fetchHeadlines();
          break;
        case 'search':
          await this.searchArticles();
          break;
        case 'rss':
          await this.fetchFromRSS();
          break;
        case 'manage-rss':
          await this.manageRSSFeeds();
          break;
        case 'view':
          await this.viewArticles();
          break;
        case 'stats':
          await this.showStats();
          break;
        case 'cleanup':
          await this.cleanupArticles();
          break;
        case 'exit':
          console.log('Goodbye! 👋');
          break;
        default:
          console.log('Invalid choice');
      }
    } catch (error) {
      console.error('An error occurred:', error);
    } finally {
      this.articleService.close();
    }
  }

  private async fetchByCategory(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: 'Select category:',
        choices: [
          { name: 'Finance', value: 'finance' },
          { name: 'Technology', value: 'tech' }
        ]
      },
      {
        type: 'list',
        name: 'language',
        message: 'Select language:',
        choices: [
          { name: 'English', value: 'english' },
          { name: 'Spanish', value: 'spanish' },
          { name: 'Arabic', value: 'arabic' }
        ]
      }
    ]);

    console.log(`\nFetching ${answers.category} articles in ${answers.language}...`);
    const articles = await this.articleService.fetchArticlesByCategory(
      answers.category as Category,
      answers.language as Language
    );

    console.log(`✅ Fetched ${articles.length} new articles`);
    
    if (articles.length > 0) {
      console.log('\nLatest articles:');
      articles.slice(0, 5).forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
        console.log(`   Source: ${article.source} | Published: ${article.publishedAt.toLocaleDateString()}`);
      });
    }
  }

  private async fetchHeadlines(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: 'Select category for headlines:',
        choices: [
          { name: 'Finance', value: 'finance' },
          { name: 'Technology', value: 'tech' }
        ]
      },
      {
        type: 'list',
        name: 'language',
        message: 'Select language:',
        choices: [
          { name: 'English', value: 'english' },
          { name: 'Spanish', value: 'spanish' },
          { name: 'Arabic', value: 'arabic' }
        ]
      }
    ]);

    console.log(`\nFetching top ${answers.category} headlines...`);
    const articles = await this.articleService.fetchTopHeadlines(
      answers.category as Category,
      answers.language as Language
    );

    console.log(`✅ Fetched ${articles.length} top headlines`);
    
    if (articles.length > 0) {
      console.log('\nTop headlines:');
      articles.slice(0, 10).forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
        console.log(`   Source: ${article.source} | Published: ${article.publishedAt.toLocaleDateString()}`);
      });
    }
  }

  private async searchArticles(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'keyword',
        message: 'Enter search keyword:',
        validate: (input: string) => input.trim().length > 0 || 'Please enter a valid keyword'
      },
      {
        type: 'list',
        name: 'language',
        message: 'Select language:',
        choices: [
          { name: 'English', value: 'english' },
          { name: 'Spanish', value: 'spanish' },
          { name: 'Arabic', value: 'arabic' }
        ]
      },
      {
        type: 'list',
        name: 'sortBy',
        message: 'Sort by:',
        choices: [
          { name: 'Publication Date', value: 'publishedAt' },
          { name: 'Popularity', value: 'popularity' },
          { name: 'Relevancy', value: 'relevancy' }
        ]
      }
    ]);

    const filters: Omit<FilterOptions, 'keyword'> = {
      language: answers.language as Language,
      sortBy: answers.sortBy
    };

    console.log(`\nSearching for "${answers.keyword}"...`);
    const articles = await this.articleService.searchAndStoreArticles(answers.keyword, filters);

    console.log(`✅ Found ${articles.length} new articles`);
    
    if (articles.length > 0) {
      console.log('\nSearch results:');
      articles.slice(0, 10).forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
        console.log(`   Source: ${article.source} | Category: ${article.category}`);
      });
    }
  }

  private async viewArticles(): Promise<void> {
    const filters = await this.getFilterOptions();
    const articles = await this.articleService.getStoredArticles(filters);

    if (articles.length === 0) {
      console.log('No articles found matching your criteria.');
      return;
    }

    console.log(`\n📰 Found ${articles.length} articles:\n`);
    
    articles.slice(0, 20).forEach((article, index) => {
      const selectedIcon = article.isSelected ? '✅' : '⭕';
      console.log(`${index + 1}. ${selectedIcon} ${article.title}`);
      console.log(`   Source: ${article.source} | Category: ${article.category} | Language: ${article.language}`);
      console.log(`   Published: ${article.publishedAt.toLocaleDateString()}`);
      if (article.summary) {
        console.log(`   Summary: ${article.summary.substring(0, 100)}...`);
      }
      console.log('');
    });

    if (articles.length > 20) {
      console.log(`... and ${articles.length - 20} more articles`);
    }
  }

  private async getFilterOptions(): Promise<Partial<FilterOptions>> {
    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'categories',
        message: 'Filter by categories (optional):',
        choices: [
          { name: 'Finance', value: 'finance' },
          { name: 'Technology', value: 'tech' }
        ]
      },
      {
        type: 'list',
        name: 'language',
        message: 'Filter by language:',
        choices: [
          { name: 'All languages', value: null },
          { name: 'English', value: 'english' },
          { name: 'Spanish', value: 'spanish' },
          { name: 'Arabic', value: 'arabic' }
        ]
      },
      {
        type: 'input',
        name: 'keyword',
        message: 'Search keyword (optional):'
      },
      {
        type: 'list',
        name: 'sortBy',
        message: 'Sort by:',
        choices: [
          { name: 'Publication Date (newest first)', value: 'publishedAt' },
          { name: 'Popularity', value: 'popularity' },
          { name: 'Relevancy', value: 'relevancy' }
        ]
      }
    ]);

    const filters: Partial<FilterOptions> = {
      sortBy: answers.sortBy
    };

    if (answers.categories.length > 0) {
      filters.categories = answers.categories;
    }

    if (answers.language) {
      filters.language = answers.language;
    }

    if (answers.keyword.trim()) {
      filters.keyword = answers.keyword.trim();
    }

    return filters;
  }

  private async fetchFromRSS(): Promise<void> {
    const choice = await inquirer.prompt([
      {
        type: 'list',
        name: 'option',
        message: 'RSS fetch options:',
        choices: [
          { name: 'Fetch from all active RSS feeds', value: 'all' },
          { name: 'Fetch from specific RSS feed', value: 'specific' },
          { name: 'Back to main menu', value: 'back' }
        ]
      }
    ]);

    if (choice.option === 'back') return;

    if (choice.option === 'all') {
      console.log('\nFetching from all active RSS feeds...');
      const articles = await this.articleService.fetchFromRSSFeeds();
      console.log(`✅ Fetched ${articles.length} new articles from RSS feeds`);
      
      if (articles.length > 0) {
        console.log('\nLatest RSS articles:');
        articles.slice(0, 5).forEach((article, index) => {
          console.log(`${index + 1}. ${article.title}`);
          console.log(`   Source: ${article.source} | Category: ${article.category}`);
        });
      }
    } else if (choice.option === 'specific') {
      const feeds = await this.articleService.getRSSFeeds();
      
      if (feeds.length === 0) {
        console.log('No RSS feeds available. Please add some RSS feeds first.');
        return;
      }

      const feedChoices = feeds
        .filter(feed => feed.isActive)
        .map(feed => ({
          name: `${feed.name} (${feed.category})`,
          value: feed.id
        }));

      if (feedChoices.length === 0) {
        console.log('No active RSS feeds available.');
        return;
      }

      const feedChoice = await inquirer.prompt([
        {
          type: 'list',
          name: 'feedId',
          message: 'Select RSS feed to fetch from:',
          choices: feedChoices
        }
      ]);

      console.log('\nFetching from selected RSS feed...');
      const articles = await this.articleService.fetchFromSpecificRSSFeed(feedChoice.feedId);
      console.log(`✅ Fetched ${articles.length} new articles`);
    }
  }

  private async manageRSSFeeds(): Promise<void> {
    const choice = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'RSS Feed Management:',
        choices: [
          { name: 'View RSS feeds', value: 'view' },
          { name: 'Add RSS feed', value: 'add' },
          { name: 'Import common RSS feeds', value: 'import' },
          { name: 'Remove RSS feed', value: 'remove' },
          { name: 'Test RSS feed', value: 'test' },
          { name: 'Back to main menu', value: 'back' }
        ]
      }
    ]);

    switch (choice.action) {
      case 'view':
        await this.viewRSSFeeds();
        break;
      case 'add':
        await this.addRSSFeed();
        break;
      case 'import':
        await this.importCommonFeeds();
        break;
      case 'remove':
        await this.removeRSSFeed();
        break;
      case 'test':
        await this.testRSSFeed();
        break;
      case 'back':
        return;
    }
  }

  private async viewRSSFeeds(): Promise<void> {
    const feeds = await this.articleService.getRSSFeeds();
    
    if (feeds.length === 0) {
      console.log('\nNo RSS feeds configured.');
      return;
    }

    console.log(`\n📡 RSS Feeds (${feeds.length}):\n`);
    
    feeds.forEach((feed, index) => {
      const statusIcon = feed.isActive ? '✅' : '❌';
      const lastFetched = feed.lastFetched 
        ? feed.lastFetched.toLocaleDateString() 
        : 'Never';
      
      console.log(`${index + 1}. ${statusIcon} ${feed.name}`);
      console.log(`   URL: ${feed.url}`);
      console.log(`   Category: ${feed.category} | Language: ${feed.language}`);
      console.log(`   Last fetched: ${lastFetched}`);
      if (feed.description) {
        console.log(`   Description: ${feed.description}`);
      }
      console.log('');
    });
  }

  private async addRSSFeed(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'RSS feed name:',
        validate: (input: string) => input.trim().length > 0 || 'Please enter a name'
      },
      {
        type: 'input',
        name: 'url',
        message: 'RSS feed URL:',
        validate: (input: string) => {
          try {
            new URL(input);
            return true;
          } catch {
            return 'Please enter a valid URL';
          }
        }
      },
      {
        type: 'list',
        name: 'category',
        message: 'Category (leave empty for auto-detection):',
        choices: [
          { name: 'Auto-detect', value: null },
          { name: 'Finance', value: 'finance' },
          { name: 'Technology', value: 'tech' }
        ]
      },
      {
        type: 'list',
        name: 'language',
        message: 'Language (leave empty for auto-detection):',
        choices: [
          { name: 'Auto-detect', value: null },
          { name: 'English', value: 'english' },
          { name: 'Spanish', value: 'spanish' },
          { name: 'Arabic', value: 'arabic' }
        ]
      }
    ]);

    try {
      console.log('\nValidating RSS feed...');
      const feed = await this.articleService.addRSSFeed(
        answers.name,
        answers.url,
        answers.category,
        answers.language
      );

      console.log(`✅ Added RSS feed: ${feed.name}`);
      console.log(`   Category: ${feed.category} | Language: ${feed.language}`);
    } catch (error) {
      console.error('❌ Failed to add RSS feed:', error instanceof Error ? error.message : error);
    }
  }

  private async importCommonFeeds(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'category',
        message: 'Import feeds for which category?',
        choices: [
          { name: 'All categories', value: null },
          { name: 'Finance only', value: 'finance' },
          { name: 'Technology only', value: 'tech' }
        ]
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'This will add several common RSS feeds. Continue?',
        default: true
      }
    ]);

    if (!answers.confirm) {
      console.log('Import cancelled');
      return;
    }

    try {
      console.log('\nImporting RSS feeds...');
      const count = await this.articleService.importCommonRSSFeeds(answers.category);
      console.log(`✅ Imported ${count} RSS feeds`);
    } catch (error) {
      console.error('❌ Failed to import RSS feeds:', error);
    }
  }

  private async removeRSSFeed(): Promise<void> {
    const feeds = await this.articleService.getRSSFeeds();
    
    if (feeds.length === 0) {
      console.log('No RSS feeds to remove.');
      return;
    }

    const choices = feeds.map(feed => ({
      name: `${feed.name} (${feed.category})`,
      value: feed.id
    }));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'feedId',
        message: 'Select RSS feed to remove:',
        choices
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to remove this RSS feed?',
        default: false
      }
    ]);

    if (answers.confirm) {
      const success = await this.articleService.removeRSSFeed(answers.feedId);
      if (success) {
        console.log('✅ RSS feed removed successfully');
      } else {
        console.log('❌ Failed to remove RSS feed');
      }
    } else {
      console.log('Remove cancelled');
    }
  }

  private async testRSSFeed(): Promise<void> {
    const feeds = await this.articleService.getRSSFeeds();
    
    if (feeds.length === 0) {
      console.log('No RSS feeds to test.');
      return;
    }

    const choices = feeds.map(feed => ({
      name: `${feed.name} (${feed.category})`,
      value: feed.id
    }));

    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'feedId',
        message: 'Select RSS feed to test:',
        choices
      }
    ]);

    console.log('\nTesting RSS feed...');
    const result = await this.articleService.rssService.testRSSFeed(answer.feedId);
    
    if (result.isWorking) {
      console.log('✅ RSS feed is working');
      console.log(`   Articles available: ${result.articlesCount}`);
      if (result.metadata) {
        console.log(`   Feed title: ${result.metadata.title}`);
        console.log(`   Feed language: ${result.metadata.language || 'Not specified'}`);
      }
    } else {
      console.log('❌ RSS feed test failed');
      console.log(`   Error: ${result.error}`);
    }
  }

  private async showStats(): Promise<void> {
    const stats = await this.articleService.getArticleStats();
    const rssStats = await this.articleService.rssService.getRSSFeedStats();
    
    console.log('\n📊 Article Statistics:');
    console.log(`Finance articles: ${stats.finance}`);
    console.log(`Technology articles: ${stats.tech}`);
    console.log(`Total articles: ${stats.finance + stats.tech}`);

    const selectedArticles = await this.articleService.getSelectedArticles();
    console.log(`Selected for newsletter: ${selectedArticles.length}`);

    console.log('\n📡 RSS Feed Statistics:');
    console.log(`Total RSS feeds: ${rssStats.total}`);
    console.log(`Active RSS feeds: ${rssStats.active}`);
    console.log(`Finance RSS feeds: ${rssStats.byCategory.finance}`);
    console.log(`Tech RSS feeds: ${rssStats.byCategory.tech}`);
  }

  private async cleanupArticles(): Promise<void> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'days',
        message: 'Delete articles older than how many days?',
        default: '30',
        validate: (input: string) => {
          const num = parseInt(input);
          return (!isNaN(num) && num > 0) || 'Please enter a valid number of days';
        }
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Are you sure you want to delete old articles?',
        default: false
      }
    ]);

    if (answers.confirm) {
      const deletedCount = this.articleService.cleanupOldArticles(parseInt(answers.days));
      console.log(`✅ Deleted ${deletedCount} old articles`);
    } else {
      console.log('Cleanup cancelled');
    }
  }
}

// Run the CLI
const cli = new FetchCLI();
cli.run().catch(console.error);