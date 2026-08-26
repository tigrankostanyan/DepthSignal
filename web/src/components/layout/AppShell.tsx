import React from 'react';
import { Sidebar } from './Sidebar.js';
import { TopBar } from './TopBar.js';

interface AppShellProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function AppShell({ children, currentPath, onNavigate }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen bg-[#0B0E11] text-[#EAECEF] overflow-hidden">
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0B0E11]">
          {children}
        </main>
      </div>
    </div>
  );
}
