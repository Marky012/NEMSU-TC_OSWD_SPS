import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !['admin', 'verification_officer', 'analytics_viewer'].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};