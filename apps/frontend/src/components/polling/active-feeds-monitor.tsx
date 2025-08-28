'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { 
  Rss, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  TrendingUp,
  Activity
} from 'lucide-react';

export function ActiveFeedsMonitor() {
  const { data: feeds, isLoading, error } = useQuery({
    queryKey: ['active-feeds-monitor'],
    queryFn: () => apiClient.getActiveFeedsStatus(),
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const feedsData = feeds || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'failed':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'realtime':
        return 'bg-purple-100 text-purple-800';
      case 'frequent':
        return 'bg-blue-100 text-blue-800';
      case 'standard':
        return 'bg-green-100 text-green-800';
      case 'slow':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const formatTimeUntil = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((time.getTime() - now.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    return `${Math.floor(diffInMinutes / 60)}h ${diffInMinutes % 60}m`;
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
        <h3 className="text-lg font-medium text-gray-900">Active Feeds Monitor</h3>
        <p className="text-sm text-gray-600 mt-1">
          Real-time polling status for all RSS feeds
        </p>
      </div>
      
      <div className="divide-y divide-gray-200">
        {feedsData.map((feed) => (
          <div key={feed.id} className="px-6 py-4 hover:bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <Rss className="h-5 w-5 text-primary-600" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {feed.name}
                    </h4>
                    {getStatusIcon(feed.status)}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTierColor(feed.refresh_tier)}`}>
                      {feed.refresh_tier}
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {feed.url}
                  </p>
                  
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span className="flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Last: {formatRelativeTime(feed.last_poll_at)}</span>
                    </span>
                    
                    <span>Next: {formatTimeUntil(feed.next_poll_at)}</span>
                    
                    <span>Today: {feed.articles_today}</span>
                    
                    <span>Avg: {feed.avg_response_time}ms</span>
                  </div>
                  
                  {/* Progress bar for success rate */}
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Success Rate</span>
                      <span>{feed.success_rate.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${
                          feed.success_rate >= 95
                            ? 'bg-green-500'
                            : feed.success_rate >= 80
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(feed.success_rate, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  {feed.consecutive_failures > 0 && (
                    <div className="mt-2 text-xs text-red-600">
                      ⚠️ {feed.consecutive_failures} consecutive failures
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end space-y-1 ml-4">
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(feed.status)}`}>
                  <span className="capitalize">{feed.status}</span>
                </div>
                
                <div className="text-xs text-gray-500">
                  {feed.articles_fetched} articles
                </div>
                
                <div className="flex items-center space-x-1">
                  <span className="text-xs text-gray-500 uppercase">{feed.language}</span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500 capitalize">{feed.category}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {feedsData.length === 0 && (
        <div className="px-6 py-8 text-center">
          <Rss className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No active feeds</h3>
          <p className="mt-1 text-sm text-gray-500">
            Configure RSS feeds to start monitoring their polling status.
          </p>
        </div>
      )}
    </div>
  );
}