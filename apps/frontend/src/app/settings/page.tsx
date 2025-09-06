'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Server, Zap, Mail, Rss, Database, RefreshCw, Save, RotateCcw } from 'lucide-react';

interface SystemSettings {
  port: number;
  host: string;
  logger: boolean;
  environment: string;
  uptime?: number;
  memory?: any;
  version?: string;
}

interface LLMSettings {
  provider: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  mockInDev: boolean;
  hasApiKey: boolean;
  supportedProviders?: string[];
}

interface PollingSettings {
  defaultInterval: number;
  batchSize: number;
  maxRetries: number;
  timeoutMs: number;
  maxConcurrentJobs: number;
  checkIntervalMs: number;
  status?: string;
  lastRun?: string;
  nextRun?: string;
}

interface NewsletterSettings {
  frequency: 'daily' | 'weekly' | 'monthly';
  maxArticles: number;
  languages: string[];
  categories: string[];
  emailTemplate?: string;
  availableLanguages?: string[];
  availableCategories?: string[];
  templates?: string[];
}

interface AllSettings {
  system: SystemSettings;
  database: any;
  llm: LLMSettings;
  newsapi: any;
  polling: PollingSettings;
  newsletter: NewsletterSettings;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'system' | 'llm' | 'polling' | 'newsletter'>('system');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/settings');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch settings: ${response.statusText}`);
      }
      
      const data: AllSettings = await response.json();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (section: string, updatedSettings: any) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/settings/${section}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedSettings),
      });

      if (!response.ok) {
        throw new Error(`Failed to update ${section} settings`);
      }

      const result = await response.json();
      setSaveMessage(result.message || `${section} settings updated successfully`);
      
      // Refresh settings
      await fetchSettings();
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async (section?: string) => {
    if (!confirm(`Are you sure you want to reset ${section ? `${section} ` : ''}settings to defaults?`)) {
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/settings/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ section }),
      });

      if (!response.ok) {
        throw new Error('Failed to reset settings');
      }

      const result = await response.json();
      setSaveMessage(result.message);
      await fetchSettings();
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset settings');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">Error: {error}</p>
          <button 
            onClick={() => fetchSettings()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>
        <p className="text-gray-500">No settings data available.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'system', label: 'System', icon: Server },
    { id: 'llm', label: 'LLM', icon: Zap },
    { id: 'polling', label: 'Polling', icon: Rss },
    { id: 'newsletter', label: 'Newsletter', icon: Mail },
  ] as const;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Settings className="mr-3 h-8 w-8" />
          Settings
        </h1>
        <button 
          onClick={() => fetchSettings()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {saveMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-green-700">{saveMessage}</p>
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-2 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-5 w-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'system' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold mb-4">System Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Server Status</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Environment:</span>
                      <span className="font-medium">{settings.system.environment}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Host:</span>
                      <span className="font-medium">{settings.system.host}:{settings.system.port}</span>
                    </div>
                    {settings.system.uptime && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Uptime:</span>
                        <span className="font-medium">{formatUptime(settings.system.uptime)}</span>
                      </div>
                    )}
                    {settings.system.version && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Node.js:</span>
                        <span className="font-medium">{settings.system.version}</span>
                      </div>
                    )}
                  </div>
                </div>

                {settings.system.memory && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Memory Usage</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">RSS:</span>
                        <span className="font-medium">{formatMemory(settings.system.memory.rss)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Heap Used:</span>
                        <span className="font-medium">{formatMemory(settings.system.memory.heapUsed)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Heap Total:</span>
                        <span className="font-medium">{formatMemory(settings.system.memory.heapTotal)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Database</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">URL:</span>
                      <span className="font-medium">{settings.database.url}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Logging:</span>
                      <span className={`font-medium ${settings.database.logging ? 'text-green-600' : 'text-gray-500'}`}>
                        {settings.database.logging ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">LLM Configuration</h2>
                <button
                  onClick={() => resetSettings('llm')}
                  className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors flex items-center"
                  disabled={saving}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                  <select
                    value={settings.llm.provider}
                    onChange={(e) => {
                      const newSettings = { ...settings.llm, provider: e.target.value };
                      updateSettings('llm', newSettings);
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    disabled={saving}
                  >
                    {settings.llm.supportedProviders?.map(provider => (
                      <option key={provider} value={provider}>{provider}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
                  <input
                    type="text"
                    value={settings.llm.model}
                    onChange={(e) => {
                      const newSettings = { ...settings.llm, model: e.target.value };
                      setSettings({ ...settings, llm: newSettings });
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
                    <input
                      type="number"
                      value={settings.llm.maxTokens}
                      onChange={(e) => {
                        const newSettings = { ...settings.llm, maxTokens: parseInt(e.target.value) };
                        setSettings({ ...settings, llm: newSettings });
                      }}
                      min="1"
                      max="8192"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Temperature</label>
                    <input
                      type="number"
                      value={settings.llm.temperature}
                      onChange={(e) => {
                        const newSettings = { ...settings.llm, temperature: parseFloat(e.target.value) };
                        setSettings({ ...settings, llm: newSettings });
                      }}
                      min="0"
                      max="2"
                      step="0.1"
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base URL</label>
                  <input
                    type="url"
                    value={settings.llm.baseUrl}
                    onChange={(e) => {
                      const newSettings = { ...settings.llm, baseUrl: e.target.value };
                      setSettings({ ...settings, llm: newSettings });
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={settings.llm.mockInDev}
                    onChange={(e) => {
                      const newSettings = { ...settings.llm, mockInDev: e.target.checked };
                      setSettings({ ...settings, llm: newSettings });
                    }}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">
                    Use mock responses in development
                  </label>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>API Key Status:</strong> {settings.llm.hasApiKey ? 'Configured' : 'Not configured'}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    API keys are configured via environment variables and cannot be changed through the UI.
                  </p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => updateSettings('llm', settings.llm)}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'polling' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">RSS Polling Configuration</h2>
                <button
                  onClick={() => resetSettings('polling')}
                  className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors flex items-center"
                  disabled={saving}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Default Interval (seconds)</label>
                  <input
                    type="number"
                    value={settings.polling.defaultInterval}
                    onChange={(e) => {
                      const newSettings = { ...settings.polling, defaultInterval: parseInt(e.target.value) };
                      setSettings({ ...settings, polling: newSettings });
                    }}
                    min="60"
                    max="86400"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Between 1 minute and 24 hours</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Batch Size</label>
                  <input
                    type="number"
                    value={settings.polling.batchSize}
                    onChange={(e) => {
                      const newSettings = { ...settings.polling, batchSize: parseInt(e.target.value) };
                      setSettings({ ...settings, polling: newSettings });
                    }}
                    min="1"
                    max="100"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Retries</label>
                  <input
                    type="number"
                    value={settings.polling.maxRetries}
                    onChange={(e) => {
                      const newSettings = { ...settings.polling, maxRetries: parseInt(e.target.value) };
                      setSettings({ ...settings, polling: newSettings });
                    }}
                    min="0"
                    max="10"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timeout (ms)</label>
                  <input
                    type="number"
                    value={settings.polling.timeoutMs}
                    onChange={(e) => {
                      const newSettings = { ...settings.polling, timeoutMs: parseInt(e.target.value) };
                      setSettings({ ...settings, polling: newSettings });
                    }}
                    min="5000"
                    max="300000"
                    step="1000"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Between 5 seconds and 5 minutes</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Concurrent Jobs</label>
                  <input
                    type="number"
                    value={settings.polling.maxConcurrentJobs}
                    onChange={(e) => {
                      const newSettings = { ...settings.polling, maxConcurrentJobs: parseInt(e.target.value) };
                      setSettings({ ...settings, polling: newSettings });
                    }}
                    min="1"
                    max="50"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Number of feeds processed simultaneously (1-50)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Check Interval (ms)</label>
                  <input
                    type="number"
                    value={settings.polling.checkIntervalMs}
                    onChange={(e) => {
                      const newSettings = { ...settings.polling, checkIntervalMs: parseInt(e.target.value) };
                      setSettings({ ...settings, polling: newSettings });
                    }}
                    min="5000"
                    max="300000"
                    step="1000"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">How often to check for new jobs (5 seconds to 5 minutes)</p>
                </div>
              </div>

              {(settings.polling.status || settings.polling.lastRun) && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Polling Status</h3>
                  <div className="space-y-2 text-sm">
                    {settings.polling.status && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className="font-medium capitalize">{settings.polling.status}</span>
                      </div>
                    )}
                    {settings.polling.lastRun && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Last Run:</span>
                        <span className="font-medium">{new Date(settings.polling.lastRun).toLocaleString()}</span>
                      </div>
                    )}
                    {settings.polling.nextRun && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Next Run:</span>
                        <span className="font-medium">{new Date(settings.polling.nextRun).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => updateSettings('polling', settings.polling)}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'newsletter' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Newsletter Configuration</h2>
                <button
                  onClick={() => resetSettings('newsletter')}
                  className="px-3 py-2 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors flex items-center"
                  disabled={saving}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Frequency</label>
                  <select
                    value={settings.newsletter.frequency}
                    onChange={(e) => {
                      const newSettings = { ...settings.newsletter, frequency: e.target.value as 'daily' | 'weekly' | 'monthly' };
                      setSettings({ ...settings, newsletter: newSettings });
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Max Articles</label>
                  <input
                    type="number"
                    value={settings.newsletter.maxArticles}
                    onChange={(e) => {
                      const newSettings = { ...settings.newsletter, maxArticles: parseInt(e.target.value) };
                      setSettings({ ...settings, newsletter: newSettings });
                    }}
                    min="1"
                    max="50"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Languages</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {settings.newsletter.availableLanguages?.map(lang => (
                    <label key={lang} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.newsletter.languages.includes(lang)}
                        onChange={(e) => {
                          const languages = e.target.checked 
                            ? [...settings.newsletter.languages, lang]
                            : settings.newsletter.languages.filter(l => l !== lang);
                          const newSettings = { ...settings.newsletter, languages };
                          setSettings({ ...settings, newsletter: newSettings });
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 uppercase">{lang}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {settings.newsletter.availableCategories?.map(category => (
                    <label key={category} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={settings.newsletter.categories.includes(category)}
                        onChange={(e) => {
                          const categories = e.target.checked 
                            ? [...settings.newsletter.categories, category]
                            : settings.newsletter.categories.filter(c => c !== category);
                          const newSettings = { ...settings.newsletter, categories };
                          setSettings({ ...settings, newsletter: newSettings });
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 capitalize">{category}</span>
                    </label>
                  ))}
                </div>
              </div>

              {settings.newsletter.templates && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email Template</label>
                  <select
                    value={settings.newsletter.emailTemplate || 'default'}
                    onChange={(e) => {
                      const newSettings = { ...settings.newsletter, emailTemplate: e.target.value };
                      setSettings({ ...settings, newsletter: newSettings });
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    {settings.newsletter.templates.map(template => (
                      <option key={template} value={template} className="capitalize">{template}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => updateSettings('newsletter', settings.newsletter)}
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}