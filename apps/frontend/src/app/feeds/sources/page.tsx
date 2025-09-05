import { FeedSourcesList } from '@/components/feeds/feed-sources-list';
import { CreateFeedSourceButton } from '@/components/feeds/create-feed-source-button';
import { BulkFeedUploadButton } from '@/components/feeds/bulk-feed-upload-button';

export default function FeedSourcesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Feed Sources</h1>
        <div className="flex items-center space-x-3">
          <BulkFeedUploadButton />
          <CreateFeedSourceButton />
        </div>
      </div>
      
      <FeedSourcesList />
    </div>
  );
}