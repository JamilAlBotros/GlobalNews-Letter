'use client';

import { useEffect, useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Globe, 
  FileText,
  Clock,
  RefreshCw
} from 'lucide-react';

interface OverallStats {
  total_active_feeds: number;
  total_articles: number;
  articles_last_24h: number;
  articles_last_7d: number;
  last_article_time: string;
}

interface CategoryStats {
  category: string;
  active_feeds: number;
  total_articles: number;
  articles_last_24h: number;
  articles_last_7d: number;
}

interface LanguageStats {
  language: string;
  active_feeds: number;
  total_articles: number;
  articles_last_24h: number;
  articles_last_7d: number;
}

interface DashboardStats {
  overall: OverallStats;
  by_category: CategoryStats[];
  by_language: LanguageStats[];
  last_updated: string;
}

export function StatsOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/dashboard/stats');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }
      
      const data = await response.json();
      setStats(data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard stats');
      console.error('Dashboard stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-2 w-2 bg-red-500 rounded-full mr-3"></div>
            <span className="text-red-800 font-medium">Error loading dashboard stats</span>
          </div>
          <button
            onClick={fetchStats}
            className="text-red-600 hover:text-red-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <p className="text-red-600 text-sm mt-2">{error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Feeds</p>
              <p className="text-2xl font-bold text-gray-900">{stats.overall.total_active_feeds}</p>
            </div>
            <Globe className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Articles</p>
              <p className="text-2xl font-bold text-gray-900">{stats.overall.total_articles.toLocaleString()}</p>
            </div>
            <FileText className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Last 24 Hours</p>
              <p className="text-2xl font-bold text-gray-900">{stats.overall.articles_last_24h}</p>
              <p className="text-xs text-gray-500">articles added</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Last Article</p>
              <p className="text-lg font-bold text-gray-900">{formatTimeAgo(stats.overall.last_article_time)}</p>
            </div>
            <Clock className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Category and Language Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Category */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Articles by Category
            </h3>
          </div>
          <div className="p-6">
            {stats.by_category.length > 0 ? (
              <div className="space-y-4">
                {stats.by_category.map((cat, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {cat.category}
                        </span>
                        <span className="text-sm text-gray-500">
                          {cat.total_articles.toLocaleString()} total
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500 space-x-4">
                        <span>{cat.active_feeds} feeds</span>
                        <span>+{cat.articles_last_24h} today</span>
                        <span>+{cat.articles_last_7d} this week</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min(100, (cat.total_articles / Math.max(...stats.by_category.map(c => c.total_articles))) * 100)}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No category data available</p>
            )}
          </div>
        </div>

        {/* By Language */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Globe className="h-5 w-5 mr-2" />
              Articles by Language
            </h3>
          </div>
          <div className="p-6">
            {stats.by_language.length > 0 ? (
              <div className="space-y-4">
                {stats.by_language.map((lang, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {lang.language}
                        </span>
                        <span className="text-sm text-gray-500">
                          {lang.total_articles.toLocaleString()} total
                        </span>
                      </div>
                      <div className="flex items-center text-xs text-gray-500 space-x-4">
                        <span>{lang.active_feeds} feeds</span>
                        <span>+{lang.articles_last_24h} today</span>
                        <span>+{lang.articles_last_7d} this week</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min(100, (lang.total_articles / Math.max(...stats.by_language.map(l => l.total_articles))) * 100)}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No language data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-right text-xs text-gray-500">
        Last updated: {lastRefresh.toLocaleTimeString()}
      </div>
    </div>
  );
}