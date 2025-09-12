'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface PollingJobLog {
  job_id: string;
  job_name: string;
  execution_time: string | null;
  status: 'success' | 'failure' | 'pending';
  feeds_processed: number;
  articles_found: number;
  execution_time_ms: number;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  next_run_time: string | null;
  is_active: boolean;
  interval_minutes: number;
}

interface PollingJobsLogsResponse {
  data: PollingJobLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  summary: {
    total_jobs: number;
    active_jobs: number;
    total_successful_runs: number;
    total_failed_runs: number;
    recent_executions_24h: number;
  };
}

export function PollingLogs() {
  const [logs, setLogs] = useState<PollingJobLog[]>([]);
  const [summary, setSummary] = useState<PollingJobsLogsResponse['summary'] | null>(null);
  const [pagination, setPagination] = useState<PollingJobsLogsResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failure'>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [availableJobs, setAvailableJobs] = useState<Array<{ id: string; name: string }>>([]);
  const [page, setPage] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status: statusFilter,
      });
      
      if (selectedJobId && selectedJobId !== 'all') {
        params.append('job_id', selectedJobId);
      }
      
      const response = await fetch(`/api/polling/jobs/logs?${params}`);
      if (response.ok) {
        const data: PollingJobsLogsResponse = await response.json();
        setLogs(data.data);
        setSummary(data.summary);
        setPagination(data.pagination);
        
        // Extract unique jobs for filter dropdown
        const uniqueJobs = Array.from(new Map(
          data.data.map(log => [log.job_id, { id: log.job_id, name: log.job_name }])
        ).values());
        setAvailableJobs(uniqueJobs);
      }
    } catch (error) {
      console.error('Failed to fetch polling logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter, selectedJobId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colorClass = status === 'success' 
      ? 'bg-green-100 text-green-800' 
      : status === 'failure' 
        ? 'bg-red-100 text-red-800' 
        : 'bg-yellow-100 text-yellow-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Polling Job Logs</h2>
        <button 
          onClick={fetchLogs} 
          disabled={loading}
          className="flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="text-2xl font-bold text-gray-900">{summary.total_jobs}</div>
              <p className="text-sm text-gray-500">Total Jobs</p>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="text-2xl font-bold text-green-600">{summary.active_jobs}</div>
              <p className="text-sm text-gray-500">Active Jobs</p>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="text-2xl font-bold text-blue-600">{summary.total_successful_runs}</div>
              <p className="text-sm text-gray-500">Successful Runs</p>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="text-2xl font-bold text-red-600">{summary.total_failed_runs}</div>
              <p className="text-sm text-gray-500">Failed Runs</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Status:</label>
          <select 
            value={statusFilter} 
            onChange={(e) => {
              setStatusFilter(e.target.value as 'all' | 'success' | 'failure');
              setPage(1);
            }}
            className="block w-32 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="failure">Failure</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Job:</label>
          <select 
            value={selectedJobId || 'all'} 
            onChange={(e) => {
              setSelectedJobId(e.target.value === 'all' ? null : e.target.value);
              setPage(1);
            }}
            className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="all">All Jobs</option>
            {availableJobs.map(job => (
              <option key={job.id} value={job.id}>{job.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Execution History</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Recent polling job executions and their results
          </p>
        </div>
        <div className="border-t border-gray-200">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No logs found for the selected filters
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={`${log.job_id}-${log.execution_time}`} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(log.status)}
                        <h3 className="font-semibold">{log.job_name}</h3>
                        {getStatusBadge(log.status)}
                        {!log.is_active && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">Last Run:</span>
                          <br />
                          {formatDateTime(log.execution_time)}
                        </div>
                        <div>
                          <span className="font-medium">Next Run:</span>
                          <br />
                          {formatDateTime(log.next_run_time)}
                        </div>
                        <div>
                          <span className="font-medium">Articles Found:</span>
                          <br />
                          <span className="text-lg font-bold text-blue-600">
                            {log.articles_found}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Feeds Processed:</span>
                          <br />
                          <span className="text-lg font-bold text-green-600">
                            {log.feeds_processed}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span>
                            Execution Time: {formatExecutionTime(log.execution_time_ms)}
                          </span>
                          <span>
                            Success Rate: {log.total_runs > 0 
                              ? Math.round((log.successful_runs / log.total_runs) * 100) 
                              : 0}% ({log.successful_runs}/{log.total_runs})
                          </span>
                          <span>
                            Interval: {log.interval_minutes}min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex justify-between items-center mt-6 pt-4 border-t">
              <div className="text-sm text-gray-500">
                Showing {logs.length} of {pagination.total} logs
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="flex items-center px-3 text-sm">
                  Page {page} of {pagination.total_pages}
                </span>
                <button
                  disabled={page >= pagination.total_pages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
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