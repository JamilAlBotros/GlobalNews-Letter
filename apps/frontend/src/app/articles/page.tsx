import { ArticlesList } from '@/components/articles/articles-list';

export default function ArticlesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Articles</h1>
      </div>
      
      <ArticlesList />
    </div>
  );
}