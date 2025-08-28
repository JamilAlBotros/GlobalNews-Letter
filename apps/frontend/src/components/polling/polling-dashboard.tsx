'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  TrendingUp,
  Zap
} from 'lucide-react';

export function PollingDashboard() {
  const { data: pollingStatus, isLoading, error } = useQuery({
    queryKey: ['polling-status'],
    queryFn: () => apiClient.getPollingStatus(),
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });

  const statusData = pollingStatus || {
    is_running: false,
    last_poll_at: null,
    next_poll_at: null,
    total_feeds: 0,
    active_feeds: 0,
    failed_feeds: 0,
    articles_fetched_today: 0,
    articles_fetched_last_hour: 0,
    avg_response_time: 0,
    polls_today: 0,
    successful_polls: 0,
    failed_polls: 0,
    uptime_percentage: 0,
    current_interval_minutes: 5,
    adaptive_polling_enabled: false,
  };

  const getStatusIcon = (isRunning: boolean) => {
    return isRunning ? (
      <div className="flex items-center space-x-2">
        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-green-600 font-medium">Running</span>
      </div>
    ) : (
      <div className="flex items-center space-x-2">
        <div className="h-2 w-2 bg-red-500 rounded-full" />
        <span className="text-red-600 font-medium">Stopped</span>
      </div>
    );
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    return `${Math.floor(diffInMinutes / 60)}h ago`;
  };

  const formatTimeUntil = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((time.getTime() - now.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Any moment';
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
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Polling Status</h3>
          {getStatusIcon(statusData.is_running)}
        </div>
      </div>
      
      <div className="p-6">
        <div className="space-y-6">
          {/* Current Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg mx-auto mb-2">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-gray-900">Last Poll</p>
              <p className="text-xs text-gray-500">{formatTimeAgo(statusData.last_poll_at)}</p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg mx-auto mb-2">
                <Zap className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-sm font-medium text-gray-900">Next Poll</p>
              <p className="text-xs text-gray-500">{formatTimeUntil(statusData.next_poll_at)}</p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Active Feeds</span>
              <span className="text-sm font-medium text-gray-900">
                {statusData.active_feeds}/{statusData.total_feeds}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Articles Today</span>
              <span className="text-sm font-medium text-gray-900">
                {statusData.articles_fetched_today}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Hour</span>
              <span className="text-sm font-medium text-gray-900">
                {statusData.articles_fetched_last_hour}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg Response</span>
              <span className="text-sm font-medium text-gray-900">
                {statusData.avg_response_time}ms
              </span>
            </div>
          </div>

          {/* Success Rate */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Success Rate</span>
              <span className="text-sm font-medium text-gray-900">
                {((statusData.successful_polls / statusData.polls_today) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full"
                style={{ 
                  width: `${(statusData.successful_polls / statusData.polls_today) * 100}%` 
                }}
              />
            </div>
          </div>

          {/* Polling Configuration */}
          <div className="pt-4 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Configuration</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Interval</span>
                <span className="text-xs font-medium text-gray-900">
                  {statusData.current_interval_minutes}m
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Adaptive Polling</span>
                <span className={`text-xs font-medium ${
                  statusData.adaptive_polling_enabled 
                    ? 'text-green-600' 
                    : 'text-gray-600'
                }`}>
                  {statusData.adaptive_polling_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">Uptime</span>
                <span className="text-xs font-medium text-gray-900">
                  {statusData.uptime_percentage}%
                </span>
              </div>
            </div>
          </div>

          {/* Status Indicators */}
          {statusData.failed_feeds > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start">
                <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 mr-2" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    {statusData.failed_feeds} feeds failing
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Check the Health Monitor for details
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}