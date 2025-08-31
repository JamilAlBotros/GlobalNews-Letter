#!/usr/bin/env node

import inquirer from 'inquirer';
import { ArticleService } from '../services/articles.js';
import { NewsletterService } from '../services/newsletter.js';
import type { Language } from '../types/index.js';

/**
 * CLI for generating newsletters from selected articles
 */
class GenerateCLI {
  private articleService: ArticleService;
  private newsletterService: NewsletterService;

  constructor() {
    this.articleService = new ArticleService();
    this.newsletterService = new NewsletterService();
  }

  async run(): Promise<void> {
    console.log('📧 GlobalNews Letter - Newsletter Generator\n');

    try {
      const choice = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: 'Select articles for newsletter', value: 'select' },
            { name: 'Generate newsletter from selected articles', value: 'generate' },
            { name: 'View selected articles', value: 'view' },
            { name: 'Clear all selections', value: 'clear' },
            { name: 'Translate article', value: 'translate' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      switch (choice.action) {
        case 'select':
          await this.selectArticles();
          break;
        case 'generate':
          await this.generateNewsletter();
          break;
        case 'view':
          await this.viewSelectedArticles();
          break;
        case 'clear':
          await this.clearSelections();
          break;
        case 'translate':
          await this.translateArticle();
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

  private async selectArticles(): Promise<void> {
    console.log('Loading available articles...\n');
    
    const articles = await this.articleService.getStoredArticles();
    
    if (articles.length === 0) {
      console.log('No articles available. Please fetch some articles first using the fetch command.');
      return;
    }

    // Show filter options first
    const filterAnswers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'categories',
        message: 'Filter by categories:',
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
      }
    ]);

    const filters: any = {};
    if (filterAnswers.categories.length > 0) {
      filters.categories = filterAnswers.categories;
    }
    if (filterAnswers.language) {
      filters.language = filterAnswers.language;
    }

    const filteredArticles = await this.articleService.getStoredArticles(filters);
    
    if (filteredArticles.length === 0) {
      console.log('No articles match your filter criteria.');
      return;
    }

    // Prepare choices for article selection
    const choices = filteredArticles.slice(0, 50).map(article => ({
      name: `${article.isSelected ? '✅' : '⭕'} ${article.title} (${article.source} - ${article.category})`,
      value: article.id,
      checked: article.isSelected
    }));

    const selectionAnswers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedArticles',
        message: `Select articles for newsletter (showing first 50 of ${filteredArticles.length}):`,
        choices,
        pageSize: 15
      }
    ]);

    // Update selections
    const currentlySelected = (await this.articleService.getSelectedArticles()).map(a => a.id);
    const newSelections = selectionAnswers.selectedArticles;

    // Find articles to unselect (were selected but not in new selection)
    const toUnselect = currentlySelected.filter(id => !newSelections.includes(id));
    
    // Find articles to select (in new selection but not currently selected)
    const toSelect = newSelections.filter((id: string) => !currentlySelected.includes(id));

    if (toUnselect.length > 0) {
      await this.articleService.unselectArticlesFromNewsletter(toUnselect);
    }

    if (toSelect.length > 0) {
      await this.articleService.selectArticlesForNewsletter(toSelect);
    }

    const totalSelected = (await this.articleService.getSelectedArticles()).length;
    console.log(`✅ Newsletter now has ${totalSelected} selected articles`);
  }

  private async generateNewsletter(): Promise<void> {
    const selectedArticles = await this.articleService.getSelectedArticles();
    
    if (selectedArticles.length === 0) {
      console.log('No articles selected for newsletter. Please select some articles first.');
      return;
    }

    console.log(`Found ${selectedArticles.length} selected articles`);

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'language',
        message: 'Select newsletter language:',
        choices: [
          { name: 'English', value: 'english' },
          { name: 'Spanish', value: 'spanish' },
          { name: 'Arabic', value: 'arabic' }
        ]
      },
      {
        type: 'list',
        name: 'format',
        message: 'Select output format:',
        choices: [
          { name: 'Standard JSON', value: 'standard' },
          { name: 'Enhanced JSON (with metadata)', value: 'enhanced' },
          { name: 'Preview only', value: 'preview' }
        ]
      },
      {
        type: 'input',
        name: 'filename',
        message: 'Custom filename (optional):',
        when: (answers) => answers.format !== 'preview'
      }
    ]);

    console.log(`\nGenerating newsletter in ${answers.language}...`);

    try {
      if (answers.format === 'preview') {
        const preview = this.newsletterService.generatePreview(selectedArticles, 10);
        console.log('\n📧 Newsletter Preview:\n');
        console.log(JSON.stringify(preview, null, 2));
        return;
      }

      if (answers.format === 'enhanced') {
        const enhancedOptions = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'includeImages',
            message: 'Include article images?',
            default: true
          },
          {
            type: 'confirm',
            name: 'groupByCategory',
            message: 'Group articles by category?',
            default: true
          },
          {
            type: 'confirm',
            name: 'includeMetadata',
            message: 'Include metadata?',
            default: true
          }
        ]);

        const filePath = await this.newsletterService.saveEnhancedNewsletter(
          selectedArticles,
          answers.language as Language,
          answers.filename,
          enhancedOptions
        );

        console.log(`✅ Enhanced newsletter generated: ${filePath}`);
      } else {
        const { newsletter, filePath } = await this.newsletterService.createAndSaveNewsletter(
          selectedArticles,
          answers.language as Language,
          answers.filename
        );

        console.log(`✅ Newsletter generated: ${filePath}`);
        console.log(`📊 Total articles: ${newsletter.articles.length}`);
      }

      // Ask if user wants to clear selections
      const clearAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'clear',
          message: 'Clear article selections after generating newsletter?',
          default: false
        }
      ]);

      if (clearAnswer.clear) {
        await this.articleService.clearAllSelections();
        console.log('✅ Selections cleared');
      }

    } catch (error) {
      console.error('Failed to generate newsletter:', error);
    }
  }

  private async viewSelectedArticles(): Promise<void> {
    const selectedArticles = await this.articleService.getSelectedArticles();
    
    if (selectedArticles.length === 0) {
      console.log('No articles currently selected for newsletter.');
      return;
    }

    console.log(`\n📧 Selected Articles (${selectedArticles.length}):\n`);
    
    selectedArticles.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title}`);
      console.log(`   Source: ${article.source} | Category: ${article.category} | Language: ${article.language}`);
      console.log(`   Published: ${article.publishedAt.toLocaleDateString()}`);
      if (article.summary) {
        console.log(`   Summary: ${article.summary.substring(0, 100)}...`);
      }
      console.log('');
    });

    // Show statistics
    const categories = selectedArticles.reduce((acc, article) => {
      acc[article.category] = (acc[article.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Selection Statistics:');
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} articles`);
    });
  }

  private async clearSelections(): Promise<void> {
    const selectedArticles = await this.articleService.getSelectedArticles();
    
    if (selectedArticles.length === 0) {
      console.log('No articles are currently selected.');
      return;
    }

    const answer = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Clear all ${selectedArticles.length} selected articles?`,
        default: false
      }
    ]);

    if (answer.confirm) {
      await this.articleService.clearAllSelections();
      console.log('✅ All selections cleared');
    } else {
      console.log('Clear cancelled');
    }
  }

  private async translateArticle(): Promise<void> {
    console.log('Loading articles...\n');
    
    const articles = await this.articleService.getStoredArticles();
    
    if (articles.length === 0) {
      console.log('No articles available for translation.');
      return;
    }

    const choices = articles.slice(0, 20).map(article => ({
      name: `${article.title} (${article.language}) - ${article.source}`,
      value: article.id
    }));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'articleId',
        message: 'Select article to translate (showing first 20):',
        choices,
        pageSize: 10
      },
      {
        type: 'list',
        name: 'targetLanguage',
        message: 'Translate to:',
        choices: [
          { name: 'English', value: 'english' },
          { name: 'Spanish', value: 'spanish' },
          { name: 'Arabic', value: 'arabic' }
        ]
      }
    ]);

    console.log(`\nTranslating article to ${answers.targetLanguage}...`);

    try {
      const translatedArticle = await this.articleService.translateArticle(
        answers.articleId,
        answers.targetLanguage as Language
      );

      if (translatedArticle) {
        console.log('✅ Article translated successfully!');
        console.log(`\nOriginal Title: ${articles.find(a => a.id === answers.articleId)?.title}`);
        console.log(`Translated Title: ${translatedArticle.title}`);
        console.log(`\nTranslated Summary: ${translatedArticle.summary}`);
      } else {
        console.log('❌ Translation failed');
      }
    } catch (error) {
      console.error('Translation error:', error);
    }
  }
}

// Run the CLI
const cli = new GenerateCLI();
cli.run().catch(console.error);