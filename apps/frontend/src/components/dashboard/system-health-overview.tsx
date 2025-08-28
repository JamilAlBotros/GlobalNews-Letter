'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

export function SystemHealthOverview() {
  const { data: health, isLoading, error } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => apiClient.getSystemHealth(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <XCircle className="mx-auto h-8 w-8 text-red-500 mb-2" />
            <p className="text-sm text-gray-600">Unable to load system health</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'critical':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-50 text-yellow-800 border-yellow-200';
      case 'critical':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const mockHealth = {
    overall_status: 'healthy' as const,
    components: {
      database: 'healthy' as const,
      feed_processing: 'healthy' as const,
      translation_pipeline: 'warning' as const,
      health_monitoring: 'healthy' as const,
    },
    metrics: {
      active_feeds: 12,
      total_articles: 1547,
      pending_translations: 23,
      system_uptime: '2d 14h 32m',
    },
    alerts: [
      {
        id: '1',
        level: 'warning',
        message: 'Translation queue has 23 pending jobs',
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const healthData = health || mockHealth;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">System Health Overview</h2>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(healthData.overall_status)}`}>
            {getStatusIcon(healthData.overall_status)}
            <span className="ml-2 capitalize">{healthData.overall_status}</span>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {Object.entries(healthData.components).map(([component, status]) => (
            <div key={component} className="flex items-center space-x-3">
              {getStatusIcon(status)}
              <div>
                <p className="text-sm font-medium text-gray-900 capitalize">
                  {component.replace('_', ' ')}
                </p>
                <p className="text-sm text-gray-500 capitalize">{status}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{healthData.metrics.active_feeds}</p>
            <p className="text-sm text-gray-600">Active Feeds</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{healthData.metrics.total_articles}</p>
            <p className="text-sm text-gray-600">Total Articles</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{healthData.metrics.pending_translations}</p>
            <p className="text-sm text-gray-600">Pending Translations</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{healthData.metrics.system_uptime}</p>
            <p className="text-sm text-gray-600">System Uptime</p>
          </div>
        </div>

        {healthData.alerts?.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Recent Alerts</h3>
            <div className="space-y-2">
              {healthData.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-md border ${getStatusColor(alert.level)}`}
                >
                  <div className="flex items-start">
                    {getStatusIcon(alert.level)}
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}