import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const HomePage: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();

  // Show spinner during session restoration
  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Checking authentication state...</p>
      </div>
    );
  }

  // If user is not logged in, redirect directly to /login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // If user is logged in, redirect directly to their role-based dashboard
  switch (user.role) {
    case 'SUPER_ADMIN':
    case 'admin':
      return <Navigate to="/super-admin/dashboard" replace />;
    case 'MERCHANT':
    case 'manager':
    case 'user':
    default:
      return <Navigate to="/merchant/dashboard" replace />;
  }
};

export default HomePage;
