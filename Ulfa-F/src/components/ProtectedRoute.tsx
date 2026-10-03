import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth, type UserRole } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export interface ProtectedRouteProps {
  roles?: UserRole[];
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ roles, children }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  const location = useLocation();

  // 1. Session Restoration / Loading State
  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // 2. Authentication Check
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. Authorization Role Check
  if (roles && roles.length > 0) {
    const hasRole = roles.includes(user.role);
    if (!hasRole) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // If authenticated and authorized, render children or Outlet
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
