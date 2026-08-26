import React, { useState } from 'react';
import { AppProviders } from '../providers/AppProviders.js';
import { AppShell } from '../components/layout/AppShell.js';
import ScreenerPage from './screener/page.js';
import WallsPage from './walls/page.js';
import AlertsPage from './alerts/page.js';
import SettingsPage from './settings/page.js';
import LoginPage from './login/page.js';

export default function RootLayout({ children }: { children?: React.ReactNode }) {
  const [currentPath, setCurrentPath] = useState('/screener');

  const renderContent = () => {
    switch (currentPath) {
      case '/screener':
        return <ScreenerPage />;
      case '/walls':
        return <WallsPage />;
      case '/alerts':
        return <AlertsPage />;
      case '/settings':
        return <SettingsPage />;
      case '/login':
        return <LoginPage onLoginSuccess={() => setCurrentPath('/screener')} />;
      default:
        return <ScreenerPage />;
    }
  };

  return (
    <AppProviders>
      <AppShell currentPath={currentPath} onNavigate={setCurrentPath}>
        {renderContent()}
      </AppShell>
    </AppProviders>
  );
}
