import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { Footer, Sidebar } from './components/layout';
import { AppProvider } from './app/providers/AppProvider';
import { AppRouter } from './app/routes/AppRouter';
import { useAuth } from './context/AuthContext';
import { FirstLoginPasswordModal } from './components/auth/FirstLoginPasswordModal';

const AppContent: React.FC = () => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const isAuthPage = location.pathname === '/login';
  const isNfcPage = /^\/(nfc|setup)\/[^/]+\/?$/.test(location.pathname);

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(nextLang);
  };

  if (isNfcPage) {
    return <AppRouter />;
  }

  // Dedicated Clean Layout for Login Page (No Sidebar, No Navbar Links)
  if (isAuthPage) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-200">
        {/* Minimalist Top Bar for Auth Page */}
        <header className="w-full border-b border-border/50 bg-background/50 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-foreground font-bold shadow-md shadow-primary/20">
                U
              </div>
              <span className="text-xl font-extrabold tracking-tight text-foreground">
                Ulfa Auth
              </span>
            </Link>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition shadow-xs"
              title="Switch Language"
            >
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span>{i18n.language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
          </div>
        </header>

        {/* Centered Auth Content */}
        <main className="flex flex-1 items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-md">
            <AppRouter />
          </div>
        </main>
      </div>
    );
  }

  // Application Layout: Sidebar is ONLY rendered for Authenticated Users
  const showSidebar = isAuthenticated && !!user;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-200">
      <div className="flex flex-1 flex-col md:flex-row">
        {showSidebar && <Sidebar />}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className={`mx-auto ${showSidebar ? 'max-w-5xl' : 'max-w-6xl'}`}>
            <AppRouter />
          </div>
        </main>
      </div>

      <Footer />

      {/* Global First Login Password Change Modal */}
      <FirstLoginPasswordModal />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
