'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  Loader2, 
  AlertCircle, 
  FileText,
  Calendar,
  Language,
  Globe,
  RefreshCw
} from 'lucide-react';
import { ArticleCard } from './article-card';
import { ArticlePreviewModal } from './article-preview-modal';

interface Article {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  detected_language: string | null;
  needs_manual_language_review: boolean;
  published_at: string;
  scraped_at: string;
  created_at: string;
  feed_id: string;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'newest' | 'oldest' | 'title' | 'source';

export function ArticlesList() {
  const [selectedFeed, setSelectedFeed] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<Article | null>(null);

  const { data: articles, isLoading, error, refetch } = useQuery({
    queryKey: ['articles', selectedFeed],
    queryFn: () => {
      return apiClient.getArticles(1, 100, selectedFeed !== 'all' ? selectedFeed : undefined);
    },
  });

  const { data: feeds } = useQuery({
    queryKey: ['feeds-for-filter'],
    queryFn: () => apiClient.getFeeds(1, 100),
  });

  const articlesData = articles || [];
  const feedsData = feeds || [];

  // Filter and sort articles
  const filteredAndSortedArticles = useMemo(() => {
    let filtered = [...articlesData];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(query) ||
        article.description?.toLowerCase().includes(query) ||
        article.content?.toLowerCase().includes(query)
      );
    }

    // Language filter
    if (selectedLanguage !== 'all') {
      filtered = filtered.filter(article => 
        article.detected_language === selectedLanguage
      );
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(filterDate.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(filterDate.getMonth() - 1);
          break;
      }
      
      if (dateFilter !== 'all') {
        filtered = filtered.filter(article => 
          new Date(article.published_at) >= filterDate
        );
      }
    }

    // Sort articles
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
        case 'oldest':
          return new Date(a.published_at).getTime() - new Date(b.published_at).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        case 'source':
          return a.feed_id.localeCompare(b.feed_id);
        default:
          return 0;
      }
    });

    return filtered;
  }, [articlesData, searchQuery, selectedLanguage, dateFilter, sortBy]);

  // Get unique languages from articles
  const availableLanguages = useMemo(() => {
    const languages = new Set(
      articlesData
        .map(article => article.detected_language)
        .filter(Boolean)
    );
    return Array.from(languages).sort();
  }, [articlesData]);

  // Get language display name
  const getLanguageName = (code: string) => {
    const languages: Record<string, string> = {
      'en': 'English',
      'es': 'Español',
      'pt': 'Português', 
      'fr': 'Français',
      'ar': 'العربية',
      'zh': '中文',
      'ja': '日本語'
    };
    return languages[code] || code.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-gray-600">Loading articles...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-12">
          <div className="flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load articles</h3>
              <p className="text-gray-600 mb-4">There was a problem fetching your articles.</p>
              <button 
                onClick={() => refetch()}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try again</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Search and View Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
          {/* Search */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search articles by title, description, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* View Controls */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                showFilters 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </button>

            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Feed Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Globe className="inline h-4 w-4 mr-1" />
                  Feed Source
                </label>
                <select
                  value={selectedFeed}
                  onChange={(e) => setSelectedFeed(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Feeds ({articlesData.length})</option>
                  {feedsData.map((feed) => (
                    <option key={feed.id} value={feed.id}>
                      {feed.name} ({feed.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Language Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Language className="inline h-4 w-4 mr-1" />
                  Language
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Languages</option>
                  {availableLanguages.map((lang) => (
                    <option key={lang} value={lang}>
                      {getLanguageName(lang)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Published
                </label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full rounded-lg border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>

              {/* Sort Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="w-full rounded-lg border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="title">Title A-Z</option>
                  <option value="source">By Source</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Results Summary */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {filteredAndSortedArticles.length} of {articlesData.length} articles
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
          
          {(searchQuery || selectedLanguage !== 'all' || dateFilter !== 'all' || selectedFeed !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedLanguage('all');
                setDateFilter('all');
                setSelectedFeed('all');
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Articles Grid/List */}
      {filteredAndSortedArticles.length > 0 ? (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
          : "space-y-4"
        }>
          {filteredAndSortedArticles.map((article) => (
            viewMode === 'grid' ? (
              <ArticleCard
                key={article.id}
                article={article}
                onPreview={setPreviewArticle}
              />
            ) : (
              // List view - simplified card
              <div key={article.id} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <h3 
                      onClick={() => setPreviewArticle(article)}
                      className="text-lg font-semibold text-gray-900 mb-2 line-clamp-1 cursor-pointer hover:text-blue-600"
                    >
                      {article.title}
                    </h3>
                    {article.description && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {article.description}
                      </p>
                    )}
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>{new Date(article.published_at).toLocaleDateString()}</span>
                      {article.detected_language && (
                        <span>{getLanguageName(article.detected_language)}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setPreviewArticle(article)}
                    className="flex-shrink-0 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    Preview
                  </button>
                </div>
              </div>
            )
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchQuery || selectedLanguage !== 'all' || dateFilter !== 'all' || selectedFeed !== 'all' 
              ? 'No articles match your filters' 
              : 'No articles found'
            }
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery || selectedLanguage !== 'all' || dateFilter !== 'all' || selectedFeed !== 'all'
              ? 'Try adjusting your search terms or filters.'
              : 'Articles will appear here once feeds are added and polled.'
            }
          </p>
          
          {(searchQuery || selectedLanguage !== 'all' || dateFilter !== 'all' || selectedFeed !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedLanguage('all');
                setDateFilter('all');
                setSelectedFeed('all');
              }}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Clear all filters</span>
            </button>
          )}
        </div>
      )}

      {/* Article Preview Modal */}
      <ArticlePreviewModal
        article={previewArticle}
        isOpen={previewArticle !== null}
        onClose={() => setPreviewArticle(null)}
      />
    </div>
  );
}