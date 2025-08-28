'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Loader2,
  FileArchive,
  HardDrive
} from 'lucide-react';

export function DatabaseManagement() {
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: backups, isLoading, refetch } = useQuery({
    queryKey: ['database-backups'],
    queryFn: () => apiClient.getBackups(),
  });

  const createBackupMutation = useMutation({
    mutationFn: ({ compress }: { compress: boolean }) => 
      apiClient.createBackup({ compress }),
    onSuccess: () => {
      refetch();
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: (filename: string) => apiClient.restoreBackup(filename),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setSelectedBackup('');
    },
  });

  const wipeDatabaseMutation = useMutation({
    mutationFn: () => apiClient.wipeDatabase(),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setShowWipeConfirm(false);
    },
  });

  const backupsData = backups || [];

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - time.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Less than 1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  return (
    <div className="space-y-6">
      {/* Database Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Database Operations</h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Create Backup */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Download className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Create Backup</h4>
                  <p className="text-xs text-gray-500">Generate a database backup</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={() => createBackupMutation.mutate({ compress: false })}
                  disabled={createBackupMutation.isPending}
                  className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createBackupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Standard Backup
                </button>
                
                <button
                  onClick={() => createBackupMutation.mutate({ compress: true })}
                  disabled={createBackupMutation.isPending}
                  className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createBackupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileArchive className="h-4 w-4 mr-2" />
                  )}
                  Compressed Backup
                </button>
              </div>
            </div>

            {/* Restore Backup */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Upload className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Restore Backup</h4>
                  <p className="text-xs text-gray-500">Restore from a backup file</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <select
                  value={selectedBackup}
                  onChange={(e) => setSelectedBackup(e.target.value)}
                  className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:border-primary-500 focus:ring-primary-500"
                >
                  <option value="">Select a backup...</option>
                  {backupsData.map((backup) => (
                    <option key={backup.filename} value={backup.filename}>
                      {backup.filename}
                    </option>
                  ))}
                </select>
                
                <button
                  onClick={() => selectedBackup && restoreBackupMutation.mutate(selectedBackup)}
                  disabled={!selectedBackup || restoreBackupMutation.isPending}
                  className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {restoreBackupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Restore Selected
                </button>
              </div>
            </div>

            {/* Wipe Database */}
            <div className="border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Wipe Database</h4>
                  <p className="text-xs text-red-600">⚠️ This action cannot be undone</p>
                </div>
              </div>
              
              <button
                onClick={() => setShowWipeConfirm(true)}
                className="w-full inline-flex items-center justify-center px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Wipe All Data
              </button>
            </div>
          </div>

          {/* Operation Status */}
          {(createBackupMutation.error || restoreBackupMutation.error || wipeDatabaseMutation.error) && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">
                Operation failed: {
                  (createBackupMutation.error as Error)?.message ||
                  (restoreBackupMutation.error as Error)?.message ||
                  (wipeDatabaseMutation.error as Error)?.message
                }
              </p>
            </div>
          )}

          {(createBackupMutation.isSuccess || restoreBackupMutation.isSuccess || wipeDatabaseMutation.isSuccess) && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <p className="text-sm text-green-600">
                  {createBackupMutation.isSuccess && 'Backup created successfully!'}
                  {restoreBackupMutation.isSuccess && 'Database restored successfully!'}
                  {wipeDatabaseMutation.isSuccess && 'Database wiped successfully!'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Available Backups */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Available Backups</h3>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              {isLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {backupsData.map((backup) => (
            <div key={backup.filename} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center">
                      {backup.compressed ? (
                        <FileArchive className="h-4 w-4 text-gray-600" />
                      ) : (
                        <Database className="h-4 w-4 text-gray-600" />
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">
                      {backup.filename}
                    </h4>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="flex items-center space-x-1">
                        <HardDrive className="h-3 w-3" />
                        <span>{formatFileSize(backup.size)}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatRelativeTime(backup.created_at)}</span>
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        backup.type === 'automatic' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {backup.type}
                      </span>
                      {backup.compressed && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          compressed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {backupsData.length === 0 && (
          <div className="px-6 py-8 text-center">
            <Database className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No backups available</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create your first backup using the controls above.
            </p>
          </div>
        )}
      </div>

      {/* Wipe Confirmation Dialog */}
      {showWipeConfirm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Wipe Database
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                This will permanently delete all data including feeds, articles, and translations. 
                This action cannot be undone. Are you sure you want to continue?
              </p>
              
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => setShowWipeConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => wipeDatabaseMutation.mutate()}
                  disabled={wipeDatabaseMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {wipeDatabaseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Yes, Wipe Database
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}