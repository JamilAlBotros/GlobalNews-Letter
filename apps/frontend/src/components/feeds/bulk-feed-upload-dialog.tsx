'use client';

import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  X, 
  Upload, 
  FileText, 
  Download, 
  CheckCircle, 
  AlertTriangle,
  Loader2,
  Info
} from 'lucide-react';

interface BulkUploadResult {
  message: string;
  summary: {
    total_processed: number;
    successful: number;
    failed: number;
  };
  errors: Array<{
    index: number;
    url: string;
    error: string;
  }>;
}

interface ParsedFeed {
  name: string;
  url: string;
  language: string;
  region: string;
  category: string;
  type: string;
  description?: string;
}

interface BulkFeedUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Language and category mappings from archive
const LANGUAGE_MAP: Record<string, string> = {
  'English': 'en',
  'Spanish': 'es', 
  'Arabic': 'ar',
  'Portuguese': 'pt',
  'French': 'fr',
  'Chinese': 'zh',
  'Japanese': 'ja'
};

const CATEGORY_MAP: Record<string, string> = {
  'News': 'general',
  'Technology': 'tech',
  'Finance': 'finance',
  'Business': 'finance',
  'Health': 'health',
  'Science': 'tech',
  'Sports': 'general',
  'Entertainment': 'general',
  'Politics': 'general',
  'Lifestyle': 'general',
  'Gaming': 'tech',
  'Crypto': 'finance',
  'Education': 'general',
  'Travel': 'general'
};

const TYPE_MAP: Record<string, string> = {
  'News': 'daily',
  'Analysis': 'analysis', 
  'Blog': 'daily',
  'Tutorial': 'daily',
  'Recipe': 'daily',
  'Review': 'daily',
  'Research': 'analysis'
};

export function BulkFeedUploadDialog({ isOpen, onClose }: BulkFeedUploadDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvData, setCsvData] = useState<string>('');
  const [parsedFeeds, setParsedFeeds] = useState<ParsedFeed[]>([]);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');

  const generateSourceName = (url: string): string => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.replace('www.', '');
      const parts = hostname.split('.');
      return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    } catch {
      return 'Unknown Source';
    }
  };

  const parseCsv = (content: string): ParsedFeed[] => {
    const lines = content.trim().split('\n');
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row');
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Map expected headers
    const urlIndex = headers.findIndex(h => h.includes('url') || h.includes('rss'));
    const languageIndex = headers.findIndex(h => h.includes('language'));
    const regionIndex = headers.findIndex(h => h.includes('region'));
    const categoryIndex = headers.findIndex(h => h.includes('category'));
    const typeIndex = headers.findIndex(h => h.includes('type'));
    const nameIndex = headers.findIndex(h => h.includes('name'));
    
    if (urlIndex === -1) {
      throw new Error('CSV must contain a URL column (e.g., "rss_url", "url")');
    }
    
    return lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, '')); // Remove quotes
      
      const url = values[urlIndex];
      if (!url) {
        throw new Error(`Row ${index + 2}: Missing URL`);
      }
      
      const language = values[languageIndex] || 'English';
      const category = values[categoryIndex] || 'News';
      const type = values[typeIndex] || 'News';
      const region = values[regionIndex] || '';
      const name = values[nameIndex] || generateSourceName(url);
      
      return {
        name,
        url,
        language: LANGUAGE_MAP[language] || 'en',
        region,
        category: CATEGORY_MAP[category] || 'general',
        type: TYPE_MAP[type] || 'daily'
      };
    });
  };

  const bulkCreateMutation = useMutation({
    mutationFn: async (feeds: ParsedFeed[]) => {
      const response = await fetch('http://localhost:3333/api/feeds/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feeds),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.detail || error.message || 'Failed to upload feeds');
      }
      
      return response.json() as Promise<BulkUploadResult>;
    },
    onSuccess: (data) => {
      setUploadResult(data);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Please select a CSV file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        setCsvData(content);
        const parsed = parseCsv(content);
        setParsedFeeds(parsed);
        setStep('preview');
      } catch (error) {
        alert(`Error parsing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = () => {
    bulkCreateMutation.mutate(parsedFeeds);
  };

  const handleClose = () => {
    setCsvData('');
    setParsedFeeds([]);
    setUploadResult(null);
    setStep('upload');
    onClose();
  };

  const downloadSampleCsv = () => {
    const sampleData = [
      'rss_url,source_language,primary_region,content_category,content_type,name',
      'https://feeds.bbci.co.uk/news/rss.xml,English,UK,News,News,BBC News',
      'https://rss.cnn.com/rss/edition.rss,English,US,News,News,CNN International',
      'https://feeds.reuters.com/reuters/topNews,English,Global,News,News,Reuters Top News'
    ].join('\n');
    
    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_rss_feeds.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Bulk RSS Feed Upload</h2>
              <p className="text-blue-100 text-sm">Upload multiple RSS feeds from CSV file</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-blue-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <div className="flex">
                  <Info className="h-5 w-5 text-blue-400 mt-0.5 mr-3" />
                  <div>
                    <h3 className="text-sm font-medium text-blue-900">CSV Format Requirements</h3>
                    <p className="mt-1 text-sm text-blue-700">
                      Your CSV file should include columns for: <code>rss_url</code>, <code>source_language</code>, 
                      <code>content_category</code>, <code>content_type</code>, and optionally <code>name</code> and <code>primary_region</code>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sample Download */}
              <div className="flex justify-center">
                <button
                  onClick={downloadSampleCsv}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors">
                <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload CSV File</h3>
                <p className="text-gray-600 mb-4">Select a CSV file containing your RSS feed data</p>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Upload className="h-5 w-5" />
                  <span>Choose CSV File</span>
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Preview ({parsedFeeds.length} feeds found)
                </h3>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setStep('upload')}
                    className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={bulkCreateMutation.isPending}
                    className="inline-flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkCreateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <span>{bulkCreateMutation.isPending ? 'Uploading...' : 'Upload Feeds'}</span>
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Language</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Region</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {parsedFeeds.slice(0, 10).map((feed, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{feed.name}</td>
                          <td className="px-4 py-3 text-sm text-blue-600 break-all">{feed.url}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{feed.language}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{feed.category}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{feed.type}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{feed.region || 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedFeeds.length > 10 && (
                  <div className="bg-gray-50 px-4 py-3 text-sm text-gray-500">
                    Showing first 10 feeds. Total: {parsedFeeds.length}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'result' && uploadResult && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Completed!</h3>
                <p className="text-gray-600">
                  {uploadResult.summary.successful} of {uploadResult.summary.total_processed} feeds uploaded successfully
                </p>
              </div>

              {/* Results Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{uploadResult.summary.successful}</div>
                  <div className="text-sm text-green-700">Successful</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{uploadResult.summary.failed}</div>
                  <div className="text-sm text-red-700">Failed</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{uploadResult.summary.total_processed}</div>
                  <div className="text-sm text-blue-700">Total</div>
                </div>
              </div>

              {/* Errors */}
              {uploadResult.errors.length > 0 && (
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-3">Errors</h4>
                  <div className="space-y-2">
                    {uploadResult.errors.map((error, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-red-900">Row {error.index + 1}</p>
                          <p className="text-sm text-red-700">{error.url}</p>
                          <p className="text-sm text-red-600">{error.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}