'use client';

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Database,
  Play,
  Square,
  RotateCcw,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  MemoryStick,
  Zap,
  AlertCircle,
  TestTube,
  BarChart3,
  Settings
} from 'lucide-react';

interface ServiceStatus {
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
  healthy: boolean;
  pid?: number;
  startTime?: string;
  lastError?: string;
  responseTime?: number;
  endpoint: string;
  capabilities: string[];
}

interface SystemMetrics {
  memory: {
    used: number;
    heap: number;
    external: number;
  };
  uptime: number;
  cpuUsage: {
    user: number;
    system: number;
  };
}

interface LLMServicesStatus {
  services: {
    nllb: ServiceStatus;
    ollama: ServiceStatus;
  };
  overall: {
    anyRunning: boolean;
    allHealthy: boolean;
    memoryUsage: any;
    uptime: number;
  };
}

export default function LLMServicesPage() {
  const [status, setStatus] = useState<LLMServicesStatus | null>(null);
  const [metrics, setMetrics] = useState<{ system: SystemMetrics; services: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/llm-services/status');
      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.statusText}`);
      }
      const data: LLMServicesStatus = await response.json();
      setStatus(data);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error fetching LLM services status:', err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/llm-services/metrics');
      if (!response.ok) {
        throw new Error(`Failed to fetch metrics: ${response.statusText}`);
      }
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  const controlService = async (action: 'start' | 'stop' | 'restart', service: 'nllb' | 'ollama' | 'both') => {
    try {
      setOperationLoading(`${action}-${service}`);
      const response = await fetch('/api/llm-services/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, service }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} ${service}: ${response.statusText}`);
      }

      // Refresh status after operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setOperationLoading(null);
    }
  };

  const testService = async (service: 'nllb' | 'ollama') => {
    try {
      setOperationLoading(`test-${service}`);
      const response = await fetch(`/api/llm-services/test/${service}`, {
        method: 'POST',
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ ${service.toUpperCase()} Test Successful!\n\nInput: ${result.input}\nOutput: ${result.output}`);
      } else {
        alert(`❌ ${service.toUpperCase()} Test Failed:\n${result.error}`);
      }
    } catch (err) {
      alert(`❌ Test Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setOperationLoading(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchMetrics()]);
      setLoading(false);
    };

    fetchData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchStatus();
      fetchMetrics();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatMemory = (mb: number) => {
    return `${mb.toFixed(1)} MB`;
  };

  const getStatusIcon = (service: ServiceStatus) => {
    if (service.status === 'running' && service.healthy) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (service.status === 'running' && !service.healthy) {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    } else if (service.status === 'error') {
      return <XCircle className="h-5 w-5 text-red-500" />;
    } else if (service.status === 'starting' || service.status === 'stopping') {
      return <Clock className="h-5 w-5 text-blue-500 animate-spin" />;
    } else {
      return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (service: ServiceStatus) => {
    if (service.status === 'running' && service.healthy) return 'text-green-600';
    if (service.status === 'running' && !service.healthy) return 'text-yellow-600';
    if (service.status === 'error') return 'text-red-600';
    if (service.status === 'starting' || service.status === 'stopping') return 'text-blue-600';
    return 'text-gray-500';
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center">
          <Cpu className="mr-3 h-8 w-8" />
          LLM Services Control Panel
        </h1>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 flex items-center">
          <Cpu className="mr-3 h-8 w-8" />
          LLM Services Control Panel
        </h1>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">Error: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Cpu className="mr-3 h-8 w-8" />
          LLM Services Control Panel
        </h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            onClick={() => {
              fetchStatus();
              fetchMetrics();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
            disabled={loading}
          >
            <RotateCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Overall Status */}
      {status && (
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Activity className="mr-2 h-5 w-5" />
            System Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Services Running</span>
                <span className={`font-bold text-lg ${status.overall.anyRunning ? 'text-green-600' : 'text-gray-400'}`}>
                  {[status.services.nllb.status === 'running', status.services.ollama.status === 'running'].filter(Boolean).length}/2
                </span>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">All Healthy</span>
                {status.overall.allHealthy ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
              </div>
            </div>

            {metrics && (
              <>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Memory Usage</span>
                    <span className="font-bold text-lg text-blue-600">
                      {formatMemory(metrics.system.memory.used)}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">System Uptime</span>
                    <span className="font-bold text-lg text-purple-600">
                      {formatUptime(metrics.system.uptime)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bulk Controls */}
          <div className="mt-4 flex space-x-4">
            <button
              onClick={() => controlService('start', 'both')}
              disabled={operationLoading === 'start-both' || status.overall.anyRunning}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center disabled:opacity-50"
            >
              <Play className="h-4 w-4 mr-2" />
              {operationLoading === 'start-both' ? 'Starting...' : 'Start All'}
            </button>

            <button
              onClick={() => controlService('stop', 'both')}
              disabled={operationLoading === 'stop-both' || !status.overall.anyRunning}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center disabled:opacity-50"
            >
              <Square className="h-4 w-4 mr-2" />
              {operationLoading === 'stop-both' ? 'Stopping...' : 'Stop All'}
            </button>

            <button
              onClick={() => controlService('restart', 'both')}
              disabled={operationLoading === 'restart-both'}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors flex items-center disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {operationLoading === 'restart-both' ? 'Restarting...' : 'Restart All'}
            </button>
          </div>
        </div>
      )}

      {/* Individual Services */}
      {status && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* NLLB Service */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Database className="mr-2 h-5 w-5 text-blue-500" />
                NLLB Translation
              </h3>
              {getStatusIcon(status.services.nllb)}
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium capitalize ${getStatusColor(status.services.nllb)}`}>
                  {status.services.nllb.status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Health:</span>
                <span className={`font-medium ${status.services.nllb.healthy ? 'text-green-600' : 'text-red-600'}`}>
                  {status.services.nllb.healthy ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Endpoint:</span>
                <a
                  href={status.services.nllb.endpoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono text-sm"
                >
                  {status.services.nllb.endpoint}
                </a>
              </div>

              {status.services.nllb.pid && (
                <div className="flex justify-between">
                  <span className="text-gray-600">PID:</span>
                  <span className="font-mono text-sm">{status.services.nllb.pid}</span>
                </div>
              )}

              {status.services.nllb.responseTime && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Response Time:</span>
                  <span className="font-medium">{status.services.nllb.responseTime}ms</span>
                </div>
              )}

              {status.services.nllb.startTime && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Started:</span>
                  <span className="text-sm">{new Date(status.services.nllb.startTime).toLocaleString()}</span>
                </div>
              )}

              {status.services.nllb.lastError && (
                <div className="mt-2 p-2 bg-red-50 rounded">
                  <span className="text-red-700 text-sm">{status.services.nllb.lastError}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-1 mt-2">
                {status.services.nllb.capabilities.map(cap => (
                  <span key={cap} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => controlService('start', 'nllb')}
                disabled={operationLoading?.includes('nllb') || status.services.nllb.status === 'running'}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50 text-sm"
              >
                <Play className="h-4 w-4 mr-1" />
                {operationLoading === 'start-nllb' ? 'Starting...' : 'Start'}
              </button>

              <button
                onClick={() => controlService('stop', 'nllb')}
                disabled={operationLoading?.includes('nllb') || status.services.nllb.status !== 'running'}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center disabled:opacity-50 text-sm"
              >
                <Square className="h-4 w-4 mr-1" />
                {operationLoading === 'stop-nllb' ? 'Stopping...' : 'Stop'}
              </button>

              <button
                onClick={() => testService('nllb')}
                disabled={operationLoading === 'test-nllb' || !status.services.nllb.healthy}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 text-sm"
              >
                <TestTube className="h-4 w-4 mr-1" />
                {operationLoading === 'test-nllb' ? 'Testing...' : 'Test'}
              </button>
            </div>
          </div>

          {/* Ollama Service */}
          <div className="bg-white shadow-md rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center">
                <Zap className="mr-2 h-5 w-5 text-purple-500" />
                Ollama Summarization
              </h3>
              {getStatusIcon(status.services.ollama)}
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium capitalize ${getStatusColor(status.services.ollama)}`}>
                  {status.services.ollama.status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Health:</span>
                <span className={`font-medium ${status.services.ollama.healthy ? 'text-green-600' : 'text-red-600'}`}>
                  {status.services.ollama.healthy ? 'Healthy' : 'Unhealthy'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Endpoint:</span>
                <a
                  href={status.services.ollama.endpoint}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline font-mono text-sm"
                >
                  {status.services.ollama.endpoint}
                </a>
              </div>

              {status.services.ollama.pid && (
                <div className="flex justify-between">
                  <span className="text-gray-600">PID:</span>
                  <span className="font-mono text-sm">{status.services.ollama.pid}</span>
                </div>
              )}

              {status.services.ollama.responseTime && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Response Time:</span>
                  <span className="font-medium">{status.services.ollama.responseTime}ms</span>
                </div>
              )}

              {status.services.ollama.startTime && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Started:</span>
                  <span className="text-sm">{new Date(status.services.ollama.startTime).toLocaleString()}</span>
                </div>
              )}

              {status.services.ollama.lastError && (
                <div className="mt-2 p-2 bg-red-50 rounded">
                  <span className="text-red-700 text-sm">{status.services.ollama.lastError}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-1 mt-2">
                {status.services.ollama.capabilities.map(cap => (
                  <span key={cap} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => controlService('start', 'ollama')}
                disabled={operationLoading?.includes('ollama') || status.services.ollama.status === 'running'}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center disabled:opacity-50 text-sm"
              >
                <Play className="h-4 w-4 mr-1" />
                {operationLoading === 'start-ollama' ? 'Starting...' : 'Start'}
              </button>

              <button
                onClick={() => controlService('stop', 'ollama')}
                disabled={operationLoading?.includes('ollama') || status.services.ollama.status !== 'running'}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center disabled:opacity-50 text-sm"
              >
                <Square className="h-4 w-4 mr-1" />
                {operationLoading === 'stop-ollama' ? 'Stopping...' : 'Stop'}
              </button>

              <button
                onClick={() => testService('ollama')}
                disabled={operationLoading === 'test-ollama' || !status.services.ollama.healthy}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 text-sm"
              >
                <TestTube className="h-4 w-4 mr-1" />
                {operationLoading === 'test-ollama' ? 'Testing...' : 'Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* System Metrics */}
      {metrics && (
        <div className="mt-6 bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <BarChart3 className="mr-2 h-5 w-5" />
            System Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                <MemoryStick className="mr-2 h-4 w-4" />
                Memory Usage
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Used:</span>
                  <span className="font-medium">{formatMemory(metrics.system.memory.used)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Heap:</span>
                  <span className="font-medium">{formatMemory(metrics.system.memory.heap)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">External:</span>
                  <span className="font-medium">{formatMemory(metrics.system.memory.external)}</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                <Cpu className="mr-2 h-4 w-4" />
                CPU Usage
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">User:</span>
                  <span className="font-medium">{(metrics.system.cpuUsage.user / 1000).toFixed(1)}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">System:</span>
                  <span className="font-medium">{(metrics.system.cpuUsage.system / 1000).toFixed(1)}ms</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2 flex items-center">
                <Clock className="mr-2 h-4 w-4" />
                Service Uptime
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">NLLB:</span>
                  <span className="font-medium">{formatUptime(metrics.services.nllb.uptime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ollama:</span>
                  <span className="font-medium">{formatUptime(metrics.services.ollama.uptime)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}