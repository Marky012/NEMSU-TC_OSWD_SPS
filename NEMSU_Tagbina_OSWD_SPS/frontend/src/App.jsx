import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Home from '@/pages/Home';
import ProfileForm from '@/pages/ProfileForm';
import Submissions from '@/pages/Submissions';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import AppLayout from '@/components/layout/AppLayout';

// Admin pages
import AdminDashboard from '@/pages/admin/AdminDashboard';
import QuestionEditor from '@/pages/admin/QuestionEditor';
import SemesterManagement from '@/pages/admin/SemesterManagement';
import StudentList from '@/pages/admin/StudentList';
import Analytics from '@/pages/admin/Analytics';
import CHEDReports from '@/pages/admin/CHEDReports';
import AuditLog from '@/pages/admin/AuditLog';

function AppRoutes() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes with layout */}
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Home />} />
        <Route path="/profile-form" element={<ProfileForm />} />
        <Route path="/submissions" element={<Submissions />} />
      </Route>

      {/* Admin routes */}
      <Route element={<ProtectedRoute adminOnly={true}><AppLayout /></ProtectedRoute>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/questions" element={<QuestionEditor />} />
        <Route path="/admin/semesters" element={<SemesterManagement />} />
        <Route path="/admin/students" element={<StudentList />} />
        <Route path="/admin/analytics" element={<Analytics />} />
        <Route path="/admin/reports" element={<CHEDReports />} />
        <Route path="/admin/logs" element={<AuditLog />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;