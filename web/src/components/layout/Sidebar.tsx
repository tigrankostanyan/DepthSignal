import React from 'react';
import { 
  BarChart3, 
  Layers, 
  Bell, 
  Bookmark, 
  History, 
  ShieldAlert, 
  CreditCard, 
  Settings, 
  ShieldCheck, 
  LogOut 
} from 'lucide-react';
import { useApp } from '../../providers/AppProviders.js';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Sidebar({ currentPath, onNavigate }: SidebarProps) {
  const { user } = useApp();

  const navigation = [
    { name: 'Screener', path: '/screener', icon: BarChart3 },
    { name: 'Walls & Depth', path: '/walls', icon: Layers },
    { name: 'Alerts', path: '/alerts', icon: Bell },
    { name: 'Watchlists', path: '/watchlists', icon: Bookmark },
    { name: 'History', path: '/history', icon: History },
    { name: 'Blacklist', path: '/blacklist', icon: ShieldAlert },
    { name: 'Billing', path: '/billing', icon: CreditCard },
    { name: 'Settings', path: '/settings', icon: Settings },
    ...(user?.role === 'ADMIN' ? [{ name: 'Admin', path: '/admin', icon: ShieldCheck }] : [])
  ];

  return (
    <aside className="w-60 bg-[#121418] border-r border-[#2B2F36] flex flex-col justify-between h-screen select-none">
      <div>
        <div className="h-14 flex items-center px-4 border-b border-[#2B2F36] space-x-2">
          <div className="w-7 h-7 bg-[#F0B90B] rounded flex items-center justify-center font-black text-black text-sm">
            QS
          </div>
          <span className="font-bold text-white text-base tracking-wide">QuantScreen</span>
        </div>

        <nav className="p-2 space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = currentPath === item.path;
            return (
              <button
                key={item.path}
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                  active
                    ? 'bg-[#F0B90B]/15 text-[#F0B90B]'
                    : 'text-[#848E9C] hover:bg-[#181A20] hover:text-white'
                }`}
              >
                <Icon size={16} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-3 border-t border-[#2B2F36]">
        <div className="flex items-center justify-between text-xs text-[#848E9C]">
          <span className="truncate">{user?.email || 'Guest'}</span>
          <span className="px-1.5 py-0.5 bg-[#2B2F36] text-[#F0B90B] rounded text-[10px] font-mono">
            {user?.tier || 'FREE'}
          </span>
        </div>
      </div>
    </aside>
  );
}
