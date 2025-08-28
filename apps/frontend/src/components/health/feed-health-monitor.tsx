'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Activity, AlertTriangle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function FeedHealthMonitor() {
  const { data: health, isLoading, error } = useQuery({
    queryKey: ['health-analytics'],
    queryFn: () => apiClient.getHealthAnalytics(),
    refetchInterval: 30000,
  });

  // Mock data for development
  const mockHealth = {
    feed_health: [
      {
        feed_id: 'reuters-business-feed',
        feed_name: 'Reuters Business News',
        status: 'healthy',
        success_rate: 0.98,
        avg_response_time: 1200,
        last_successful_fetch: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        consecutive_failures: 0,
        total_fetches_24h: 24,
        successful_fetches_24h: 24,
        avg_articles_per_fetch: 15,
      },
      {
        feed_id: 'techcrunch-main-feed',
        feed_name: 'TechCrunch Main Feed',
        status: 'healthy',
        success_rate: 0.95,
        avg_response_time: 1800,
        last_successful_fetch: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        consecutive_failures: 0,
        total_fetches_24h: 24,
        successful_fetches_24h: 23,
        avg_articles_per_fetch: 12,
      },
      {
        feed_id: 'elpais-salud-feed',
        feed_name: 'El País - Sección Salud',
        status: 'warning',
        success_rate: 0.83,
        avg_response_time: 3200,
        last_successful_fetch: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        consecutive_failures: 2,
        total_fetches_24h: 16,
        successful_fetches_24h: 13,
        avg_articles_per_fetch: 8,
      },
      {
        feed_id: 'broken-feed',
        feed_name: 'Example Broken Feed',
        status: 'critical',
        success_rate: 0.12,
        avg_response_time: 5000,
        last_successful_fetch: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        consecutive_failures: 12,
        total_fetches_24h: 24,
        successful_fetches_24h: 3,
        avg_articles_per_fetch: 2,
      },
    ],
  };

  const healthData = health || { feed_health: [], system_alerts: [] };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'critical':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
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

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Feed Health Monitor</h3>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {healthData.feed_health.map((feed) => (
            <div
              key={feed.feed_id}
              className={`p-4 rounded-lg border ${getStatusColor(feed.status)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {getStatusIcon(feed.status)}
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      {feed.feed_name}
                    </h4>
                    <div className="mt-1 text-xs text-gray-600">
                      Success rate: {(feed.success_rate * 100).toFixed(1)}% • 
                      Response time: {feed.avg_response_time}ms • 
                      Last fetch: {formatRelativeTime(feed.last_successful_fetch)}
                    </div>
                    
                    {feed.consecutive_failures > 0 && (
                      <div className="mt-1 text-xs text-red-600">
                        ⚠️ {feed.consecutive_failures} consecutive failures
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right text-xs text-gray-500">
                  <div>{feed.successful_fetches_24h}/{feed.total_fetches_24h} successful (24h)</div>
                  <div>{feed.avg_articles_per_fetch} avg articles/fetch</div>
                </div>
              </div>
              
              {/* Progress bar for success rate */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Success Rate</span>
                  <span>{(feed.success_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      feed.success_rate >= 0.9
                        ? 'bg-green-500'
                        : feed.success_rate >= 0.7
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${feed.success_rate * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}