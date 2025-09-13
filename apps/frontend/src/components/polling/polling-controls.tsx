'use client';

import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { 
  Play, 
  Pause, 
  RefreshCw, 
  Settings, 
  Loader2,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

export function PollingControls() {
  const [showSettings, setShowSettings] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const queryClient = useQueryClient();

  const { data: pollingStatus } = useQuery({
    queryKey: ['polling-status'],
    queryFn: () => apiClient.getPollingStatus(),
    refetchInterval: 5000,
  });

  const startPollingMutation = useMutation({
    mutationFn: () => apiClient.startPolling(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polling-status'] });
    },
  });

  const stopPollingMutation = useMutation({
    mutationFn: () => apiClient.stopPolling(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polling-status'] });
    },
  });

  const triggerPollMutation = useMutation({
    mutationFn: () => apiClient.triggerPoll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polling-status'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
      queryClient.invalidateQueries({ queryKey: ['feed-sources'] });
    },
  });

  const updateIntervalMutation = useMutation({
    mutationFn: (minutes: number) => apiClient.updatePollingInterval(minutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polling-status'] });
      setShowSettings(false);
    },
  });

  const isRunning = pollingStatus?.is_running ?? false;
  const currentInterval = pollingStatus?.interval_minutes ?? 5;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">Polling Controls</h3>
          <div className="flex items-center space-x-1">
            <div className={`h-2 w-2 rounded-full ${
              isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`} />
            <span className={`text-sm font-medium ${
              isRunning ? 'text-green-600' : 'text-red-600'
            }`}>
              {isRunning ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          {/* Main Controls */}
          <div className="flex items-center space-x-3">
            {isRunning ? (
              <button
                onClick={() => stopPollingMutation.mutate()}
                disabled={stopPollingMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stopPollingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Pause className="h-4 w-4 mr-2" />
                )}
                Stop Polling
              </button>
            ) : (
              <button
                onClick={() => startPollingMutation.mutate()}
                disabled={startPollingMutation.isPending}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {startPollingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Polling
              </button>
            )}
            
            <button
              onClick={() => triggerPollMutation.mutate()}
              disabled={triggerPollMutation.isPending}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {triggerPollMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Poll Now
            </button>
          </div>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </button>
        </div>

        {/* Current Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Current Interval</p>
                <p className="text-xs text-gray-600">{currentInterval} minutes</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              {isRunning ? (
                <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mr-3" />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">Status</p>
                <p className="text-xs text-gray-600">
                  {isRunning ? 'Polling active' : 'Polling stopped'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center">
              <RefreshCw className="h-5 w-5 text-blue-500 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-900">Last Action</p>
                <p className="text-xs text-gray-600">
                  {triggerPollMutation.isSuccess ? 'Manual poll' : 
                   startPollingMutation.isSuccess ? 'Started' :
                   stopPollingMutation.isSuccess ? 'Stopped' : 
                   'None'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Polling Configuration</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Polling Interval (minutes)
                </label>
                <div className="mt-1 flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={intervalMinutes}
                    onChange={(e) => setIntervalMinutes(parseInt(e.target.value) || 1)}
                    className="block w-20 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  />
                  <span className="text-sm text-gray-600">
                    Currently: {currentInterval}m
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateIntervalMutation.mutate(intervalMinutes)}
                  disabled={updateIntervalMutation.isPending}
                  className="px-3 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md shadow-sm hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateIntervalMutation.isPending ? 'Updating...' : 'Update'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Operation Results */}
        {(startPollingMutation.error || stopPollingMutation.error || triggerPollMutation.error || updateIntervalMutation.error) && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">
              Operation failed: {
                (startPollingMutation.error as Error)?.message ||
                (stopPollingMutation.error as Error)?.message ||
                (triggerPollMutation.error as Error)?.message ||
                (updateIntervalMutation.error as Error)?.message
              }
            </p>
          </div>
        )}

        {(startPollingMutation.isSuccess || stopPollingMutation.isSuccess || triggerPollMutation.isSuccess || updateIntervalMutation.isSuccess) && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              <p className="text-sm text-green-600">
                {startPollingMutation.isSuccess && 'Polling started successfully'}
                {stopPollingMutation.isSuccess && 'Polling stopped successfully'}
                {triggerPollMutation.isSuccess && 'Manual poll triggered successfully'}
                {updateIntervalMutation.isSuccess && 'Polling interval updated successfully'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}