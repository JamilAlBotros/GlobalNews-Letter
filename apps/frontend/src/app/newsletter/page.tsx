'use client';

import { useState, useEffect } from 'react';
import { Search, ExternalLink, Calendar, Filter, Mail, Download, CheckSquare, Square } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  url: string;
  description: string | null;
  feed_name: string;
  detected_language: string | null;
  published_at: string;
  created_at: string;
}

interface ArticleResponse {
  data: Article[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export default function NewsletterPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFeed, setFilterFeed] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<ArticleResponse['pagination'] | null>(null);
  const [availableFeeds, setAvailableFeeds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Newsletter settings
  const [newsletterTitle, setNewsletterTitle] = useState('Weekly News Digest');
  const [newsletterIntro, setNewsletterIntro] = useState('Here are the top stories from this week:');
  const [newsletterFooter, setNewsletterFooter] = useState('Thank you for reading!');

  // Fetch articles from database
  const fetchArticles = async (page: number = 1, search: string = '', feed: string = '') => {
    setLoading(true);
    setError(null);
    
    try {
      // Construct query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (feed) {
        params.append('feed_id', feed);
      }

      // Use direct database query since API has issues
      const response = await fetch(`/api/articles?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch articles');
      }
      
      const data: ArticleResponse = await response.json();
      setArticles(data.data);
      setPagination(data.pagination);
      
      // Extract unique feed names for filtering
      const feeds = Array.from(new Set(data.data.map(article => article.feed_name).filter(Boolean)));
      setAvailableFeeds(feeds);
      
    } catch (err) {
      setError('Failed to load articles. Please try again.');
      console.error('Error fetching articles:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArticles(currentPage, searchTerm, filterFeed);
  }, [currentPage, searchTerm, filterFeed]);

  // Handle article selection
  const toggleArticleSelection = (articleId: string) => {
    const newSelection = new Set(selectedArticles);
    if (newSelection.has(articleId)) {
      newSelection.delete(articleId);
    } else {
      newSelection.add(articleId);
    }
    setSelectedArticles(newSelection);
  };

  const selectAll = () => {
    const allIds = new Set(articles.map(article => article.id));
    setSelectedArticles(allIds);
  };

  const deselectAll = () => {
    setSelectedArticles(new Set());
  };

  // Filter articles based on search term
  const filteredArticles = articles.filter(article =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (article.description && article.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Generate newsletter
  const generateNewsletter = async () => {
    if (selectedArticles.size === 0) {
      alert('Please select at least one article to generate a newsletter.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/newsletter/from-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_ids: Array.from(selectedArticles),
          newsletter_title: newsletterTitle,
          intro: newsletterIntro,
          footer: newsletterFooter,
          force_language: 'ltr'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate newsletter');
      }

      const newsletterHtml = await response.text();
      
      // Open newsletter in new window
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(newsletterHtml);
        newWindow.document.close();
      } else {
        // Fallback: download as file
        const blob = new Blob([newsletterHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `newsletter-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Failed to generate newsletter. Please try again.');
      console.error('Error generating newsletter:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (loading && articles.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading articles...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Newsletter Curation</h1>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              {selectedArticles.size} articles selected
            </span>
            {selectedArticles.size > 0 && (
              <button
                onClick={generateNewsletter}
                disabled={isGenerating}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>Loading...</>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Generate Newsletter
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Newsletter Settings */}
        {selectedArticles.size > 0 && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Newsletter Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newsletterTitle}
                  onChange={(e) => setNewsletterTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Introduction
                </label>
                <input
                  type="text"
                  value={newsletterIntro}
                  onChange={(e) => setNewsletterIntro(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Footer
                </label>
                <input
                  type="text"
                  value={newsletterFooter}
                  onChange={(e) => setNewsletterFooter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0 md:space-x-4 mb-6">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search articles by title or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <select
                value={filterFeed}
                onChange={(e) => setFilterFeed(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">All Feeds</option>
                {availableFeeds.map((feed) => (
                  <option key={feed} value={feed}>
                    {feed}
                  </option>
                ))}
              </select>
              
              <div className="flex space-x-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Select All
                </button>
                <button
                  onClick={deselectAll}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Deselect All
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Articles List */}
          <div className="space-y-4">
            {filteredArticles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No articles found matching your search.' : 'No articles available.'}
              </div>
            ) : (
              filteredArticles.map((article) => (
                <div
                  key={article.id}
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                    selectedArticles.has(article.id) ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleArticleSelection(article.id)}
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 mt-1">
                      {selectedArticles.has(article.id) ? (
                        <CheckSquare className="h-5 w-5 text-indigo-600" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <h3 className="text-lg font-medium text-gray-900 mb-2 leading-tight">
                          {article.title}
                        </h3>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-4 flex-shrink-0 text-indigo-600 hover:text-indigo-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                      
                      {article.description && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {article.description}
                        </p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="inline-flex items-center">
                          <Calendar className="mr-1 h-4 w-4" />
                          {formatDate(article.published_at)}
                        </span>
                        
                        {article.feed_name && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {article.feed_name}
                          </span>
                        )}
                        
                        {article.detected_language && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {article.detected_language}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing page {pagination.page} of {pagination.total_pages} 
                ({pagination.total} total articles)
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(pagination.total_pages, currentPage + 1))}
                  disabled={currentPage === pagination.total_pages || loading}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}