'use client';

import { useEffect, useState } from 'react';
import { 
  RefreshCw,
  Activity,
  AlertCircle
} from 'lucide-react';

interface PollingStatus {
  status: string;
  active_feeds_count: number;
  recent_activity: Array<{
    feed_id: string;
    feed_name: string;
    category: string;
    language: string;
    last_updated: string;
    status: string;
  }>;
}

interface PollingData {
  overall: {
    total_active_feeds: number;
    total_articles: number;
    articles_last_24h: number;
    articles_last_7d: number;
    last_article_time: string | null;
  };
  by_category: Array<{
    category: string;
    active_feeds: number;
    total_articles: number;
    articles_last_24h: number;
    articles_last_7d: number;
  }>;
  by_language: Array<{
    language: string;
    active_feeds: number;
    total_articles: number;
    articles_last_24h: number;
    articles_last_7d: number;
  }>;
  last_updated: string;
}

export function PollingStatus() {
  const [pollingData, setPollingData] = useState<PollingData | null>(null);
  const [pollingStatus, setPollingStatus] = useState<PollingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPollingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch both stats and polling status
      const [statsResponse, statusResponse] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/dashboard/polling-status')
      ]);

      if (!statsResponse.ok || !statusResponse.ok) {
        throw new Error('Failed to fetch polling data');
      }

      const statsData = await statsResponse.json();
      const statusData = await statusResponse.json();
      
      setPollingData(statsData);
      setPollingStatus(statusData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch polling data');
      console.error('Polling data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPollingData();
    // Refresh every 30 seconds for real-time updates
    const interval = setInterval(fetchPollingData, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString();
  };


  if (loading && !pollingData) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded mb-4 w-1/3"></div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <span className="text-red-800 font-medium">Error loading polling status</span>
          </div>
          <button
            onClick={fetchPollingData}
            className="text-red-600 hover:text-red-800 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        <p className="text-red-600 text-sm mt-2">{error}</p>
      </div>
    );
  }

  if (!pollingData || !pollingStatus) return null;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Activity className="h-5 w-5 mr-2" />
            Polling Jobs Status
          </h3>
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${pollingStatus.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600 capitalize">{pollingStatus.status}</span>
            <button
              onClick={fetchPollingData}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{pollingStatus?.active_feeds_count || 0}</div>
            <div className="text-xs text-gray-500">Active Feeds</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{pollingData.overall.total_articles}</div>
            <div className="text-xs text-gray-500">Total Articles</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{pollingData.overall.articles_last_24h}</div>
            <div className="text-xs text-gray-500">Last 24h</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{pollingData.overall.articles_last_7d}</div>
            <div className="text-xs text-gray-500">Last 7 days</div>
          </div>
        </div>

        {/* Polling Schedule Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Status:</span>
              <span className="ml-2 text-gray-600 capitalize">{pollingStatus?.status || 'Unknown'}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Last Updated:</span>
              <span className="ml-2 text-gray-600">{formatTime(pollingData.last_updated)}</span>
            </div>
          </div>
        </div>

        {/* Feed Activity Section (replaces jobs) */}
        {pollingStatus?.recent_activity && pollingStatus.recent_activity.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No active feeds configured yet.</p>
            <p className="text-sm mt-1">Add some RSS feeds to start polling for articles.</p>
          </div>
        )}

        {/* Recent Feed Activity */}
        {pollingStatus.recent_activity.length > 0 && (
          <div className="mt-6">
            <h4 className="font-medium text-gray-900 mb-3">Recent Feed Activity</h4>
            <div className="space-y-2">
              {pollingStatus.recent_activity.slice(0, 5).map((activity) => (
                <div key={activity.feed_id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium">{activity.feed_name}</span>
                    <span className="text-gray-500">({activity.category} • {activity.language})</span>
                  </div>
                  <span className="text-gray-500">
                    {new Date(activity.last_updated).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}