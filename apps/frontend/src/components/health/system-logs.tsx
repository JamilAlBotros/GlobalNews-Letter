'use client';

import { useState } from 'react';
import { AlertTriangle, Info, XCircle, CheckCircle, Clock } from 'lucide-react';

export function SystemLogs() {
  const [selectedLevel, setSelectedLevel] = useState('all');

  // TODO: Connect to actual logging service
  const logs: any[] = [];
  
  const filteredLogs = selectedLevel === 'all' 
    ? logs 
    : logs.filter((log: any) => log.level === selectedLevel);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-400" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-700 bg-red-50';
      case 'warning':
        return 'text-yellow-700 bg-yellow-50';
      case 'info':
        return 'text-blue-700 bg-blue-50';
      case 'success':
        return 'text-green-700 bg-green-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    return `${Math.floor(diffInMinutes / 60)}h ago`;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">System Logs</h3>
          <div className="flex items-center space-x-2">
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              className="text-sm border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="all">All Levels</option>
              <option value="error">Errors</option>
              <option value="warning">Warnings</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {filteredLogs.map((log) => (
            <div key={log.id} className={`px-6 py-3 ${getLevelColor(log.level)}`}>
              <div className="flex items-start space-x-3">
                {getLevelIcon(log.level)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {log.component}
                      </span>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        {log.level}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(log.timestamp)}</span>
                      <span>({formatRelativeTime(log.timestamp)})</span>
                    </div>
                  </div>
                  
                  <p className="mt-1 text-sm text-gray-900">
                    {log.message}
                  </p>
                  
                  {log.details && (
                    <p className="mt-1 text-xs text-gray-600">
                      {log.details}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {filteredLogs.length === 0 && (
        <div className="px-6 py-8 text-center">
          <Info className="mx-auto h-8 w-8 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No logs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            No log entries match the selected filter.
          </p>
        </div>
      )}
      
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-center">
          <button className="text-sm text-primary-600 hover:text-primary-500 font-medium">
            Load more logs
          </button>
        </div>
      </div>
    </div>
  );
}