import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { FileText, AlertTriangle, CheckCircle2, Clock, GraduationCap, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['hsl(224, 76%, 48%)', 'hsl(42,87%,52%)', 'hsl(200,60%,45%)', 'hsl(280,50%,55%)', 'hsl(20,80%,55%)', 'hsl(340,60%,50%)'];
const CATEGORY_COLORS = {
  New: 'hsl(224, 76%, 48%)',
  Returning: 'hsl(42, 87%, 52%)',
  Transferee: 'hsl(200, 60%, 45%)',
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [activeSemester, setActiveSemester] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [{ data }, semRes] = await Promise.all([
        apiClient.get('/reports/dashboard-stats'),
        apiClient.get('/admin/semesters'),
      ]);
      const active = semRes.data.find(s => s.is_active);
      if (active) setActiveSemester(active.label);
      const catData = Object.entries(data.charts?.categories || {})
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
          fill: CATEGORY_COLORS[name] || 'hsl(224, 76%, 48%)',
        }));
      const programData = Object.entries(data.charts?.programs || {}).map(([name, value]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        value,
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
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadStats(true);
    const interval = setInterval(() => loadStats(true), 60000);
    return () => clearInterval(interval);
  }, [loadStats]);

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
        <Button variant="outline" size="sm" onClick={() => loadStats()} disabled={refreshing} className="gap-1.5 rounded-full">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
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
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
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
    </AnimatedPage>
  );
}
