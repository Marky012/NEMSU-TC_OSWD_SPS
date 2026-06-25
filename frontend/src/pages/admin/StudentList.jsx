import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton, ListSkeleton, TableSkeleton } from '@/components/ui/skeleton';
import apiClient from '@/api/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TooltipBox } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Search, CheckCircle2, Shield, Eye, Download, Users, Loader2, ArrowLeftFromLine, XCircle, MessageCircle } from 'lucide-react';
import { toUpperDisplay } from '@/lib/utils';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function StudentList() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterSem, setFilterSem] = useState('');
  const [filterVerified, setFilterVerified] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewSub, setViewSub] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [savingSeg, setSavingSeg] = useState(false);
  const [verifyOneId, setVerifyOneId] = useState(null);
  const [reviewSub, setReviewSub] = useState(null);
  const [reviewAction, setReviewAction] = useState(''); // 'returned' | 'declined'
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [showReviewConfirm, setShowReviewConfirm] = useState(false);
  const [verifyConfirmSub, setVerifyConfirmSub] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  useEffect(() => { loadData(); }, []);
  useEffect(() => { setPage(1); }, [search, filterCat, filterSem, filterVerified]);

  const loadData = async () => {
    try {
      const [subs, sems, qs] = await Promise.all([
        apiClient.get('/admin/submissions'),
        apiClient.get('/admin/semesters'),
        apiClient.get('/forms/questions'),
      ]);
      setSubmissions(subs.data || []);
      setSemesters(sems.data || []);
      setQuestions(qs.data || []);
      const activeSem = (sems.data || []).find(s => s.is_active);
      if (activeSem) setFilterSem(activeSem.id);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getAnswerBySystemKey = (sub, systemKey) => {
    if (!sub.draft_data_json) return null;
    try {
      const data = JSON.parse(sub.draft_data_json);
      const q = questions.find(qq => qq.system_key === systemKey);
      if (q && data[q.id] !== undefined) return data[q.id];
    } catch { /* ignore */ }
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

  const getStudentProgram = (sub) => {
    return toUpperDisplay(getAnswerBySystemKey(sub, 'program')) || 'N/A';
  };

  const filtered = submissions.filter(sub => {
    if (filterSem && sub.semester_id !== Number(filterSem)) return false;
    if (filterCat !== 'all' && sub.student_category !== filterCat) return false;
    if (filterVerified === 'verified' && sub.status !== 'verified') return false;
    if (filterVerified === 'unverified' && sub.status === 'verified') return false;
    if (filterVerified === 'returned' && sub.status !== 'returned') return false;
    if (filterVerified === 'declined' && sub.status !== 'declined') return false;
    if (search) {
      const q = search.toLowerCase();
      const name = getStudentName(sub).toLowerCase();
      const email = (sub.student_email || '').toLowerCase();
      const code = (sub.verification_code || '').toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !code.includes(q)) return false;
    }
    return true;
  });

  const allCatSummary = {};
  const allProgSummary = {};
  submissions.forEach(sub => {
    const cat = sub.student_category || 'Unknown';
    allCatSummary[cat] = (allCatSummary[cat] || 0) + 1;
    const prog = getStudentProgram(sub);
    if (prog !== 'N/A') allProgSummary[prog] = (allProgSummary[prog] || 0) + 1;
  });

  const catSummary = {};
  const progSummary = {};
  filtered.forEach(sub => {
    const cat = sub.student_category || 'Unknown';
    catSummary[cat] = (catSummary[cat] || 0) + 1;
    const prog = getStudentProgram(sub);
    if (prog !== 'N/A') progSummary[prog] = (progSummary[prog] || 0) + 1;
  });
  const CATEGORIES = ['New', 'Transferee', 'Returnee', 'Continuing'];
  const CAT_COLORS = { New: 'bg-blue-500', Transferee: 'bg-amber-500', Returnee: 'bg-teal-500', Continuing: 'bg-purple-500' };

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleIndividualVerify = async (sub) => {
    setVerifyOneId(sub.id);
    try {
      await apiClient.post('/admin/verify-bulk', [sub.user_id]);
      toast.success(`${getStudentName(sub)} verified for enrollment`);
      loadData();
    } catch (e) {
      toast.error('Verification failed');
    }
    setVerifyOneId(null);
  };

  const handleBulkVerify = async () => {
    if (selectedIds.length === 0) return;
    setVerifying(true);
    try {
      const userIds = selectedIds.map(id => {
        const sub = submissions.find(s => s.id === id);
        return sub?.user_id;
      }).filter(Boolean);
      await apiClient.post('/admin/verify-bulk', userIds);
      setSelectedIds([]);
      toast.success(`${selectedIds.length} students verified for enrollment`);
      loadData();
    } catch (e) {
      toast.error('Verification failed');
    }
    setVerifying(false);
    setShowVerifyDialog(false);
  };

  const handleReview = async () => {
    if (!reviewSub || !reviewAction) return;
    setReviewing(true);
    try {
      await apiClient.post(`/admin/submissions/${reviewSub.id}/review`, {
        status: reviewAction,
        admin_comment: reviewComment || null,
      });
      toast.success(`Submission ${reviewAction === 'returned' ? 'returned' : 'declined'} successfully`);
      setReviewSub(null);
      setReviewAction('');
      setReviewComment('');
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Review failed');
    }
    setReviewing(false);
  };

  const toggleSEG = async (field) => {
    if (!viewSub || savingSeg) return;
    setSavingSeg(true);
    const newVal = !viewSub[field];
    try {
      await apiClient.patch(`/admin/submissions/${viewSub.id}/seg`, { [field]: newVal });
      setViewSub(prev => ({ ...prev, [field]: newVal }));
      setSubmissions(prev => prev.map(s => s.id === viewSub.id ? { ...s, [field]: newVal } : s));
      toast.success('SEG flag updated');
    } catch (e) {
      toast.error('Failed to update SEG flag');
    }
    setSavingSeg(false);
  };

  const exportCSV = () => {
    const headers = ['Name', 'Email', 'Category', 'Program', 'Verification Code', 'Verified', 'Submitted At'];
    const rows = filtered.map(sub => [
      getStudentName(sub),
      sub.student_email || '',
      sub.student_category || '',
      getStudentProgram(sub),
      sub.verification_code || '',
      sub.is_verified ? 'Yes' : 'No',
      sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date().toISOString().slice(0, 10);
    a.download = `OSWD_Students_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    setShowExportDialog(false);
  };

  const getAnswerDisplay = (qId, data) => {
    const val = data[qId];
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
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn} className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Student Submissions</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} records found</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button onClick={() => setShowVerifyDialog(true)} size="sm" disabled={verifying}>
              <Shield className="w-3 h-3 mr-1" /> Verify ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)} className="rounded-lg">
            <Download className="w-3 h-3 mr-1" /> Export CSV
          </Button>
        </div>
      </motion.div>

      <motion.div variants={fadeIn} className="bg-muted/30 border border-border rounded-xl p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">All Entries (unfiltered)</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CATEGORIES.map(cat => (
            <div key={cat} className="bg-white border border-border/60 rounded-lg px-3 py-2 flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${CAT_COLORS[cat]} shrink-0`} />
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-sm font-bold font-heading">{allCatSummary[cat] || 0}</span>
                <span className="text-xs text-muted-foreground truncate">{cat}</span>
              </div>
            </div>
          ))}
        </div>
        {Object.keys(allProgSummary).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {Object.entries(allProgSummary).sort((a, b) => b[1] - a[1]).map(([prog, count]) => (
              <span key={prog} className="inline-flex items-center gap-1 text-xs bg-white border border-border/60 px-2 py-0.5 rounded-full">
                <span className="font-medium">{prog}</span>
                <span className="text-muted-foreground">({count})</span>
              </span>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div variants={fadeIn} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map(cat => (
          <div key={cat} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${CAT_COLORS[cat]} shrink-0`} />
            <div className="min-w-0">
              <p className="text-lg font-bold font-heading">{catSummary[cat] || 0}</p>
              <p className="text-xs text-muted-foreground truncate">{cat}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {Object.keys(progSummary).length > 0 && (
        <motion.div variants={fadeIn} className="flex flex-wrap gap-1.5">
          {Object.entries(progSummary).sort((a, b) => b[1] - a[1]).map(([prog, count]) => (
            <span key={prog} className="inline-flex items-center gap-1 text-xs bg-accent px-2.5 py-1 rounded-full">
              <span className="font-medium">{prog}</span>
              <span className="text-muted-foreground">({count})</span>
            </span>
          ))}
        </motion.div>
      )}

      <motion.div variants={fadeIn} className="flex flex-col sm:flex-row flex-wrap gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, email, or code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex-1 min-w-0">
          <Select value={filterSem} onValueChange={v => setFilterSem(v)}>
            <SelectTrigger className="w-full pr-8"><SelectValue placeholder="All Semesters">{filterSem ? semesters.find(s => String(s.id) === filterSem)?.label : ''}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Semesters</SelectItem>
              {semesters.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-0">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-full pr-8"><SelectValue>{filterCat === 'all' ? 'All Categories' : filterCat}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="New">New</SelectItem>
              <SelectItem value="Transferee">Transferee</SelectItem>
              <SelectItem value="Returnee">Returnee</SelectItem>
              <SelectItem value="Continuing">Continuing</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-0">
          <Select value={filterVerified} onValueChange={setFilterVerified}>
            <SelectTrigger className="w-full pr-8"><SelectValue>{filterVerified === 'all' ? 'All Status' : filterVerified === 'unverified' ? 'Pending' : filterVerified.charAt(0).toUpperCase() + filterVerified.slice(1)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="unverified">Pending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left w-10">
                    <Checkbox
                      checked={selectedIds.length === filtered.length && filtered.length > 0}
                      onCheckedChange={(checked) => {
                        setSelectedIds(checked ? filtered.map(s => s.id) : []);
                      }}
                    />
                  </th>
                  <th className="p-3 text-left font-medium text-xs">Name</th>
                  <th className="p-3 text-left font-medium text-xs">Category</th>
                  <th className="p-3 text-left font-medium text-xs">Program</th>
                  <th className="p-3 text-left font-medium text-xs">Code</th>
                  <th className="p-3 text-left font-medium text-xs">Status</th>
                  <th className="p-3 text-left font-medium text-xs">Submitted</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(sub => (
                  <tr key={sub.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <Checkbox
                        checked={selectedIds.includes(sub.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds(prev => checked ? [...prev, sub.id] : prev.filter(id => id !== sub.id));
                        }}
                      />
                    </td>
                    <td className="p-3 font-medium">{getStudentName(sub)}</td>
                    <td className="p-3">{toUpperDisplay(sub.student_category)}</td>
                    <td className="p-3 text-xs">{getStudentProgram(sub)}</td>
                    <td className="p-3 font-mono text-xs">{toUpperDisplay(sub.verification_code)}</td>
                    <td className="p-3">
                      {sub.status === 'verified' ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                      ) : sub.status === 'returned' ? (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                          <ArrowLeftFromLine className="w-3 h-3" /> Returned
                        </span>
                      ) : sub.status === 'declined' ? (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3" /> Declined
                        </span>
                      ) : (
                        <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded-full">Pending</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {sub.status !== 'verified' && (
                          <>
                            <TooltipBox label="Verify student">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => setVerifyConfirmSub(sub)} disabled={verifyOneId === sub.id}>
                                {verifyOneId === sub.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                              </Button>
                            </TooltipBox>
                            <TooltipBox label="Return for correction">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                onClick={() => { setReviewSub(sub); setReviewAction('returned'); setReviewComment(''); }}>
                                <ArrowLeftFromLine className="w-3 h-3" />
                              </Button>
                            </TooltipBox>
                            <TooltipBox label="Decline submission">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => { setReviewSub(sub); setReviewAction('declined'); setReviewComment(''); }}>
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </TooltipBox>
                          </>
                        )}
                        <TooltipBox label="View details">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewSub(sub)}>
                            <Eye className="w-3 h-3" />
                          </Button>
                        </TooltipBox>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No submissions found
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
                <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={safePage <= 1}>First</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}>Prev</Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="sm" className="min-w-[32px]" onClick={() => setPage(p)}>{p}</Button>
                  );
                })}
                <Button variant="outline" size="sm" onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}>Next</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>Last</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!viewSub} onOpenChange={() => setViewSub(null)}>
        <DialogContent className="sm:max-w-4xl lg:max-w-5xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Student Details</DialogTitle>
          </DialogHeader>
          {viewSub && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{viewSub.student_email}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Reference Code</p>
                  <p className="font-mono font-medium">{viewSub.verification_code}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium">{toUpperDisplay(viewSub.student_category)}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <p className="font-medium">{toUpperDisplay(viewSub.status || 'pending')}</p>
                </div>
              </div>
              {viewSub.is_verified ? (
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50">
                  <p className="text-sm font-semibold text-emerald-700">
                    &#10003; Verified by {viewSub.verified_by || 'OSWD'} on {viewSub.verified_at ? new Date(viewSub.verified_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              ) : (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Verified for Enrollment</p>
                  <p className="font-medium">No</p>
                </div>
              )}
              {viewSub.admin_comment && (
                <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                  <p className="text-xs font-medium text-amber-700">Admin Comment:</p>
                  <p className="text-sm text-amber-800 mt-1">{viewSub.admin_comment}</p>
                </div>
              )}
              <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                <p className="text-xs font-medium text-muted-foreground mb-2">Admin-Only SEG Flags (CHED Report)</p>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch checked={viewSub.is_senior_citizen || false} onCheckedChange={() => toggleSEG('is_senior_citizen')} disabled={savingSeg} />
                    Senior Citizen
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch checked={viewSub.is_magna_carta_poor || false} onCheckedChange={() => toggleSEG('is_magna_carta_poor')} disabled={savingSeg} />
                    Magna Carta Poor
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch checked={viewSub.is_underprivileged || false} onCheckedChange={() => toggleSEG('is_underprivileged')} disabled={savingSeg} />
                    Underprivileged
                  </label>
                  {savingSeg && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              {viewSub.draft_data_json && (
                <div className="border-t pt-3 space-y-2">
                  {Object.entries(JSON.parse(viewSub.draft_data_json)).map(([qId, val]) => {
                    const q = questions.find(qq => String(qq.id) === qId || qq.system_key === qId);
                    return (
                      <div key={qId} className="flex flex-col sm:flex-row gap-1 py-1.5 border-b border-border/30 last:border-0">
                        <span className="text-xs font-medium text-muted-foreground sm:w-1/2">{q?.question_text || qId}</span>
                        <span className="text-sm">{getAnswerDisplay(qId, JSON.parse(viewSub.draft_data_json))}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review dialog (Return / Decline) */}
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
                <Label className="text-sm font-medium">Comment / Reason</Label>
                <Textarea
                  placeholder="Explain why the submission is being returned or declined..."
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  rows={4}
                />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => { setReviewSub(null); setReviewAction(''); setReviewComment(''); }}>
                  Cancel
                </Button>
                <Button
                  variant={reviewAction === 'returned' ? 'default' : 'destructive'}
                  onClick={() => setShowReviewConfirm(true)}
                  disabled={reviewing || !reviewComment.trim()}
                >
                  {reviewing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {reviewAction === 'returned' ? 'Return' : 'Decline'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showVerifyDialog}
        onOpenChange={setShowVerifyDialog}
        onConfirm={handleBulkVerify}
        title="Verify Students"
        description={`Are you sure you want to verify ${selectedIds.length} student(s) for enrollment?`}
        confirmLabel="Verify"
        loading={verifying}
      />

      <ConfirmDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        onConfirm={exportCSV}
        title="Export CSV"
        description="Export the current filtered list of students as a CSV file?"
        confirmLabel="Export"
      />

      {/* Confirm individual verify */}
      <ConfirmDialog
        open={!!verifyConfirmSub}
        onOpenChange={() => setVerifyConfirmSub(null)}
        onConfirm={() => { if (verifyConfirmSub) { const s = verifyConfirmSub; setVerifyConfirmSub(null); handleIndividualVerify(s); } }}
        title="Verify Student"
        description={verifyConfirmSub ? `Verify ${getStudentName(verifyConfirmSub)} for enrollment?` : ''}
        confirmLabel="Verify"
        loading={verifyOneId === verifyConfirmSub?.id}
      />

      {/* Confirm return/decline */}
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
