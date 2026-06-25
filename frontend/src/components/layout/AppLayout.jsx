import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import NEMSULogo from './NEMSU LOGO.jpg';
import { 
  LayoutDashboard, FileText, Settings, Users, BarChart3, 
  LogOut, Menu, Shield, ClipboardCheck,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipBox } from '@/components/ui/tooltip';
import ConfirmDialog from '@/components/ConfirmDialog';

const ADMIN_ROLES = ['admin', 'analytics_viewer', 'verification_officer'];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const isAdmin = user && ADMIN_ROLES.includes(user.role);

  const handleLogout = () => {
    logout();
    navigate('/login');
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
        fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
        flex flex-col
      `}>
        <div className="p-4 border-b border-sidebar-border bg-sidebar-primary">
          <div className="flex items-center gap-3">
            <img
              src={NEMSULogo}
              alt="NEMSU Logo"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-white/30"
            />
            <div>
              <h1 className="font-heading font-bold text-sm text-sidebar-primary-foreground leading-tight">NEMSU Tagbina OSWD</h1>
              <p className="text-[10px] text-sidebar-foreground/60 leading-tight">Student Profiling System</p>
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
                flex items-center gap-3 px-3 py-[10px] text-sm font-medium transition-all rounded-lg
                ${isActive(to)
                  ? 'bg-white/20 mt-[4px] text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-white/20 hover:mt-[4px] hover:text-sidebar-accent-foreground'
                }
              `}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="mb-3">
            <p className="text-sm font-medium text-sidebar-primary-foreground truncate">{user?.username || user?.email}</p>
            <p className="text-[11px] text-sidebar-foreground/60 capitalize">{user?.role || 'student'}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLogout(true)}
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent rounded-lg"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-hidden">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-30 bg-sidebar backdrop-blur-md border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
          <TooltipBox label="Open sidebar menu">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="text-sidebar-primary-foreground hover:bg-sidebar-accent">
              <Menu className="w-5 h-5" />
            </Button>
          </TooltipBox>
          <div className="flex items-center gap-2">
            <TooltipBox label="NEMSU Tagbina Campus">
              <img
                src={NEMSULogo}
                alt="NEMSU Logo"
                className="w-7 h-7 rounded-full object-cover"
              />
            </TooltipBox>
            <span className="font-heading font-bold text-sm text-sidebar-primary-foreground">NEMSU Tagbina OSWD</span>
          </div>
          <div className="w-10" />
        </header>

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={showLogout}
        onOpenChange={setShowLogout}
        onConfirm={handleLogout}
        title="Sign Out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
      />
    </div>
  );
}