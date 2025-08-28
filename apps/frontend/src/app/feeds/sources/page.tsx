import { FeedSourcesList } from '@/components/feeds/feed-sources-list';
import { CreateFeedSourceButton } from '@/components/feeds/create-feed-source-button';

export default function FeedSourcesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Feed Sources</h1>
        <CreateFeedSourceButton />
      </div>
      
      <FeedSourcesList />
    </div>
  );
}