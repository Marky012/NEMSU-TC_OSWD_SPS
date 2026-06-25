import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/api/apiClient';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton, ListSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TooltipBox } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, Check, Clock, Eye, FileText, Shield, ShieldCheck, GraduationCap, ArrowLeftFromLine, XCircle } from 'lucide-react';
import { toUpperDisplay } from '@/lib/utils';

const formatSemesterLabel = (label) => {
  if (!label) return '';
  const match = label.match(/AY\s+(\d{4})-(\d{4})\s+(.+)/);
  if (match) return `${match[3]} ${match[1]}-${match[2]}`;
  return label;
};

export default function Submissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewSub, setViewSub] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [subsRes, semsRes, profRes] = await Promise.all([
        apiClient.get('/students/history'),
        apiClient.get('/forms/semesters'),
        apiClient.get('/auth/profile'),
      ]);
      setSubmissions(subsRes.data || []);
      setSemesters(semsRes.data || []);
      setProfile(profRes.data);
    } catch (e) {
      console.error('Failed to load submissions:', e);
    }
    setLoading(false);
  };

  const getSemesterLabel = (id) => {
    const sem = semesters.find(s => s.id === id);
    return sem ? formatSemesterLabel(sem.label) : 'Unknown';
  };

  const getAnswerDisplay = (qId, data) => {
    const val = data?.[qId];
    if (!val) return 'N/A';
    if (Array.isArray(val)) {
      return val.map(item => typeof item === 'object' ? Object.values(item).join(' — ') : String(item)).join('; ');
    }
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    if (typeof val === 'string' && val.startsWith('[')) {
      try { return JSON.parse(val).map(item => typeof item === 'object' ? Object.values(item).join(' — ') : String(item)).join('; '); } catch { return val; }
    }
    return toUpperDisplay(String(val));
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-border rounded-xl p-4 space-y-2 text-center">
              <Skeleton className="h-8 w-16 mx-auto" />
              <Skeleton className="h-3 w-20 mx-auto" />
            </div>
          ))}
        </div>
        <ListSkeleton rows={4} />
      </div>
    );
  }

  const totalSubmitted = submissions.filter(s => s.is_final).length;
  const verifiedCount = submissions.filter(s => s.status === 'verified').length;
  const returnedCount = submissions.filter(s => s.status === 'returned').length;
  const declinedCount = submissions.filter(s => s.status === 'declined').length;
  const pendingCount = totalSubmitted - verifiedCount - returnedCount - declinedCount;

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn} className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-[#0F172A]">
            Submission History
          </h1>
          <p className="text-sm text-[#64748B] mt-1 mb-6">
            All your profiling form submissions across semesters
          </p>
        </div>
        <Link to="/profile-form" className="flex-shrink-0 mt-1">
          <Button className="gap-2 whitespace-nowrap bg-[#EDF2F9] text-[#102D60] hover:bg-[#EDF2F9]/80 border border-[#C5D4EB] rounded-md">
            <FileText className="w-4 h-4" />
            Go to form
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </motion.div>

      {submissions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-lg font-semibold">No Submissions Yet</h2>
            <p className="text-muted-foreground mt-1">You haven't submitted any profiling forms.</p>
          </CardContent>
        </Card>
      ) : (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 mt-6 mb-6">
            <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
              <CardContent className="p-4 text-center">
                <p className="font-bold text-2xl text-[#143A7B]">{totalSubmitted}</p>
                <p className="text-xs text-[#64748B] font-medium mt-1">Submitted</p>
              </CardContent>
            </Card>
            <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
              <CardContent className="p-4 text-center">
                <p className="font-bold text-2xl text-green-700">{verifiedCount}</p>
                <p className="text-xs text-[#64748B] font-medium mt-1">Verified</p>
              </CardContent>
            </Card>
            <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
              <CardContent className="p-4 text-center">
                <p className="font-bold text-2xl text-[#F59E0B]">{pendingCount}</p>
                <p className="text-xs text-[#64748B] font-medium mt-1">Pending</p>
              </CardContent>
            </Card>
            <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
              <CardContent className="p-4 text-center">
                <p className="font-bold text-2xl text-amber-600">{returnedCount}</p>
                <p className="text-xs text-[#64748B] font-medium mt-1">Returned</p>
              </CardContent>
            </Card>
            <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
              <CardContent className="p-4 text-center">
                <p className="font-bold text-2xl text-red-600">{declinedCount}</p>
                <p className="text-xs text-[#64748B] font-medium mt-1">Declined</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-sm font-semibold text-[#64748B] tracking-wider mb-3">
            SUBMITTED FORMS
          </p>
          <div className="space-y-4">
            {submissions.slice((page - 1) * pageSize, page * pageSize).map(sub => (
              <Card key={sub.id} className="bg-white border border-[#E2E8F0] border-t-[5px] border-t-emerald-500 shadow-sm rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0 self-center">
                        <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-base text-[#0F172A] truncate">
                          {getSemesterLabel(sub.semester_id)}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {profile?.category && (
                            <span className="text-xs font-medium text-[#64748B] bg-[#F1F5F9] px-2.5 py-0.5 rounded-full">
                              {toUpperDisplay(profile.category)}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {sub.status === 'verified' ? (
                            <>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full"> Verified
                              </span>
                              <span className="font-mono font-bold text-[#143A7B] tracking-widest text-xs bg-gray-100 px-2 py-1 rounded">
                                {toUpperDisplay(sub.verification_code)}
                              </span>
                              {sub.submitted_at && (
                                <span className="text-xs text-[#64748B]">
                                  Submitted {new Date(sub.submitted_at).toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric'
                                  })}
                                </span>
                              )}
                            </>
                          ) : sub.status === 'returned' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full">
                              <ArrowLeftFromLine className="w-3 h-3" /> Returned
                            </span>
                          ) : sub.status === 'declined' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3" /> Declined
                            </span>
                          ) : sub.is_final ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold bg-yellow-100 text-yellow-700 px-2.5 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          ) : null}
                        </div>

                        {sub.status === 'verified' && sub.submitted_at && (
                          <p className="mt-4 text-xs text-green-700">
                        <Check className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" />
                        Verified on {new Date(sub.submitted_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })} by <span className="underline decoration-dotted underline-offset-2">{user?.email || 'OSWD office'}</span>
                      </p>
                    )}
                      </div>
                    </div>
                    {sub.is_final && (
                      <TooltipBox label="View submission details">
                        <Button variant="link" size="sm" className="px-1.5 py-1 flex-shrink-0 self-center rounded hover:bg-[#EDF2F9] active:bg-[#EDF2F9]" onClick={() => setViewSub(sub)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TooltipBox>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {submissions.length > pageSize && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-xs text-muted-foreground">Page {page} of {Math.ceil(submissions.length / pageSize)}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page <= 1}>First</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>Prev</Button>
                {Array.from({ length: Math.min(5, Math.ceil(submissions.length / pageSize)) }, (_, i) => {
                  const total = Math.ceil(submissions.length / pageSize);
                  const start = Math.max(1, Math.min(page - 2, total - 4));
                  const p = start + i;
                  if (p > total) return null;
                  return <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" className="min-w-[32px]" onClick={() => setPage(p)}>{p}</Button>;
                })}
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(submissions.length / pageSize)}>Next</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(Math.ceil(submissions.length / pageSize))} disabled={page >= Math.ceil(submissions.length / pageSize)}>Last</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* View submission dialog */}
      <Dialog open={!!viewSub} onOpenChange={() => setViewSub(null)}>
        <DialogContent className="sm:max-w-4xl lg:max-w-5xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Submission Details</DialogTitle>
          </DialogHeader>
          {viewSub && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Semester</p>
                  <p className="font-medium">{getSemesterLabel(viewSub.semester_id)}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Reference Code</p>
                  <p className="font-mono font-medium">{toUpperDisplay(viewSub.verification_code)}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium">{toUpperDisplay(profile?.category) || 'Student'}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Submitted</p>
                  <p className="font-medium">{viewSub.submitted_at ? new Date(viewSub.submitted_at).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
              {viewSub.admin_comment && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <p className="text-xs font-medium text-amber-700">Admin Feedback:</p>
                  <p className="text-sm text-amber-800 mt-1">{viewSub.admin_comment}</p>
                </div>
              )}
              {viewSub.draft_data && (
                <div className="border-t pt-4">
                  <h3 className="font-heading font-semibold mb-3">Answers</h3>
                  <div className="space-y-2">
                    {Object.entries(viewSub.draft_data).map(([qId, val]) => (
                      <div key={qId} className="flex flex-col sm:flex-row sm:items-start gap-1 py-2 border-b border-border/50 last:border-0">
                        <span className="text-xs font-medium text-muted-foreground sm:w-1/2 flex-shrink-0">
                          Question {qId}
                        </span>
                        <span className="text-sm">{getAnswerDisplay(qId, viewSub.draft_data)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
    </AnimatedPage>
  );
}