'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState } from 'react';
import { FileText, Globe, Clock, Star, Loader2, AlertCircle, Eye } from 'lucide-react';

export function ArticlesList() {
  const [filters, setFilters] = useState({
    language: 'all',
    category: 'all',
    processing_stage: 'all',
    limit: 50,
  });

  const { data: articles, isLoading, error, refetch } = useQuery({
    queryKey: ['articles', filters],
    queryFn: () => {
      const queryFilters = Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value !== 'all')
      );
      return apiClient.getArticles(queryFilters);
    },
  });

  const articlesData = articles || [];

  const getLanguageLabel = (code: string) => {
    const languages: Record<string, string> = {
      en: 'English', es: 'Spanish', pt: 'Portuguese',
      fr: 'French', ar: 'Arabic', zh: 'Chinese', ja: 'Japanese',
    };
    return languages[code] || code.toUpperCase();
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'breaking': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'normal': return 'text-green-600 bg-green-100';
      case 'low': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'processed': return 'text-blue-600 bg-blue-100';
      case 'translated': return 'text-purple-600 bg-purple-100';
      case 'published': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
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
              <p className="text-sm text-gray-600">Unable to load articles</p>
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
            <label className="block text-sm font-medium text-gray-700">Language</label>
            <select
              value={filters.language}
              onChange={(e) => setFilters({ ...filters, language: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="all">All Languages</option>
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="pt">Portuguese</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="all">All Categories</option>
              <option value="finance">Finance</option>
              <option value="tech">Technology</option>
              <option value="health">Health</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Processing Stage</label>
            <select
              value={filters.processing_stage}
              onChange={(e) => setFilters({ ...filters, processing_stage: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="all">All Stages</option>
              <option value="pending">Pending</option>
              <option value="processed">Processed</option>
              <option value="translated">Translated</option>
              <option value="published">Published</option>
            </select>
          </div>
          
          <div className="flex-1" />
          <div className="text-sm text-gray-600">
            {articlesData.length} articles
          </div>
        </div>
      </div>

      {/* Articles List */}
      <div className="divide-y divide-gray-200">
        {articlesData.map((article) => (
          <div key={article.id} className="px-6 py-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary-600" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      {article.title}
                    </h3>
                    {article.is_selected && (
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                    )}
                  </div>
                  
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                    {article.description}
                  </p>
                  
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center space-x-1">
                      <Globe className="h-3 w-3" />
                      <span>{getLanguageLabel(article.detected_language)}</span>
                    </span>
                    
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(article.published_at).toLocaleDateString()}</span>
                    </span>
                    
                    {article.author && (
                      <span>By {article.author}</span>
                    )}
                    
                    <span>{article.word_count} words</span>
                    
                    <span>Quality: {(article.readability_score * 100).toFixed(0)}%</span>
                  </div>
                  
                  {article.content_tags && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {article.content_tags.split(',').slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end space-y-2 ml-4">
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(article.urgency_level)}`}>
                    {article.urgency_level}
                  </span>
                  
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStageColor(article.processing_stage)}`}>
                    {article.processing_stage}
                  </span>
                </div>
                
                <button className="p-1 text-gray-400 hover:text-primary-600">
                  <Eye className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {articlesData.length === 0 && (
        <div className="px-6 py-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No articles found</h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your filters or check back later for new articles.
          </p>
        </div>
      )}
    </div>
  );
}