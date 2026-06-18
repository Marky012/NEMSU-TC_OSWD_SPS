import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, FileText, GraduationCap, AlertTriangle, CheckCircle2, Clock, UserCheck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['hsl(246, 94%, 32%)', 'hsl(42,87%,52%)', 'hsl(200,60%,45%)', 'hsl(280,50%,55%)', 'hsl(20,80%,55%)', 'hsl(340,60%,50%)'];

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [submissions, semesters, pwdTasks, questions] = await Promise.all([
        base44.entities.Submission.list(),
        base44.entities.Semester.list(),
        base44.entities.PWDTask.list(),
        base44.entities.Question.list(),
      ]);

      const activeSem = semesters.find(s => s.is_active);
      const currentSubs = activeSem ? submissions.filter(s => s.semester_id === activeSem.id) : [];
      const finalSubs = currentSubs.filter(s => s.is_final);
      const draftSubs = currentSubs.filter(s => !s.is_final);
      const verifiedSubs = currentSubs.filter(s => s.is_verified);

      // Category breakdown
      const catCounts = {};
      finalSubs.forEach(s => {
        catCounts[s.student_category] = (catCounts[s.student_category] || 0) + 1;
      });
      const categoryData = Object.entries(catCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));

      setStats({
        total: submissions.length,
        currentTotal: currentSubs.length,
        finalCount: finalSubs.length,
        draftCount: draftSubs.length,
        verifiedCount: verifiedSubs.length,
        pendingPWD: pwdTasks.filter(t => t.status === 'pending').length,
        totalQuestions: questions.length,
        activeSemester: activeSem,
        categoryData,
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Submissions', value: stats?.finalCount || 0, icon: FileText, color: 'text-primary' },
    { label: 'Drafts', value: stats?.draftCount || 0, icon: Clock, color: 'text-secondary' },
    { label: 'Verified', value: stats?.verifiedCount || 0, icon: CheckCircle2, color: 'text-primary' },
    { label: 'PWD Follow-ups', value: stats?.pendingPWD || 0, icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold">OWSD Admin Dashboard</h1>
        {stats?.activeSemester && (
          <p className="text-muted-foreground mt-1 flex items-center gap-1">
            <GraduationCap className="w-4 h-4" /> {stats.activeSemester.label}
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold font-heading">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Submissions by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.categoryData?.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={stats.categoryData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                    {stats.categoryData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading">Submissions by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.categoryData?.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(145,63%,28%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}