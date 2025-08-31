'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { CreateFeedSourceDialog } from './create-feed-source-dialog';

export function CreateFeedSourceButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Feed Source
      </button>
      
      <CreateFeedSourceDialog 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
      />
    </>
  );
}