// Mock settings store for testing - doesn't persist changes

interface PollingSettings {
  defaultInterval: number;
  batchSize: number;
  maxRetries: number;
  timeoutMs: number;
}

interface NewsletterSettings {
  frequency: 'daily' | 'weekly' | 'monthly';
  maxArticles: number;
  languages: string[];
  categories: string[];
  emailTemplate: string;
}

export class MockSettingsStore {
  private originalSettings: {
    polling: PollingSettings;
    newsletter: NewsletterSettings;
  };

  private mockSettings: {
    polling: PollingSettings;
    newsletter: NewsletterSettings;
  };

  constructor() {
    // Default settings that will be restored after tests
    this.originalSettings = {
      polling: {
        defaultInterval: 3600,
        batchSize: 10,
        maxRetries: 3,
        timeoutMs: 30000
      },
      newsletter: {
        frequency: 'daily',
        maxArticles: 20,
        languages: ['en'],
        categories: ['world', 'technology'],
        emailTemplate: 'default'
      }
    };

    // Create a deep copy for testing
    this.mockSettings = JSON.parse(JSON.stringify(this.originalSettings));
  }

  // Get current settings
  getSettings() {
    return {
      polling: { ...this.mockSettings.polling },
      newsletter: { ...this.mockSettings.newsletter }
    };
  }

  // Update polling settings (for testing only)
  updatePollingSettings(updates: Partial<PollingSettings>) {
    this.mockSettings.polling = {
      ...this.mockSettings.polling,
      ...updates
    };
    return this.mockSettings.polling;
  }

  // Update newsletter settings (for testing only)
  updateNewsletterSettings(updates: Partial<NewsletterSettings>) {
    this.mockSettings.newsletter = {
      ...this.mockSettings.newsletter,
      ...updates
    };
    return this.mockSettings.newsletter;
  }

  // Reset to defaults
  reset(section?: 'polling' | 'newsletter') {
    if (section === 'polling') {
      this.mockSettings.polling = { ...this.originalSettings.polling };
      return { polling: this.mockSettings.polling };
    } else if (section === 'newsletter') {
      this.mockSettings.newsletter = { ...this.originalSettings.newsletter };
      return { newsletter: this.mockSettings.newsletter };
    } else {
      this.mockSettings = JSON.parse(JSON.stringify(this.originalSettings));
      return this.mockSettings;
    }
  }

  // Restore original settings after tests
  cleanup() {
    this.mockSettings = JSON.parse(JSON.stringify(this.originalSettings));
  }
}