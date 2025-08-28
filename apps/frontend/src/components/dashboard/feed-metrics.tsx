'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2 } from 'lucide-react';

export function FeedMetrics() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['feed-metrics'],
    queryFn: () => apiClient.getFeedMetrics(),
    refetchInterval: 60000, // Refresh every minute
  });

  const mockMetrics = { // TODO: Remove when real data is connected
    feeds_by_language: [
      { language: 'English', count: 8, success_rate: 95 },
      { language: 'Spanish', count: 3, success_rate: 92 },
      { language: 'Portuguese', count: 1, success_rate: 88 },
    ],
    feeds_by_category: [
      { category: 'Finance', count: 6, avg_articles: 15 },
      { category: 'Tech', count: 4, avg_articles: 12 },
      { category: 'Health', count: 2, avg_articles: 8 },
    ],
    refresh_tier_performance: [
      { tier: 'Realtime', feeds: 2, avg_response_time: 1200 },
      { tier: 'Frequent', feeds: 4, avg_response_time: 1800 },
      { tier: 'Standard', feeds: 5, avg_response_time: 2500 },
      { tier: 'Slow', feeds: 1, avg_response_time: 3200 },
    ],
    recent_performance: [
      { time: '00:00', successful: 45, failed: 2 },
      { time: '04:00', successful: 38, failed: 1 },
      { time: '08:00', successful: 52, failed: 3 },
      { time: '12:00', successful: 48, failed: 1 },
      { time: '16:00', successful: 55, failed: 0 },
      { time: '20:00', successful: 41, failed: 2 },
    ],
  };

  const metricsData = metrics || {
    feeds_by_language: [],
    feeds_by_category: [],
    refresh_tier_performance: []
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Feed Metrics</h3>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Feed Metrics</h3>
        <div className="text-center text-gray-500 py-8">
          Unable to load feed metrics
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Feed Performance</h3>
      </div>
      
      <div className="p-6">
        <div className="space-y-6">
          {/* Language Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Feeds by Language</h4>
            <div className="space-y-2">
              {metricsData.feeds_by_language.map((item) => (
                <div key={item.language} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm text-gray-900">{item.language}</span>
                    <span className="text-sm text-gray-500">({item.count} feeds)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-500 h-2 rounded-full"
                        style={{ width: `${item.success_rate}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{item.success_rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Category Performance */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Performance by Category</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={metricsData.feeds_by_category}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="avg_articles" fill="#0ea5e9" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Refresh Tier Summary */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Refresh Tiers</h4>
            <div className="grid grid-cols-2 gap-4">
              {metricsData.refresh_tier_performance.map((tier) => (
                <div key={tier.tier} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900">{tier.tier}</div>
                  <div className="text-xs text-gray-500">{tier.feeds} feeds</div>
                  <div className="text-xs text-gray-500">{tier.avg_response_time}ms avg</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}