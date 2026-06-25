import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import { Toaster } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorBoundary from '@/components/ErrorBoundary';

const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const Home = lazy(() => import('@/pages/Home'));
const ProfileForm = lazy(() => import('@/pages/ProfileForm'));
const Submissions = lazy(() => import('@/pages/Submissions'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const QuestionEditor = lazy(() => import('@/pages/admin/QuestionEditor'));
const SemesterManagement = lazy(() => import('@/pages/admin/SemesterManagement'));
const StudentList = lazy(() => import('@/pages/admin/StudentList'));
const Analytics = lazy(() => import('@/pages/admin/Analytics'));
const CHEDReports = lazy(() => import('@/pages/admin/CHEDReports'));
const AuditLog = lazy(() => import('@/pages/admin/AuditLog'));

function PageLoader() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-border rounded-xl p-5 space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  return (
    <ErrorBoundary>
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public routes */}
        <Route path="/login" element={<Suspense fallback={<PageLoader />}><Login /></Suspense>} />
        <Route path="/register" element={<Suspense fallback={<PageLoader />}><Register /></Suspense>} />
        <Route path="/verify-email" element={<Suspense fallback={<PageLoader />}><VerifyEmail /></Suspense>} />
        <Route path="/forgot-password" element={<Suspense fallback={<PageLoader />}><ForgotPassword /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPassword /></Suspense>} />

        {/* Protected routes with layout */}
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/" element={<Suspense fallback={<PageLoader />}><Home /></Suspense>} />
          <Route path="/profile-form" element={<Suspense fallback={<PageLoader />}><ProfileForm /></Suspense>} />
          <Route path="/submissions" element={<Suspense fallback={<PageLoader />}><Submissions /></Suspense>} />
        </Route>

        {/* Admin routes */}
        <Route element={<ProtectedRoute adminOnly={true}><AppLayout /></ProtectedRoute>}>
          <Route path="/admin" element={<Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>} />
          <Route path="/admin/questions" element={<Suspense fallback={<PageLoader />}><QuestionEditor /></Suspense>} />
          <Route path="/admin/semesters" element={<Suspense fallback={<PageLoader />}><SemesterManagement /></Suspense>} />
          <Route path="/admin/students" element={<Suspense fallback={<PageLoader />}><StudentList /></Suspense>} />
          <Route path="/admin/analytics" element={<Suspense fallback={<PageLoader />}><Analytics /></Suspense>} />
          <Route path="/admin/reports" element={<Suspense fallback={<PageLoader />}><CHEDReports /></Suspense>} />
          <Route path="/admin/logs" element={<Suspense fallback={<PageLoader />}><AuditLog /></Suspense>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
