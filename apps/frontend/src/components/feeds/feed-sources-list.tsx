'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState, useEffect } from 'react';
import { Globe, Star, Edit, Trash2, Loader2, AlertCircle } from 'lucide-react';

export function FeedSourcesList() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [isClient, setIsClient] = useState(false);

  const { data: feeds, isLoading, error, refetch } = useQuery({
    queryKey: ['feeds'],
    queryFn: () => apiClient.getFeeds(1, 100),
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  const feedsData = feeds || [];

  const filteredFeeds = feedsData.filter((feed) => {
    const categoryMatch = selectedCategory === 'all' || feed.category === selectedCategory;
    const languageMatch = selectedLanguage === 'all' || feed.language === selectedLanguage;
    return categoryMatch && languageMatch;
  });

  const getLanguageLabel = (language: string) => {
    return language; // Already in full form like "English", "Spanish", etc.
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
              <p className="text-sm text-gray-600">Unable to load feed sources</p>
              <button 
                onClick={() => refetch()}
                className="mt-2 text-sm text-primary-600 hover:text-primary-500"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Filters */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="all">All Categories</option>
              <option value="News">News</option>
              <option value="Technology">Technology</option>
              <option value="Finance">Finance</option>
              <option value="Science">Science</option>
              <option value="Sports">Sports</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Health">Health</option>
              <option value="Travel">Travel</option>
              <option value="Education">Education</option>
              <option value="Business">Business</option>
              <option value="Politics">Politics</option>
              <option value="Gaming">Gaming</option>
              <option value="Crypto">Crypto</option>
              <option value="Lifestyle">Lifestyle</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700">
              Language
            </label>
            <select
              id="language"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="all">All Languages</option>
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="Portuguese">Portuguese</option>
              <option value="French">French</option>
              <option value="Arabic">Arabic</option>
              <option value="Chinese">Chinese</option>
              <option value="Japanese">Japanese</option>
            </select>
          </div>
          
          <div className="flex-1" />
          
          <div className="text-sm text-gray-600">
            {isClient ? `${filteredFeeds.length} feeds` : 'Loading feeds...'}
          </div>
        </div>
      </div>

      {/* Feeds List */}
      <div className="divide-y divide-gray-200">
        {filteredFeeds.map((feed) => (
          <div key={feed.id} className="px-6 py-4 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Globe className="h-5 w-5 text-primary-600" />
                  </div>
                </div>
                
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {feed.name}
                    </h3>
                    {!feed.is_active && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        Inactive
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      RSS
                    </span>
                  </div>
                  
                  <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                    <span>{getLanguageLabel(feed.language)}</span>
                    <span>•</span>
                    <span>{feed.category}</span>
                    <span>•</span>
                    <span>{feed.type}</span>
                    <span>•</span>
                    <span>{feed.region}</span>
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-400 truncate">
                    {feed.url}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-green-600 bg-green-100">
                    Active
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button className="p-1 text-gray-400 hover:text-gray-600">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button className="p-1 text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredFeeds.length === 0 && (
        <div className="px-6 py-8 text-center">
          <Globe className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No feeds found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your filters or create a new feed.
          </p>
        </div>
      )}
    </div>
  );
}