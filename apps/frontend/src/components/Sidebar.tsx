'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import {
  BarChart3,
  Globe,
  Rss,
  FileText,
  Languages,
  Activity,
  Database,
  Settings,
  Play,
  Mail,
  ChevronDown,
  ChevronRight,
  Home,
  Menu,
  X,
  Edit3,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
}

interface NavCategory {
  name: string;
  icon: React.ComponentType<any>;
  items: NavItem[];
}

const navigationCategories: NavCategory[] = [
  {
    name: 'Dashboard',
    icon: Home,
    items: [
      { name: 'Overview', href: '/', icon: BarChart3 },
    ],
  },
  {
    name: 'RSS Operations',
    icon: Rss,
    items: [
      { name: 'Feed Sources', href: '/feeds/sources', icon: Globe },
      { name: 'Feed Instances', href: '/feeds/instances', icon: Rss },
      { name: 'Polling', href: '/polling', icon: Play },
    ],
  },
  {
    name: 'Content Management',
    icon: FileText,
    items: [
      { name: 'Articles', href: '/articles', icon: FileText },
      { name: 'Newsletter', href: '/newsletter', icon: Mail },
      { name: 'Newsletter Editor', href: '/newsletter/editor', icon: Edit3 },
      { name: 'Translations', href: '/translations', icon: Languages },
    ],
  },
  {
    name: 'System Administration',
    icon: Settings,
    items: [
      { name: 'Health Monitor', href: '/health', icon: Activity },
      { name: 'Database', href: '/database', icon: Database },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Auto-expand categories that contain the current page
    const activeCategories = new Set<string>();
    navigationCategories.forEach(category => {
      category.items.forEach(item => {
        if (pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))) {
          activeCategories.add(category.name);
        }
      });
    });
    setExpandedCategories(activeCategories);
  }, [pathname]);

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName);
    } else {
      newExpanded.add(categoryName);
    }
    setExpandedCategories(newExpanded);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-md bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={clsx(
        "flex h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-64 flex-col fixed lg:relative z-40 transform transition-all duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <Link href="/" className="text-lg font-bold text-primary-600 dark:text-primary-400">
          GlobalNews Letter
        </Link>
        <ThemeToggle />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {navigationCategories.map((category) => {
          const CategoryIcon = category.icon;
          const isExpanded = expandedCategories.has(category.name);
          
          return (
            <div key={category.name} className="space-y-1">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.name)}
                className="flex items-center justify-between w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 transition-colors"
              >
                <div className="flex items-center">
                  <CategoryIcon className="mr-3 h-4 w-4" />
                  {category.name}
                </div>
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              {/* Category Items */}
              {isExpanded && (
                <div className="ml-6 space-y-1">
                  {category.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isClient && (pathname === item.href || 
                      (item.href !== '/' && pathname.startsWith(item.href)));
                    
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={clsx(
                          'flex items-center px-3 py-2 text-sm rounded-lg transition-colors',
                          isActive
                            ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-medium'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                        )}
                      >
                        <Icon className="mr-3 h-4 w-4" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Status Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <div className="h-2 w-2 rounded-full bg-green-500 dark:bg-green-400" />
          </div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">System Online</span>
        </div>
      </div>
      </div>
    </>
  );
}