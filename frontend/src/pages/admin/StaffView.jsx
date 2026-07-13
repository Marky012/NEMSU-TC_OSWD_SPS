import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import apiClient from '@/api/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TooltipBox } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, CheckCircle2, Shield, Eye, ArrowLeftFromLine, XCircle, Loader2, Users, RefreshCw } from 'lucide-react';
import { toUpperDisplay } from '@/lib/utils';
import StudentDetailSections from '@/components/StudentDetailSections';
import { YEAR_LEVELS } from '@/lib/constants';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function StaffView() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [mySlot, setMySlot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterCategory, setFilterCategory] = useState([]);
  const [filterYearLevel, setFilterYearLevel] = useState([]);
  const [viewSub, setViewSub] = useState(null);
  const [verifyOneId, setVerifyOneId] = useState(null);
  const [reviewSub, setReviewSub] = useState(null);
  const [reviewAction, setReviewAction] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [showReviewConfirm, setShowReviewConfirm] = useState(false);
  const [verifyConfirmSub, setVerifyConfirmSub] = useState(null);
  const [inlineReviewAction, setInlineReviewAction] = useState('');
  const [inlineReviewComment, setInlineReviewComment] = useState('');
  const [inlineReviewing, setInlineReviewing] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    const stored = localStorage.getItem('staff_slot');
    if (!stored) {
      window.location.href = '/admin/admins';
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setMySlot(parsed);
      loadSubmissions(parsed.slot_number);
    } catch {
      localStorage.removeItem('staff_slot');
      window.location.href = '/admin/admins';
    }
  }, []);

  useEffect(() => { setPage(1); }, [search, filterStatus, filterCategory, filterYearLevel]);

  const loadSubmissions = async (slot) => {
    setLoading(true);
    try {
      const [subRes, qRes] = await Promise.all([
        apiClient.get(`/admin/staff-submissions?slot=${slot}`),
        apiClient.get('/forms/questions'),
      ]);
      setSubmissions(subRes.data);
      setQuestions(qRes.data);
      toast.success('Submissions refreshed to latest');
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const refresh = () => {
    setPage(1);
    if (mySlot) loadSubmissions(mySlot.slot_number);
  };

  const getAnswerBySystemKey = (sub, systemKey) => {
    if (!sub.draft_data_json) return null;
    try {
      const data = JSON.parse(sub.draft_data_json);
      const q = questions.find(qq => qq.system_key === systemKey);
      if (q && data[q.id] !== undefined) return data[q.id];
    } catch {}
    return null;
  };

  const getStudentName = (sub) => {
    const fullName = getAnswerBySystemKey(sub, 'full_name');
    if (fullName && fullName.trim()) return toUpperDisplay(fullName);
    const first = getAnswerBySystemKey(sub, 'first_name') || '';
    const last = getAnswerBySystemKey(sub, 'surname') || '';
    if (first || last) return toUpperDisplay(`${last}, ${first}`.replace(/^, /, '').replace(/, $/, ''));
    return sub.student_email?.split('@')[0] || 'Student';
  };

  const getAnswerDisplay = (qId, data, question) => {
    const val = data[qId];
    if (!val) return 'N/A';
    const formatRow = item => typeof item === 'object' ? Object.values(item).filter(v => v && String(v).trim()).join(' — ') : String(item);
    if (Array.isArray(val)) {
      return val.map(formatRow).filter(r => r).join('; ');
    }
    if (typeof val === 'object') {
      return JSON.stringify(val);
    }
    if (typeof val === 'string' && val.startsWith('[')) {
      try { return JSON.parse(val).map(formatRow).filter(r => r).join('; '); } catch { return val; }
    }
    if (question?.system_key === 'estimated_household_income') {
      const cleaned = String(val).replace(/,/g, '');
      if (/^\d+(\.\d+)?$/.test(cleaned)) {
        return Number(cleaned).toLocaleString();
      }
    }
    return toUpperDisplay(String(val));
  };

  const getStudentProgram = (sub) => {
    return toUpperDisplay(getAnswerBySystemKey(sub, 'program')) || 'N/A';
  };

  const filtered = useMemo(() => {
    return submissions.filter(sub => {
      if (filterStatus.length > 0 && !filterStatus.includes(sub.status)) return false;
      if (filterCategory.length > 0 && !filterCategory.includes(sub.student_category)) return false;
      if (filterYearLevel.length > 0) {
        const yearLevel = getAnswerBySystemKey(sub, 'year_level');
        if (!filterYearLevel.includes(yearLevel)) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const name = getStudentName(sub).toLowerCase();
        const email = (sub.student_email || '').toLowerCase();
        const code = (sub.verification_code || '').toLowerCase();
        const cat = (sub.student_category || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !code.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, search, filterStatus, filterCategory, filterYearLevel]);

  const pendingCount = useMemo(() => submissions.filter(s => s.status === 'pending').length, [submissions]);
  const verifiedCount = useMemo(() => submissions.filter(s => s.status === 'verified').length, [submissions]);
  const declinedCount = useMemo(() => submissions.filter(s => s.status === 'declined').length, [submissions]);
  const returnedCount = useMemo(() => submissions.filter(s => s.status === 'returned').length, [submissions]);
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleVerify = async (sub) => {
    if (!mySlot) return;
    setVerifyOneId(sub.id);
    try {
      await apiClient.post(`/admin/staff-submissions/${sub.id}/verify?slot=${mySlot.slot_number}`);
      toast.success(`${getStudentName(sub)} verified`);
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Verification failed'); }
    setVerifyOneId(null);
  };

  const handleInlineReview = async () => {
    if (!viewSub || !inlineReviewAction || !mySlot) return;
    setInlineReviewing(true);
    try {
      await apiClient.post(`/admin/staff-submissions/${viewSub.id}/review?slot=${mySlot.slot_number}`, {
        status: inlineReviewAction,
        admin_comment: inlineReviewComment || null,
      });
      toast.success(`Submission ${inlineReviewAction === 'returned' ? 'returned' : 'declined'}`);
      setInlineReviewAction('');
      setInlineReviewComment('');
      setViewSub(null);
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Review failed'); }
    setInlineReviewing(false);
  };

  const handleReview = async () => {
    if (!reviewSub || !reviewAction || !mySlot) return;
    setReviewing(true);
    try {
      await apiClient.post(`/admin/staff-submissions/${reviewSub.id}/review?slot=${mySlot.slot_number}`, {
        status: reviewAction,
        admin_comment: reviewComment || null,
      });
      toast.success(`Submission ${reviewAction === 'returned' ? 'returned' : 'declined'}`);
      setReviewSub(null);
      setReviewAction('');
      setReviewComment('');
      refresh();
    } catch (e) { toast.error(e.response?.data?.detail || 'Review failed'); }
    setReviewing(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn} className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Staff View — Slot {mySlot?.slot_number}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mySlot?.full_name} ({mySlot?.email}) &mdash; {submissions.length} total assigned ({pendingCount} pending, {verifiedCount} verified, {declinedCount} declined, {returnedCount} returned)
          </p>
        </div>
        <TooltipBox label="Refresh data"><Button variant="outline" size="sm" onClick={refresh} className="rounded-lg">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button></TooltipBox>
      </motion.div>

      <motion.div variants={fadeIn} className="bg-white border border-border rounded-xl p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, email, or code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Category</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {['New', 'Transferee', 'Returnee', 'Continuing'].map(cat => {
                const active = filterCategory.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(prev => active ? prev.filter(c => c !== cat) : [...prev, cat])}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      active
                        ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                        : 'bg-white text-muted-foreground border-border hover:bg-muted/50 hover:border-muted-foreground/30'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Year Level</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {YEAR_LEVELS.map(year => {
                const active = filterYearLevel.includes(year);
                return (
                  <button
                    key={year}
                    onClick={() => setFilterYearLevel(prev => active ? prev.filter(y => y !== year) : [...prev, year])}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      active
                        ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                        : 'bg-white text-muted-foreground border-border hover:bg-muted/50 hover:border-muted-foreground/30'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Status</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'pending', label: 'Pending' },
                { key: 'verified', label: 'Verified' },
                { key: 'returned', label: 'Returned' },
                { key: 'declined', label: 'Declined' },
              ].map(({ key, label }) => {
                const active = filterStatus.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => setFilterStatus(prev => active ? prev.filter(s => s !== key) : [...prev, key])}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      active
                        ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                        : 'bg-white text-muted-foreground border-border hover:bg-muted/50 hover:border-muted-foreground/30'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium text-xs">Name</th>
                  <th className="p-3 text-left font-medium text-xs">Program</th>
                  <th className="p-3 text-left font-medium text-xs">Category</th>
                  <th className="p-3 text-left font-medium text-xs">Code</th>
                  <th className="p-3 text-left font-medium text-xs">Status</th>
                  <th className="p-3 text-left font-medium text-xs">Submitted</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(sub => (
                  <tr key={sub.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-medium">{getStudentName(sub)}</td>
                    <td className="p-3 text-xs">{getStudentProgram(sub)}</td>
                    <td className="p-3 text-xs">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{toUpperDisplay(sub.student_category)}</span>
                    </td>
                    <td className="p-3 font-mono text-xs">{toUpperDisplay(sub.verification_code)}</td>
                    <td className="p-3">
                      {sub.status === 'verified' ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1 w-fit"><CheckCircle2 className="w-3 h-3" /> Verified</span>
                      ) : sub.status === 'returned' ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1 w-fit"><ArrowLeftFromLine className="w-3 h-3" /> Returned</span>
                      ) : sub.status === 'declined' ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Declined</span>
                      ) : (
                        <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded-full">Pending</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : 'N/A'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {sub.status !== 'verified' && (
                          <>
                            <TooltipBox label="Verify this submission"><Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => setVerifyConfirmSub(sub)} disabled={verifyOneId === sub.id}>
                              {verifyOneId === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                            </Button></TooltipBox>
                            <TooltipBox label="Return to student for revision"><Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                              onClick={() => { setReviewSub(sub); setReviewAction('returned'); setReviewComment(''); }}>
                              <ArrowLeftFromLine className="w-3 h-3" />
                            </Button></TooltipBox>
                            <TooltipBox label="Decline this submission"><Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => { setReviewSub(sub); setReviewAction('declined'); setReviewComment(''); }}>
                              <XCircle className="w-3 h-3" />
                            </Button></TooltipBox>
                          </>
                        )}
                        <TooltipBox label="View submission details"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewSub(sub)}>
                          <Eye className="w-3 h-3" />
                        </Button></TooltipBox>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No submissions assigned to your slot
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {safePage} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <TooltipBox label="Go to first page"><Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={safePage <= 1}>First</Button></TooltipBox>
                <TooltipBox label="Go to previous page"><Button variant="outline" size="sm" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}>Prev</Button></TooltipBox>
                <TooltipBox label="Go to next page"><Button variant="outline" size="sm" onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}>Next</Button></TooltipBox>
                <TooltipBox label="Go to last page"><Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>Last</Button></TooltipBox>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* View details dialog */}
      <Dialog open={!!viewSub} onOpenChange={() => setViewSub(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Student Details</DialogTitle>
          </DialogHeader>
          {viewSub && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{getStudentName(viewSub)}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{viewSub.student_email}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Code</p>
                  <p className="font-mono font-medium">{viewSub.verification_code}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium">{toUpperDisplay(viewSub.status || 'pending')}</p>
                </div>
              </div>
              {viewSub.admin_comment && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <p className="text-xs font-medium text-amber-700">Admin Comment:</p>
                  <p className="text-sm text-amber-800 mt-1">{viewSub.admin_comment}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {viewSub.status !== 'verified' && mySlot && (
                  <TooltipBox label="Verify this submission">
                    <Button size="sm" className="rounded-lg" onClick={() => { handleVerify(viewSub); setViewSub(null); }}>
                      <Shield className="w-3.5 h-3.5 mr-1" /> Verify
                    </Button>
                  </TooltipBox>
                )}
                <TooltipBox label="Return for correction">
                  <Button size="sm" variant="outline" className="rounded-lg text-amber-600 border-amber-300 hover:bg-amber-50" onClick={() => { setInlineReviewAction(inlineReviewAction === 'returned' ? '' : 'returned'); setInlineReviewComment(''); }}>
                    <ArrowLeftFromLine className="w-3.5 h-3.5 mr-1" /> Return
                  </Button>
                </TooltipBox>
                <TooltipBox label="Decline permanently">
                  <Button size="sm" variant="outline" className="rounded-lg text-red-600 border-red-300 hover:bg-red-50" onClick={() => { setInlineReviewAction(inlineReviewAction === 'declined' ? '' : 'declined'); setInlineReviewComment(''); }}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Decline
                  </Button>
                </TooltipBox>
              </div>

              {inlineReviewAction && (
                <div className="p-3 border rounded-lg bg-muted/20 border-border space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {inlineReviewAction === 'returned' ? 'Return Reason (student will see this):' : 'Decline Reason (student will see this):'}
                  </p>
                  <Textarea
                    placeholder="Enter the reason for this action..."
                    value={inlineReviewComment}
                    onChange={(e) => setInlineReviewComment(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setInlineReviewAction(''); setInlineReviewComment(''); }}>Cancel</Button>
                    <Button
                      size="sm"
                      onClick={handleInlineReview}
                      disabled={inlineReviewing || !inlineReviewComment.trim()}
                      variant={inlineReviewAction === 'declined' ? 'destructive' : 'default'}
                    >
                      {inlineReviewing && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                      {inlineReviewAction === 'returned' ? 'Confirm Return' : 'Confirm Decline'}
                    </Button>
                  </div>
                </div>
              )}

              {viewSub.draft_data_json && (() => {
                const parsed = JSON.parse(viewSub.draft_data_json);
                return (
                  <StudentDetailSections
                    questions={questions}
                    parsed={parsed}
                    renderValue={(qId, val, q) => {
                      let displayVal = getAnswerDisplay(qId, parsed, q);
                      if (q.system_key === 'indigenous_peoples_group' && val === 'Others') {
                        const specifyQ = questions.find(qq => qq.system_key === 'indigenous_peoples_other_specify');
                        const specifyVal = specifyQ ? (parsed[specifyQ.id] ?? parsed[String(specifyQ.id)]) : null;
                        if (specifyVal) displayVal = toUpperDisplay(String(specifyVal));
                      }
                      return displayVal;
                    }}
                  />
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={!!reviewSub} onOpenChange={() => { setReviewSub(null); setReviewAction(''); setReviewComment(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {reviewAction === 'returned' ? 'Return for Correction' : 'Decline Submission'}
            </DialogTitle>
          </DialogHeader>
          {reviewSub && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {reviewAction === 'returned'
                  ? 'The student will be able to re-edit and resubmit their form.'
                  : 'The submission will be permanently declined and cannot be resubmitted.'}
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Comment / Reason</label>
                <Textarea
                  placeholder="Explain why the submission is being returned or declined..."
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={4}
                />
              </div>
              <DialogFooter className="gap-2">
                <TooltipBox label="Cancel review"><Button variant="outline" onClick={() => { setReviewSub(null); setReviewAction(''); setReviewComment(''); }}>Cancel</Button></TooltipBox>
                <TooltipBox label={reviewAction === 'returned' ? 'Confirm return' : 'Confirm decline'}><Button
                  variant={reviewAction === 'returned' ? 'default' : 'destructive'}
                  onClick={() => setShowReviewConfirm(true)}
                  disabled={reviewing || !reviewComment.trim()}
                >
                  {reviewing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {reviewAction === 'returned' ? 'Return' : 'Decline'}
                </Button></TooltipBox>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!verifyConfirmSub}
        onOpenChange={() => setVerifyConfirmSub(null)}
        onConfirm={() => { if (verifyConfirmSub) { const s = verifyConfirmSub; setVerifyConfirmSub(null); handleVerify(s); } }}
        title="Verify Student"
        description={verifyConfirmSub ? `Verify ${getStudentName(verifyConfirmSub)} for enrollment?` : ''}
        confirmLabel="Verify"
        loading={verifyOneId === verifyConfirmSub?.id}
      />

      <ConfirmDialog
        open={showReviewConfirm}
        onOpenChange={setShowReviewConfirm}
        onConfirm={() => { setShowReviewConfirm(false); handleReview(); }}
        title={reviewAction === 'returned' ? 'Return for Correction' : 'Decline Submission'}
        description={
          reviewAction === 'returned'
            ? `Return this submission to the student for correction${reviewComment ? ' with the provided comment' : ''}?`
            : `Decline this submission permanently${reviewComment ? ' with the provided comment' : ''}?`
        }
        confirmLabel={reviewAction === 'returned' ? 'Return' : 'Decline'}
        variant={reviewAction === 'declined' ? 'destructive' : 'default'}
        loading={reviewing}
      />
    </motion.div>
    </AnimatedPage>
  );
}