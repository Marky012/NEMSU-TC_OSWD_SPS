import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Search, CheckCircle2, Shield, Eye, Download, Users, Filter } from 'lucide-react';

export default function StudentList() {
  const { user } = useAuth();
  const { toast } = useToast();
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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [subs, sems, qs] = await Promise.all([
        base44.entities.Submission.filter({ is_final: true }),
        base44.entities.Semester.list(),
        base44.entities.Question.list(),
      ]);
      subs.sort((a, b) => new Date(b.submitted_at || b.created_date) - new Date(a.submitted_at || a.created_date));
      setSubmissions(subs);
      setSemesters(sems);
      setQuestions(qs);
      const activeSem = sems.find(s => s.is_active);
      if (activeSem) setFilterSem(activeSem.id);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const getStudentName = (sub) => {
    if (!sub.draft_data_json) return 'Unknown';
    const data = JSON.parse(sub.draft_data_json);
    for (const [qId, val] of Object.entries(data)) {
      const q = questions.find(qq => qq.id === qId);
      if (q?.question_text?.toLowerCase().includes('full name')) return val;
    }
    return 'Student';
  };

  const filtered = submissions.filter(sub => {
    if (filterSem && sub.semester_id !== filterSem) return false;
    if (filterCat !== 'all' && sub.student_category !== filterCat) return false;
    if (filterVerified === 'verified' && !sub.is_verified) return false;
    if (filterVerified === 'unverified' && sub.is_verified) return false;
    if (search) {
      const name = getStudentName(sub).toLowerCase();
      const code = (sub.verification_code || '').toLowerCase();
      if (!name.includes(search.toLowerCase()) && !code.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const handleBulkVerify = async () => {
    if (selectedIds.length === 0) return;
    try {
      for (const id of selectedIds) {
        await base44.entities.Submission.update(id, {
          is_verified: true,
          verified_by: user.email,
          verified_at: new Date().toISOString(),
        });
      }
      await base44.entities.AdminLog.create({
        admin_email: user.email,
        action: 'Bulk verification',
        details: `Verified ${selectedIds.length} students`,
      });
      setSelectedIds([]);
      loadData();
      toast({ title: `${selectedIds.length} students verified` });
    } catch (e) { toast({ title: 'Verification failed', variant: 'destructive' }); }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Category', 'Verification Code', 'Verified', 'Submitted At'];
    const rows = filtered.map(sub => [
      getStudentName(sub),
      sub.student_category,
      sub.verification_code,
      sub.is_verified ? 'Yes' : 'No',
      sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getAnswerDisplay = (qId, data) => {
    const val = data[qId];
    if (!val) return 'N/A';
    if (typeof val === 'string' && val.startsWith('[')) {
      try { return JSON.parse(val).join(', '); } catch { return val; }
    }
    return val;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Student Submissions</h1>
          <p className="text-muted-foreground text-sm mt-1">{filtered.length} records found</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button onClick={handleBulkVerify} size="sm">
              <Shield className="w-3 h-3 mr-1" /> Verify ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-3 h-3 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or code..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterSem} onValueChange={setFilterSem}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Semesters" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all_semesters">All Semesters</SelectItem>
            {semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="transferee">Transferee</SelectItem>
            <SelectItem value="returnee">Returnee</SelectItem>
            <SelectItem value="continuing">Continuing</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterVerified} onValueChange={setFilterVerified}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="unverified">Unverified</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
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
                  <th className="p-3 text-left font-medium text-xs">Code</th>
                  <th className="p-3 text-left font-medium text-xs">Status</th>
                  <th className="p-3 text-left font-medium text-xs">Submitted</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(sub => (
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
                    <td className="p-3 capitalize">{sub.student_category}</td>
                    <td className="p-3 font-mono text-xs">{sub.verification_code}</td>
                    <td className="p-3">
                      {sub.is_verified ? (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded-full">Pending</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="p-3">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewSub(sub)}>
                        <Eye className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-muted-foreground">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No submissions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* View dialog */}
      <Dialog open={!!viewSub} onOpenChange={() => setViewSub(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Student Details</DialogTitle>
          </DialogHeader>
          {viewSub && viewSub.draft_data_json && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Reference Code</p>
                  <p className="font-mono font-medium">{viewSub.verification_code}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium capitalize">{viewSub.student_category}</p>
                </div>
              </div>
              <div className="border-t pt-3 space-y-2">
                {Object.entries(JSON.parse(viewSub.draft_data_json)).map(([qId, val]) => {
                  const q = questions.find(qq => qq.id === qId);
                  return (
                    <div key={qId} className="flex flex-col sm:flex-row gap-1 py-1.5 border-b border-border/30 last:border-0">
                      <span className="text-xs font-medium text-muted-foreground sm:w-1/2">{q?.question_text || qId}</span>
                      <span className="text-sm">{getAnswerDisplay(qId, JSON.parse(viewSub.draft_data_json))}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}