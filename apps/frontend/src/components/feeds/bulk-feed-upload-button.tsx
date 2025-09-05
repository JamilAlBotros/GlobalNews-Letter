'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { BulkFeedUploadDialog } from './bulk-feed-upload-dialog';

export function BulkFeedUploadButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <Upload className="h-4 w-4 mr-2" />
        Bulk Upload CSV
      </button>
      
      <BulkFeedUploadDialog 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}