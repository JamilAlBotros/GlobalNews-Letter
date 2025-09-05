'use client';

import { useEffect, useState } from 'react';
import { 
  Play, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Activity,
  Pause
} from 'lucide-react';

interface PollingJob {
  id: string;
  feed_name: string;
  status: 'running' | 'completed' | 'scheduled' | 'failed';
  started_at?: string;
  completed_at?: string;
  scheduled_at?: string;
  articles_found?: number;
  error_message?: string;
}

interface PollingStatus {
  status: string;
  active_feeds_count: number;
  polling_interval: string;
  last_poll_cycle: string;
  next_poll_cycle: string;
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
  polling_jobs: {
    active: number;
    completed_today: number;
    failed_today: number;
    next_scheduled: string;
    last_successful: string;
    jobs: PollingJob[];
  };
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case 'running':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'scheduled':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
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
            <div className="text-2xl font-bold text-blue-600">{pollingData.polling_jobs.active}</div>
            <div className="text-xs text-gray-500">Active Now</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{pollingData.polling_jobs.completed_today}</div>
            <div className="text-xs text-gray-500">Completed Today</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{pollingData.polling_jobs.failed_today}</div>
            <div className="text-xs text-gray-500">Failed Today</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{pollingStatus.active_feeds_count}</div>
            <div className="text-xs text-gray-500">Total Feeds</div>
          </div>
        </div>

        {/* Polling Schedule Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Interval:</span>
              <span className="ml-2 text-gray-600">{pollingStatus.polling_interval}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Last Run:</span>
              <span className="ml-2 text-gray-600">{formatTime(pollingStatus.last_poll_cycle)}</span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Next Run:</span>
              <span className="ml-2 text-gray-600">{formatTime(pollingStatus.next_poll_cycle)}</span>
            </div>
          </div>
        </div>

        {/* Current Jobs */}
        {pollingData.polling_jobs.jobs.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Current Jobs</h4>
            <div className="space-y-3">
              {pollingData.polling_jobs.jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <div className="font-medium text-gray-900">{job.feed_name}</div>
                      <div className="text-xs text-gray-500">
                        {job.status === 'running' && job.started_at && `Started ${formatTime(job.started_at)}`}
                        {job.status === 'completed' && job.completed_at && `Completed ${formatTime(job.completed_at)}`}
                        {job.status === 'scheduled' && job.scheduled_at && `Scheduled ${formatTime(job.scheduled_at)}`}
                        {job.articles_found !== undefined && ` • ${job.articles_found} articles found`}
                      </div>
                    </div>
                  </div>
                  <span className={getStatusBadge(job.status)}>{job.status}</span>
                </div>
              ))}
            </div>
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