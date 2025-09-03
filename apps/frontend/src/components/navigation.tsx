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
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: BarChart3 },
  { name: 'Feed Sources', href: '/feeds/sources', icon: Globe },
  { name: 'Feed Instances', href: '/feeds/instances', icon: Rss },
  { name: 'Articles', href: '/articles', icon: FileText },
  { name: 'Newsletter', href: '/newsletter', icon: Mail },
  { name: 'Polling', href: '/polling', icon: Play },
  { name: 'Translations', href: '/translations', icon: Languages },
  { name: 'Health Monitor', href: '/health', icon: Activity },
  { name: 'Database', href: '/database', icon: Database },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <div className="flex flex-shrink-0 items-center">
              <Link href="/" className="text-xl font-bold text-primary-600">
                GlobalNews Letter
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = isClient && (pathname === item.href || 
                  (item.href !== '/' && pathname.startsWith(item.href)));
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={clsx(
                      'inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium',
                      isActive
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
              <div className="h-2 w-2 rounded-full bg-green-500" />
            </div>
            <span className="ml-2 text-sm text-gray-600">System Online</span>
          </div>
        </div>
      </div>
    </nav>
  );
}