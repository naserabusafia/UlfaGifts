import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { routesConfig } from '../../routes';
import { ProtectedRoute } from '../../components/ProtectedRoute';

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {routesConfig.map((route) => {
        // Wrap routes that require specific roles with the ProtectedRoute component
        if (route.roles && route.roles.length > 0) {
          return (
            <Route
              key={route.path}
              path={route.path}
              element={<ProtectedRoute roles={route.roles}>{route.element}</ProtectedRoute>}
            />
          );
        }

        // Render public / unprotected route
        return <Route key={route.path} path={route.path} element={route.element} />;
      })}
    </Routes>
  );
};

export default AppRouter;
