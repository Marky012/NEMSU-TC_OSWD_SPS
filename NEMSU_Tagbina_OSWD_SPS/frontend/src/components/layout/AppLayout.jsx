import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { 
  LayoutDashboard, FileText, Settings, Users, BarChart3, 
  LogOut, Menu, Shield, ClipboardCheck,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const ADMIN_ROLES = ['admin', 'super_admin', 'analytics_viewer', 'verification_officer'];

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  const handleLogout = async () => {
    await base44.auth.logout('/login');
  };

  const studentLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/profile-form', label: 'Profiling Form', icon: FileText },
    { to: '/submissions', label: 'My Submissions', icon: ClipboardCheck },
  ];

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/questions', label: 'Question Editor', icon: Settings },
    { to: '/admin/semesters', label: 'Semesters', icon: GraduationCap },
    { to: '/admin/students', label: 'Students', icon: Users },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/reports', label: 'CHED Reports', icon: FileText },
    { to: '/admin/logs', label: 'Audit Log', icon: Shield },
  ];

  const links = isAdmin ? adminLinks : studentLinks;

  const isActive = (path) => {
    if (path === '/' || path === '/admin') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-primary border-r border-white/10
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        flex flex-col
      `}>
        <div className="p-4 border-b border-white/10 bg-primary">
          <div className="flex items-center gap-3">
            <img
              src="https://media.base44.com/images/public/6a31e9ea3fbc9dcff9b2397f/f38dfcfa1_NEMSULOGO.jpg"
              alt="NEMSU Logo"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-white/30"
            />
            <div>
              <h1 className="font-heading font-bold text-sm text-white leading-tight">NEMSU Tagbina OWSD</h1>
              <p className="text-[10px] text-blue-200 leading-tight">Student Profiling System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${isActive(to)
                  ? 'bg-white/20 text-white shadow-sm'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }
              `}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs font-medium text-white truncate">{user?.full_name || user?.email}</p>
            <p className="text-[10px] text-blue-200 capitalize">{user?.role || 'student'}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-blue-200 hover:text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-30 bg-primary/95 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-white hover:bg-white/10">
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img
              src="/frontend/src/components/layouts/NEMSU LOGO.jpg"
              alt="NEMSU Logo"
              className="w-7 h-7 rounded-full object-cover"
            />
            <span className="font-heading font-bold text-sm text-white">NEMSU Tagbina OWSD</span>
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}