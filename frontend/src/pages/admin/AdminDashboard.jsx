import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { TooltipBox } from '@/components/ui/tooltip';
import { FileText, AlertTriangle, CheckCircle2, Clock, GraduationCap, RefreshCw, ToggleLeft, ToggleRight, Megaphone, Plus, Trash2, Pin, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';

const COLORS = ['hsl(224, 76%, 48%)', 'hsl(42,87%,52%)', 'hsl(200,60%,45%)', 'hsl(280,50%,55%)', 'hsl(20,80%,55%)', 'hsl(340,60%,50%)'];
const CATEGORY_COLORS = {
  New: 'hsl(224, 76%, 48%)',
  Returnee: 'hsl(42, 87%, 52%)',
  Transferee: 'hsl(200, 60%, 45%)',
  Continuing: 'hsl(280, 50%, 55%)',
};
const PROGRAM_ABBR = {
  'Bachelor of Secondary Education': 'BSED',
  'Bachelor of Science in Business Administration major in Human Resource Management': 'BSBA-HRM',
  'Bachelor of Science in Agriculture': 'BSA',
  'Bachelor of Science in Business Administration major in Financial Management': 'BSBA-FM',
  'Bachelor of Elementary Education': 'BEED',
  'Bachelor of Science in Computer Science': 'BSCS',
  'Bachelor of Agriculture Technology': 'BAT',
  'Bachelor of Science in Hospitality Management': 'BSHM',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [activeSemester, setActiveSemester] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState(true);
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [announcements, setAnnouncements] = useState([]);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [newAnnounceMsg, setNewAnnounceMsg] = useState('');
  const [newAnnouncePinned, setNewAnnouncePinned] = useState(false);
  const [creatingAnnounce, setCreatingAnnounce] = useState(false);

  const loadStats = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [{ data }, semRes, statusRes] = await Promise.all([
        apiClient.get('/reports/dashboard-stats'),
        apiClient.get('/admin/semesters'),
        apiClient.get('/admin/submissions-status'),
      ]);
      const active = semRes.data.find(s => s.is_active);
      if (active) setActiveSemester(active.label);
      setAccepting(statusRes.data.accepting_submissions);
      const catData = Object.entries(data.charts?.categories || {})
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          fill: CATEGORY_COLORS[name] || 'hsl(224, 76%, 48%)',
        }));
      const programCounts = data.charts?.programs || {};
      const programData = Object.keys(PROGRAM_ABBR).map(name => ({
        name: PROGRAM_ABBR[name],
        fullName: name,
        value: programCounts[name] || 0,
      }));
      setStats({
        totalSubmissions: data.summary?.total_submissions || 0,
        totalDrafts: data.summary?.total_drafts || 0,
        totalStudents: data.summary?.total_registered_students || 0,
        totalVerified: data.summary?.total_verified_students || 0,
        pendingPWD: data.summary?.pending_pwd_tasks || 0,
        categoryData: catData,
        programData: programData,
      });
      if (!silent) toast.success('Dashboard data refreshed to latest');
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const toggleSubmissions = async () => {
    setToggleConfirmOpen(false);
    try {
      const res = await apiClient.post('/admin/toggle-submissions');
      setAccepting(res.data.accepting_submissions);
      toast.success(res.data.accepting_submissions ? 'Submissions are now open' : 'Submissions are now closed');
    } catch (e) {
      const msg = e.response?.data?.detail || 'Failed to toggle submissions';
      toast.error(msg);
    }
  };

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/admin/announcements');
      setAnnouncements(data);
    } catch {}
  }, []);

  const handleCreateAnnounce = async () => {
    if (!newAnnounceMsg.trim()) return;
    setCreatingAnnounce(true);
    try {
      await apiClient.post('/admin/announcements', { message: newAnnounceMsg.trim(), is_pinned: newAnnouncePinned });
      setNewAnnounceMsg('');
      setNewAnnouncePinned(false);
      await loadAnnouncements();
      toast.success('Announcement created');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create announcement');
    }
    setCreatingAnnounce(false);
  };

  const handleDeleteAnnounce = async (id) => {
    try {
      await apiClient.delete(`/admin/announcements/${id}`);
      await loadAnnouncements();
      toast.success('Announcement deleted');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete');
    }
  };

  useEffect(() => {
    loadStats(true);
    loadAnnouncements();
    const interval = setInterval(() => loadStats(true), 60000);
    return () => clearInterval(interval);
  }, [loadStats, loadAnnouncements]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-border rounded-xl p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[350px] w-full rounded-xl" />
          <Skeleton className="h-[350px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Submissions', value: stats?.totalSubmissions || 0, icon: FileText, color: 'text-brand-blue' },
    { label: 'Drafts', value: stats?.totalDrafts || 0, icon: Clock, color: 'text-secondary' },
    { label: 'Verified Students', value: stats?.totalVerified || 0, icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'PWD Follow-ups', value: stats?.pendingPWD || 0, icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn} className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold">OSWD-TG Admin Dashboard</h1>
          {activeSemester && (
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4" />
              {activeSemester}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TooltipBox label={accepting ? 'Submissions are open — click to close' : 'Submissions are closed — click to open'}>
            <button
              onClick={() => setToggleConfirmOpen(true)}
              className={`h-9 px-3 text-sm rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${accepting ? 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'}`}
            >
              {accepting ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              {accepting ? 'Submissions Open' : 'Submissions Closed'}
            </button>
          </TooltipBox>
          <TooltipBox label="Refresh dashboard data">
            <Button variant="outline" size="sm" onClick={() => loadStats()} disabled={refreshing} className="gap-1.5 rounded-full">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </TooltipBox>
        </div>
      </motion.div>

      <motion.div variants={fadeIn} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {refreshing ? Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 sm:p-5 space-y-3">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        )) : statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="hover-lift">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold font-heading">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={fadeIn} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {refreshing ? (
          <>
            <Skeleton className="h-[350px] w-full rounded-xl" />
            <Skeleton className="h-[350px] w-full rounded-xl" />
          </>
        ) : (
        <>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Submissions by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.categoryData?.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={stats.categoryData} cx="50%" cy="50%" outerRadius={100} dataKey="value" labelLine={false}>
                      {stats.categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Submissions by Program</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.programData?.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={stats.programData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, angle: -45, textAnchor: 'end' }} height={70} interval={0} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip labelFormatter={(label) => { const d = stats.programData.find(p => p.name === label); return d?.fullName || label; }} />
                    <Bar dataKey="value" fill="hsl(224, 76%, 48%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
        </>
        )}
      </motion.div>
    </motion.div>
      <ConfirmDialog
        open={toggleConfirmOpen}
        onOpenChange={setToggleConfirmOpen}
        onConfirm={toggleSubmissions}
        title={accepting ? 'Close Submissions?' : 'Open Submissions?'}
        description={accepting ? 'Students will not be able to submit their profiling forms until you re-open submissions.' : 'Students will be able to submit their profiling forms.'}
        confirmLabel={accepting ? 'Close Submissions' : 'Open Submissions'}
        variant={accepting ? 'destructive' : 'default'}
      />

      {/* Announcements Card */}
      <motion.div variants={fadeIn} className="mt-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Megaphone className="w-4 h-4" /> Announcements
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAnnounceModal(true)} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> Manage
            </Button>
          </CardHeader>
          <CardContent>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No announcements yet.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {announcements.slice(0, 3).map(a => (
                  <div key={a.id} className="text-sm p-2 bg-muted/30 rounded-lg border border-border/50">
                    {a.is_pinned && <Pin className="w-3 h-3 inline text-amber-500 mr-1" />}
                    {a.message}
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {a.admin_name || 'Admin'} &middot; {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
                {announcements.length > 3 && (
                  <p className="text-xs text-muted-foreground text-center">+{announcements.length - 3} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Announcements Modal */}
      <Dialog open={showAnnounceModal} onOpenChange={setShowAnnounceModal}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Manage Announcements</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <textarea
                value={newAnnounceMsg}
                onChange={e => setNewAnnounceMsg(e.target.value)}
                placeholder="Write your announcement..."
                className="w-full h-24 p-3 text-sm border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-1 focus:ring-[#EFAF1A]"
                maxLength={5000}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newAnnouncePinned} onChange={e => setNewAnnouncePinned(e.target.checked)} className="rounded" />
                  Pin this announcement
                </label>
                <Button size="sm" onClick={handleCreateAnnounce} disabled={!newAnnounceMsg.trim() || creatingAnnounce}>
                  {creatingAnnounce ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />}
                  Post
                </Button>
              </div>
            </div>
            <div className="border-t pt-3 space-y-2">
              {announcements.map(a => (
                <div key={a.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-muted/20 border border-border/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{a.is_pinned && <Pin className="w-3 h-3 inline text-amber-500 mr-1" />}{a.message}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <TooltipBox label="Delete announcement">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 shrink-0" onClick={() => handleDeleteAnnounce(a.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipBox>
                </div>
              ))}
              {announcements.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No announcements yet</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatedPage>
  );
}
