import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '@/api/apiClient';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText, Clock, AlertCircle, ArrowRight,
  GraduationCap, History, Shield, Key, ShieldCheck,
  RefreshCw, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipBox } from '@/components/ui/tooltip';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose
} from '@/components/ui/dialog';
import { STUDENT_CATEGORIES } from '@/lib/constants';
import { toUpperDisplay } from '@/lib/utils';

const formatSemesterLabel = (label) => {
  if (!label) return '';
  const match = label.match(/AY\s+(\d{4})-(\d{4})\s+(.+)/);
  if (match) return `${match[3]} ${match[1]}-${match[2]}`;
  return label;
};

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role === 'admin') navigate('/admin', { replace: true });
  }, [user, navigate]);

  const [profile, setProfile] = useState(null);
  const [activeSemester, setActiveSemester] = useState(null);
  const [semesters, setSemesters] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changeCatOpen, setChangeCatOpen] = useState(false);
  const [changeStep, setChangeStep] = useState('confirm');
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState('');

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const getSemesterLabel = (id) => {
    const sem = semesters.find(s => s.id === id);
    if (sem) return formatSemesterLabel(sem.label);
    return formatSemesterLabel(activeSemester?.label) || 'Semester';
  };

  const loadData = async () => {
    try {
      const [semRes, semsRes, subRes, profRes, activeSubRes] = await Promise.all([
        apiClient.get('/forms/semesters/active'),
        apiClient.get('/forms/semesters'),
        apiClient.get('/students/history'),
        apiClient.get('/auth/profile'),
        apiClient.get('/students/active-submission').catch(() => null),
      ]);
      setActiveSemester(semRes.data);
      setSemesters(semsRes.data || []);
      setSubmissions(subRes.data || []);
      setProfile(profRes.data);
      setActiveSubmission(activeSubRes?.data || null);
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-border rounded-xl p-5 space-y-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const currentSub = activeSubmission || (activeSemester
    ? submissions.find(s => s.semester_id === activeSemester.id)
    : null);

  const isVerified = currentSub?.status === 'verified';
  const semLabel = formatSemesterLabel(activeSemester?.label);

  const verifiedSubs = submissions.filter(
    s => s.status === 'verified'
  );
  const verifiedCount = verifiedSubs.length;

  const getStatusInfo = () => {
    if (!activeSemester) return {
      icon: AlertCircle,
      color: 'text-muted-foreground',
      bg: 'bg-muted/60',
      label: 'No Active Semester',
      desc: 'The profiling period is currently closed.',
      border: 'border-border',
    };
    if (isVerified) return null;
    if (currentSub?.status === 'returned') return {
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      label: 'Returned for Correction',
      desc: currentSub.admin_comment || 'Please review and correct your form.',
      border: 'border-amber-300',
      semester: semLabel,
      refCode: toUpperDisplay(currentSub.verification_code),
      isReturned: true,
    };
    if (currentSub?.status === 'declined') return {
      icon: AlertCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      label: 'Submission Declined',
      desc: currentSub.admin_comment || 'Your submission has been declined.',
      border: 'border-red-300',
      semester: semLabel,
    };
    if (currentSub?.is_final) return {
      icon: Clock,
      color: 'text-brand-blue',
      bg: 'bg-blue-50',
      label: 'Submitted — Pending Verification',
      desc: `Reference: ${toUpperDisplay(currentSub.verification_code)}`,
      border: 'border-blue-200',
      semester: semLabel,
      refCode: toUpperDisplay(currentSub.verification_code),
    };
    if (currentSub) return {
      icon: Clock,
      color: 'text-amber-500',
      bg: 'bg-amber-50',
      label: 'Draft Saved',
      desc: 'Continue filling out your form.',
      border: 'border-amber-200',
      semester: semLabel,
    };
    return {
      icon: FileText,
      color: 'text-brand-blue',
      bg: 'bg-blue-50',
      label: 'Ready to Fill',
      desc: 'Start your profiling form now.',
      border: 'border-blue-200',
      semester: semLabel,
    };
  };

  const hasAnySubmission = submissions.length > 0;

  const handleChangeCategory = async (newCategory) => {
    setChanging(true);
    setChangeError('');
    try {
      await apiClient.post('/auth/category', { category: newCategory });
      const profRes = await apiClient.get('/auth/profile');
      setProfile(profRes.data);
      setChangeCatOpen(false);
      setChangeStep('confirm');
    } catch (err) {
      setChangeError(err.response?.data?.detail || 'Failed to change category.');
    } finally {
      setChanging(false);
    }
  };

  const status = getStatusInfo();

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn}>
        <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
          Welcome, {profile?.first_name || user?.first_name || profile?.email || user?.email || 'Student'}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          NEMSU Tagbina Campus —{' '}
          <span className="text-brand-blue font-medium">
            Office of the Student Welfare and Development
          </span>
        </p>
      </motion.div>

      {profile?.category && (
        <div className="flex items-center justify-between gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Student Category:</span>
            <span className="text-sm font-semibold">{toUpperDisplay(profile.category)}</span>
          </div>
          <Dialog open={changeCatOpen} onOpenChange={(open) => { setChangeCatOpen(open); if (!open) { setChangeStep('confirm'); setChangeError(''); } }}>
            <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" />}>
              <RefreshCw className="w-3.5 h-3.5" /> Change
            </DialogTrigger>
            <DialogContent>
              {changeStep === 'confirm' ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Change Student Category?</DialogTitle>
                    <DialogDescription>
                      You are about to change your category from <strong>{toUpperDisplay(profile.category)}</strong>.
                      This action can only be undone if you have not yet started the profiling form.
                    </DialogDescription>
                  </DialogHeader>
                  {changeError && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{changeError}</div>
                  )}
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                    <Button onClick={() => setChangeStep('pick')}>Continue</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Select New Category</DialogTitle>
                    <DialogDescription>Choose your correct student category.</DialogDescription>
                  </DialogHeader>
                  {changeError && (
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{changeError}</div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
                    {STUDENT_CATEGORIES.map(cat => (
                      <button
                        key={cat.value}
                        onClick={() => handleChangeCategory(cat.value)}
                        disabled={changing || cat.value === profile.category}
                        className={`flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 text-center transition-all
                          ${cat.value === profile.category
                            ? 'border-brand-blue/30 bg-brand-blue/5 opacity-50 cursor-not-allowed'
                            : 'border-border hover:border-brand-blue/50 hover:bg-brand-blue/5 cursor-pointer'
                          }`}
                      >
                        <span className="text-sm font-semibold">{cat.label}</span>
                        <span className="text-[10px] text-muted-foreground leading-tight">{cat.description}</span>
                        {cat.value === profile.category && (
                          <span className="text-[10px] text-muted-foreground">Current</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setChangeStep('confirm'); setChangeError(''); }} disabled={changing}>
                      Back
                    </Button>
                    {changing && (
                      <Button disabled>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
                      </Button>
                    )}
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isVerified ? (
        <Card className="border border-emerald-200 shadow-sm rounded-2xl bg-emerald-50 overflow-hidden">
          <div className="p-5 space-y-4">

            <div className="flex gap-4">
              <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-heading font-bold text-lg text-emerald-700">
                  Profile Verified <span className="text-emerald-600 font-bold">&#10003;</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Your profile has been verified by the OSWD office. Reference: {toUpperDisplay(currentSub?.verification_code)}
                </p>
                <div className="inline-flex items-center gap-2 bg-white/70 border border-gray-200 rounded-lg px-2 py-0.5 mt-2">
                  <GraduationCap className="w-3.5 h-3.5 text-[#566581]" />
                  <span className="text-xs text-[#566581]" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' }}>{semLabel || 'No active semester'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-0">
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Reference Code</p>
                  <p className="font-mono font-bold text-lg text-emerald-700 tracking-widest mt-0.5 break-all">{toUpperDisplay(currentSub?.verification_code)}</p>
                </div>
                <div className="flex-1 sm:text-right">
                  <p className="text-xs text-muted-foreground">Verified on</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">
                    {currentSub?.submitted_at
                      ? new Date(currentSub.submitted_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </Card>
      ) : status ? (
        <Card className={`border ${status.border} shadow-sm overflow-hidden`}>
          <div className={`${status.bg} p-5 sm:p-7`}>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/70 flex items-center justify-center shadow-sm flex-shrink-0">
                {React.createElement(status.icon, { className: `w-6 h-6 ${status.color}` })}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={`font-heading font-bold text-xl ${status.color}`}>{status.label}</h2>
                <p className="text-sm text-muted-foreground mt-1 break-words">{status.desc}</p>
                {status.isReturned && currentSub?.admin_comment && (
                  <div className="mt-2 p-3 bg-white/70 border border-amber-200 rounded-lg">
                    <p className="text-xs font-medium text-amber-700">Admin Feedback:</p>
                    <p className="text-sm text-amber-800 mt-0.5">{currentSub.admin_comment}</p>
                  </div>
                )}
                {status.semester && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 flex-shrink-0" />
                    {status.semester}
                  </p>
                )}
              </div>
              {activeSemester && (status.isReturned) && (
                <Link to="/profile-form" className="w-full sm:w-auto flex-shrink-0">
                  <Button className="gap-2 whitespace-nowrap w-full sm:w-auto">
                    Re-edit Form <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              {activeSemester && !status.isReturned && !currentSub?.is_final && (
                <Link to="/profile-form" className="w-full sm:w-auto flex-shrink-0">
                  <Button className="gap-2 whitespace-nowrap w-full sm:w-auto">
                    {currentSub ? 'Continue' : 'Start Form'} <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
            {status.refCode && (
              <div className="mt-5 pt-5 border-t border-white/60">
                <p className="text-xs text-muted-foreground">Reference Code</p>
                <p className="text-lg font-bold font-mono text-brand-blue tracking-wide mt-0.5">{status.refCode}</p>
              </div>
            )}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/profile-form">
          <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full border-border">
            <CardContent className="p-4 sm:p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-brand-blue" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Profiling Form</h3>
                <p className="text-xs text-muted-foreground">Fill or continue</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/submissions">
          <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full border-border">
            <CardContent className="p-4 sm:p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <History className="w-5 h-5 text-[#0F172A]" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Submission History</h3>
                <p className="text-xs text-muted-foreground">Past semesters</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card className="h-full border-border">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">
                {verifiedCount} Submission{verifiedCount !== 1 ? 's' : ''}
              </h3>
              <p className="text-xs text-muted-foreground">{verifiedCount} verified across all semesters</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {submissions.length > 0 && (
        <Card className="border-border shadow-sm">
          <div className="px-4 sm:px-5 py-4 flex items-center justify-between border-b border-border">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-heading font-semibold text-sm">Semester History</h2>
            </div>
            <Link to="/submissions" className="text-xs text-brand-blue hover:underline font-medium">View all →</Link>
          </div>
          <div className="space-y-2 p-4 sm:p-5">
            {submissions.slice(0, 5).map(sub => (
              <div key={sub.id} className="px-4 py-3 flex items-center justify-between gap-4 bg-gray-100 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  {sub.status === 'verified'
                    ? <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    : <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  }
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{getSemesterLabel(sub.semester_id)}</p>
                    <p className="text-xs text-muted-foreground">{toUpperDisplay(profile?.category) || 'Student'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {sub.verification_code && (
                    <span className="text-xs font-mono text-muted-foreground border border-gray-400 px-1.5 py-0.5 rounded hidden sm:inline">{toUpperDisplay(sub.verification_code)}</span>
                  )}
                  {sub.status === 'verified' && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <Shield className="w-3 h-3" /> Verified
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </motion.div>
    </AnimatedPage>
  );
}
