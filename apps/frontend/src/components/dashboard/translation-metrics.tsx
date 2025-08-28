'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

export function TranslationMetrics() {
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['translation-metrics'],
    queryFn: () => apiClient.getTranslationMetrics(),
    refetchInterval: 60000, // Refresh every minute
  });

  const mockMetrics = {
    job_status_distribution: [
      { name: 'Completed', value: 156, color: '#10b981' },
      { name: 'Processing', value: 23, color: '#f59e0b' },
      { name: 'Queued', value: 12, color: '#0ea5e9' },
      { name: 'Failed', value: 4, color: '#ef4444' },
    ],
    language_pairs: [
      { from: 'en', to: 'es', count: 45, avg_quality: 4.2 },
      { from: 'en', to: 'pt', count: 32, avg_quality: 4.1 },
      { from: 'es', to: 'en', count: 28, avg_quality: 4.0 },
      { from: 'pt', to: 'en', count: 15, avg_quality: 3.9 },
    ],
    processing_stats: {
      avg_processing_time: 1250, // ms
      total_translations: 195,
      success_rate: 97.9,
      queue_size: 35,
    },
    recent_activity: [
      { hour: '00', completed: 12, failed: 0 },
      { hour: '04', completed: 8, failed: 1 },
      { hour: '08', completed: 15, failed: 0 },
      { hour: '12', completed: 18, failed: 1 },
      { hour: '16', completed: 22, failed: 0 },
      { hour: '20', completed: 14, failed: 2 },
    ],
  };

  const metricsData = metrics || mockMetrics;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Translation Metrics</h3>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Translation Metrics</h3>
        <div className="text-center text-gray-500 py-8">
          Unable to load translation metrics
        </div>
      </div>
    );
  }

  const getLanguageName = (code: string) => {
    const languages: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      pt: 'Portuguese',
      fr: 'French',
      ar: 'Arabic',
      zh: 'Chinese',
      ja: 'Japanese',
    };
    return languages[code] || code.toUpperCase();
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-medium text-gray-900">Translation Pipeline</h3>
      </div>
      
      <div className="p-6">
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg mx-auto mb-2">
                <CheckCircle className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900">{metricsData.processing_stats.total_translations}</p>
              <p className="text-xs text-gray-600">Total Translations</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg mx-auto mb-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900">{metricsData.processing_stats.success_rate}%</p>
              <p className="text-xs text-gray-600">Success Rate</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 bg-yellow-100 rounded-lg mx-auto mb-2">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900">{metricsData.processing_stats.queue_size}</p>
              <p className="text-xs text-gray-600">Queue Size</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-lg mx-auto mb-2">
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900">{metricsData.processing_stats.avg_processing_time}ms</p>
              <p className="text-xs text-gray-600">Avg Time</p>
            </div>
          </div>

          {/* Job Status Pie Chart */}
          <div className="flex items-center space-x-6">
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Job Status Distribution</h4>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={metricsData.job_status_distribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    dataKey="value"
                  >
                    {metricsData.job_status_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {metricsData.job_status_distribution.map((item, index) => (
                <div key={item.name} className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Language Pairs */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Top Language Pairs</h4>
            <div className="space-y-3">
              {metricsData.language_pairs.map((pair, index) => (
                <div key={`${pair.from}-${pair.to}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-900">
                      {getLanguageName(pair.from)} → {getLanguageName(pair.to)}
                    </span>
                    <span className="text-xs text-gray-500">({pair.count} translations)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Quality: {pair.avg_quality}/5</span>
                    <div className="w-16 bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-primary-500 h-1.5 rounded-full"
                        style={{ width: `${(pair.avg_quality / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}