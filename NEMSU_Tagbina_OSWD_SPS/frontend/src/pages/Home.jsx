import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import { STUDENT_CATEGORIES } from '@/lib/constants';
import apiClient from '@/api/apiClient';
import { FileText, CheckCircle2, Clock, AlertCircle, ArrowRight, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [activeSemester, setActiveSemester] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Fetch active semester
      const semRes = await apiClient.get('/semesters/active');
      const sem = semRes.data;
      setActiveSemester(sem);

      // Fetch submissions for this user
      const subRes = await apiClient.get('/submissions', {
        params: { semesterId: sem?.id }
      });
      setSubmissions(subRes.data || []);

      // Fetch profile
      const profRes = await apiClient.get('/profile');
      setProfile(profRes.data);
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const currentSub = activeSemester
    ? submissions.find(s => s.semesterId === activeSemester.id)
    : null;

  const getStatusInfo = () => {
    if (!activeSemester) return { icon: AlertCircle, color: 'text-muted-foreground', bg: 'bg-muted', label: 'No active semester', desc: 'The profiling period is currently closed.' };
    if (currentSub?.isFinal) return { icon: CheckCircle2, color: 'text-primary', bg: 'bg-accent', label: 'Submitted', desc: `Ref: ${currentSub.verificationCode}` };
    if (currentSub) return { icon: Clock, color: 'text-secondary', bg: 'bg-secondary/10', label: 'Draft Saved', desc: 'Continue filling out your form.' };
    return { icon: FileText, color: 'text-primary', bg: 'bg-accent', label: 'Ready to Fill', desc: 'Start your profiling form now.' };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
          Welcome, {user?.email || 'Student'}
        </h1>
        <p className="text-muted-foreground mt-1">
          NEMSU Tagbina Campus — Office of Student Welfare and Development
        </p>
      </div>

      {/* Status Card */}
      <Card className="border-0 shadow-md overflow-hidden">
        <div className={`${status.bg} p-6`}>
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-xl bg-card flex items-center justify-center shadow-sm`}>
              <StatusIcon className={`w-6 h-6 ${status.color}`} />
            </div>
            <div className="flex-1">
              <h2 className="font-heading font-bold text-lg">{status.label}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{status.desc}</p>
              {activeSemester && (
                <p className="text-xs text-muted-foreground mt-2">
                  <GraduationCap className="w-3 h-3 inline mr-1" />
                  {activeSemester.label}
                </p>
              )}
            </div>
            {activeSemester && !currentSub?.isFinal && (
              <Link to="/profile-form">
                <Button className="gap-2">
                  {currentSub ? 'Continue' : 'Start Form'} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/profile-form">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Profiling Form</h3>
                <p className="text-xs text-muted-foreground">Fill out or continue your form</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/submissions">
          <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">My Submissions</h3>
                <p className="text-xs text-muted-foreground">View past submissions</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        {profile && (
          <Card className="h-full">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-sm capitalize">{profile.category || 'Student'}</h3>
                <p className="text-xs text-muted-foreground">{profile.program || 'No program set'}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}