'use client';

import { useState, useEffect } from 'react';
import { PlusIcon, BeakerIcon, CheckCircleIcon, XCircleIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/outline';

interface GoogleRSSFeed {
  id: string;
  name: string;
  url: string;
  mode: 'topic' | 'search';
  topic?: string;
  search_query?: string;
  time_frame?: string;
  country: string;
  language: string;
  is_active: boolean;
  is_validated: boolean;
  last_scraped?: string;
  article_count: number;
  created_at: string;
  updated_at: string;
}

interface GoogleRSSConfig {
  topics: string[];
  countries: string[];
  languages: string[];
  timeFrames: string[];
}

interface TopicPair {
  name: string;
  key: string;
}

interface CreateFeedData {
  name: string;
  mode: 'topic' | 'search';
  topic?: string;
  searchQuery?: string;
  timeFrame?: string;
  country: string;
  language: string;
}

export default function GoogleRSSPage() {
  const [feeds, setFeeds] = useState<GoogleRSSFeed[]>([]);
  const [config, setConfig] = useState<GoogleRSSConfig>({ topics: [], countries: [], languages: [], timeFrames: [] });
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTopicManager, setShowTopicManager] = useState(false);
  const [customTopics, setCustomTopics] = useState<TopicPair[]>([]);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicKey, setNewTopicKey] = useState('');
  const [createData, setCreateData] = useState<CreateFeedData>({
    name: '',
    mode: 'topic',
    topic: '',
    searchQuery: '',
    timeFrame: '',
    country: 'United States',
    language: 'English'
  });
  const [testingUrl, setTestingUrl] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    fetchFeeds();
    fetchConfig();
    loadCustomTopics();
  }, []);

  const loadCustomTopics = () => {
    const saved = localStorage.getItem('googleRSSCustomTopics');
    if (saved) {
      setCustomTopics(JSON.parse(saved));
    }
  };

  const saveCustomTopics = (topics: TopicPair[]) => {
    localStorage.setItem('googleRSSCustomTopics', JSON.stringify(topics));
    setCustomTopics(topics);
  };

  const addCustomTopic = () => {
    if (newTopicName.trim() && newTopicKey.trim()) {
      const newTopics = [...customTopics, { name: newTopicName.trim(), key: newTopicKey.trim() }];
      saveCustomTopics(newTopics);
      setNewTopicName('');
      setNewTopicKey('');
    }
  };

  const removeCustomTopic = (index: number) => {
    const newTopics = customTopics.filter((_, i) => i !== index);
    saveCustomTopics(newTopics);
  };

  const getAllTopics = () => {
    return [...config.topics, ...customTopics.map(t => t.name)];
  };

  const fetchFeeds = async () => {
    try {
      const response = await fetch('http://localhost:3333/google-rss-feeds');
      if (response.ok) {
        const data = await response.json();
        setFeeds(data);
      }
    } catch (error) {
      console.error('Error fetching Google RSS feeds:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetch('http://localhost:3333/google-rss-config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        if (data.topics.length > 0) {
          setCreateData(prev => ({ ...prev, topic: data.topics[0] }));
        }
        if (data.timeFrames.length > 0) {
          setCreateData(prev => ({ ...prev, timeFrame: data.timeFrames[0] }));
        }
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const generateUrl = async () => {
    try {
      const customTopic = customTopics.find(t => t.name === createData.topic);
      const response = await fetch('http://localhost:3333/google-rss-generate-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: createData.mode,
          topic: createData.mode === 'topic' ? createData.topic : undefined,
          topicKey: createData.mode === 'topic' && customTopic ? customTopic.key : undefined,
          searchQuery: createData.mode === 'search' ? createData.searchQuery : undefined,
          timeFrame: createData.mode === 'search' ? createData.timeFrame : undefined,
          country: createData.country,
          language: createData.language
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.url;
      }
    } catch (error) {
      console.error('Error generating URL:', error);
    }
    return null;
  };

  const testFeed = async (url: string) => {
    setTestingUrl(url);
    setTestResult(null);

    try {
      const response = await fetch('http://localhost:3333/google-rss-test-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (response.ok) {
        const result = await response.json();
        setTestResult(result);
      }
    } catch (error) {
      setTestResult({ isValid: false, error: 'Network error occurred' });
    } finally {
      setTestingUrl(null);
    }
  };

  const handleCreateFeed = async () => {
    try {
      const url = await generateUrl();
      if (!url) {
        alert('Failed to generate URL');
        return;
      }

      const response = await fetch('http://localhost:3333/google-rss-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createData.name,
          url,
          mode: createData.mode,
          topic: createData.mode === 'topic' ? createData.topic : undefined,
          search_query: createData.mode === 'search' ? createData.searchQuery : undefined,
          time_frame: createData.mode === 'search' ? createData.timeFrame : undefined,
          country: createData.country,
          language: createData.language
        })
      });

      if (response.ok) {
        setShowCreateForm(false);
        setCreateData({
          name: '',
          mode: 'topic',
          topic: config.topics[0] || '',
          searchQuery: '',
          timeFrame: config.timeFrames[0] || '',
          country: 'United States',
          language: 'English'
        });
        fetchFeeds();
      } else {
        const errorData = await response.json();
        alert(`Error creating feed: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error creating feed:', error);
      alert('Network error occurred');
    }
  };

  const toggleFeedStatus = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3333/google-rss-feeds/${id}/toggle`, {
        method: 'POST'
      });

      if (response.ok) {
        fetchFeeds();
      }
    } catch (error) {
      console.error('Error toggling feed status:', error);
    }
  };

  const validateFeed = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3333/google-rss-feeds/${id}/validate`, {
        method: 'POST'
      });

      if (response.ok) {
        fetchFeeds();
      }
    } catch (error) {
      console.error('Error validating feed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Google RSS Feeds</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Google RSS Feed
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Google RSS Feed</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Feed Name</label>
              <input
                type="text"
                value={createData.name}
                onChange={(e) => setCreateData(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter a descriptive name for this feed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Mode</label>
              <select
                value={createData.mode}
                onChange={(e) => setCreateData(prev => ({ ...prev, mode: e.target.value as 'topic' | 'search' }))}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="topic">Browse by Topic</option>
                <option value="search">Search Query</option>
              </select>
            </div>

            {createData.mode === 'topic' && (
              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700">Topic</label>
                  <button
                    type="button"
                    onClick={() => setShowTopicManager(!showTopicManager)}
                    className="text-sm text-blue-600 hover:text-blue-500"
                  >
                    Manage Topics
                  </button>
                </div>
                <select
                  value={createData.topic}
                  onChange={(e) => setCreateData(prev => ({ ...prev, topic: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {getAllTopics().map(topic => (
                    <option key={topic} value={topic}>{topic}</option>
                  ))}
                </select>

                {showTopicManager && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Custom Topic Manager</h4>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Topic Name</label>
                          <input
                            type="text"
                            value={newTopicName}
                            onChange={(e) => setNewTopicName(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., Entertainment"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">Topic Key</label>
                          <input
                            type="text"
                            value={newTopicKey}
                            onChange={(e) => setNewTopicKey(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., CAAqJggKIiBDQkFTRWdvSUwy..."
                          />
                        </div>
                      </div>
                      
                      <button
                        type="button"
                        onClick={addCustomTopic}
                        disabled={!newTopicName.trim() || !newTopicKey.trim()}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Add Topic
                      </button>

                      {customTopics.length > 0 && (
                        <div className="mt-3">
                          <h5 className="text-xs font-medium text-gray-700 mb-2">Custom Topics:</h5>
                          <div className="space-y-2">
                            {customTopics.map((topic, index) => (
                              <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-gray-900">{topic.name}</span>
                                  <span className="text-xs text-gray-500 ml-2 truncate block">{topic.key}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeCustomTopic(index)}
                                  className="ml-2 text-red-600 hover:text-red-700 text-xs"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {createData.mode === 'search' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Search Query</label>
                  <input
                    type="text"
                    value={createData.searchQuery}
                    onChange={(e) => setCreateData(prev => ({ ...prev, searchQuery: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your search terms"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Time Frame</label>
                  <select
                    value={createData.timeFrame}
                    onChange={(e) => setCreateData(prev => ({ ...prev, timeFrame: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    {config.timeFrames.map(timeFrame => (
                      <option key={timeFrame} value={timeFrame}>{timeFrame}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <select
                  value={createData.country}
                  onChange={(e) => setCreateData(prev => ({ ...prev, country: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {config.countries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Language</label>
                <select
                  value={createData.language}
                  onChange={(e) => setCreateData(prev => ({ ...prev, language: e.target.value }))}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                >
                  {config.languages.map(language => (
                    <option key={language} value={language}>{language}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const url = await generateUrl();
                  if (url) await testFeed(url);
                }}
                disabled={testingUrl !== null}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                <BeakerIcon className="h-4 w-4 mr-2 inline" />
                Test Feed
              </button>
              <button
                onClick={handleCreateFeed}
                disabled={!createData.name || (createData.mode === 'search' && !createData.searchQuery)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                Create Feed
              </button>
            </div>

            {testResult && (
              <div className={`mt-4 p-4 rounded-md ${testResult.isValid ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex">
                  <div className="flex-shrink-0">
                    {testResult.isValid ? (
                      <CheckCircleIcon className="h-5 w-5 text-green-400" />
                    ) : (
                      <XCircleIcon className="h-5 w-5 text-red-400" />
                    )}
                  </div>
                  <div className="ml-3">
                    <h3 className={`text-sm font-medium ${testResult.isValid ? 'text-green-800' : 'text-red-800'}`}>
                      {testResult.isValid ? 'Feed is valid!' : 'Feed validation failed'}
                    </h3>
                    {testResult.isValid ? (
                      <div className={`mt-2 text-sm text-green-700`}>
                        <p>Feed Title: {testResult.feedTitle}</p>
                        <p>Article Count: {testResult.articleCount}</p>
                        {testResult.sampleArticles && (
                          <div className="mt-2">
                            <p className="font-medium">Sample Articles:</p>
                            <ul className="list-disc list-inside ml-4">
                              {testResult.sampleArticles.map((article: any, index: number) => (
                                <li key={index} className="truncate">{article.title}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className={`mt-2 text-sm text-red-700`}>{testResult.error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {feeds.map((feed) => (
            <li key={feed.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-lg font-medium text-gray-900">{feed.name}</h3>
                      <div className="ml-4 flex space-x-2">
                        {feed.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                        {feed.is_validated ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <CheckCircleIcon className="h-3 w-3 mr-1" />
                            Validated
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <XCircleIcon className="h-3 w-3 mr-1" />
                            Not Validated
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                      <span className="capitalize">{feed.mode}</span>
                      {feed.topic && <span>Topic: {feed.topic}</span>}
                      {feed.search_query && <span>Query: "{feed.search_query}"</span>}
                      <span>{feed.country} • {feed.language}</span>
                      <span>Articles: {feed.article_count}</span>
                    </div>

                    <div className="mt-1">
                      <p className="text-sm text-gray-600 break-all">{feed.url}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => testFeed(feed.url)}
                      disabled={testingUrl === feed.url}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      <BeakerIcon className="h-4 w-4 mr-1" />
                      Test
                    </button>
                    <button
                      onClick={() => validateFeed(feed.id)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <CheckCircleIcon className="h-4 w-4 mr-1" />
                      Validate
                    </button>
                    <button
                      onClick={() => toggleFeedStatus(feed.id)}
                      className={`inline-flex items-center px-3 py-1 border border-transparent shadow-sm text-xs font-medium rounded text-white ${
                        feed.is_active 
                          ? 'bg-red-600 hover:bg-red-700' 
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                    >
                      {feed.is_active ? (
                        <>
                          <PauseIcon className="h-4 w-4 mr-1" />
                          Disable
                        </>
                      ) : (
                        <>
                          <PlayIcon className="h-4 w-4 mr-1" />
                          Enable
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {feeds.length === 0 && (
        <div className="text-center py-12">
          <h3 className="mt-2 text-sm font-medium text-gray-900">No Google RSS feeds</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new Google RSS feed.</p>
          <div className="mt-6">
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Google RSS Feed
            </button>
          </div>
        </div>
      )}
    </div>
  );
}