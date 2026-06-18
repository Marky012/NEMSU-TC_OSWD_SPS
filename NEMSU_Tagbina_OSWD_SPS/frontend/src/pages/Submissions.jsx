import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import apiClient from '@/api/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Clock, Eye, FileText, Shield } from 'lucide-react';

export default function Submissions() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewSub, setViewSub] = useState(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [subsRes, semsRes] = await Promise.all([
        apiClient.get('/submissions'),
        apiClient.get('/semesters'),
      ]);
      setSubmissions(subsRes.data || []);
      setSemesters(semsRes.data || []);
    } catch (e) {
      console.error('Failed to load submissions:', e);
    }
    setLoading(false);
  };

  const getSemesterLabel = (id) => semesters.find(s => s.id === id)?.label || 'Unknown';

  const getAnswerDisplay = (qId, data) => {
    const val = data?.[qId];
    if (!val) return 'N/A';
    if (typeof val === 'string' && val.startsWith('[')) {
      try { return JSON.parse(val).join(', '); } catch { return val; }
    }
    if (typeof val === 'string' && val.startsWith('http')) return '📎 File attached';
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
      <div>
        <h1 className="font-heading text-2xl font-bold">My Submissions</h1>
        <p className="text-muted-foreground text-sm mt-1">View your submitted profiling forms</p>
      </div>

      {submissions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-lg font-semibold">No Submissions Yet</h2>
            <p className="text-muted-foreground mt-1">You haven't submitted any profiling forms.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {submissions.map(sub => (
            <Card key={sub.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${sub.isFinal ? 'bg-primary/10' : 'bg-secondary/10'}`}>
                      {sub.isFinal ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Clock className="w-5 h-5 text-secondary" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{getSemesterLabel(sub.semesterId)}</p>
                      <p className="text-xs text-muted-foreground capitalize">{sub.category || 'Student'} • {sub.isFinal ? 'Submitted' : 'Draft'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.verificationCode && (
                      <span className="text-xs font-mono bg-accent px-2 py-1 rounded hidden sm:inline">{sub.verificationCode}</span>
                    )}
                    {sub.isVerified && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Verified
                      </span>
                    )}
                    {sub.isFinal && (
                      <Button variant="ghost" size="sm" onClick={() => setViewSub(sub)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View submission dialog */}
      <Dialog open={!!viewSub} onOpenChange={() => setViewSub(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Submission Details</DialogTitle>
          </DialogHeader>
          {viewSub && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Semester</p>
                  <p className="font-medium">{getSemesterLabel(viewSub.semesterId)}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Reference Code</p>
                  <p className="font-mono font-medium">{viewSub.verificationCode}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium capitalize">{viewSub.category}</p>
                </div>
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-xs text-muted-foreground">Submitted</p>
                  <p className="font-medium">{viewSub.submittedAt ? new Date(viewSub.submittedAt).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
              {viewSub.draftData && (
                <div className="border-t pt-4">
                  <h3 className="font-heading font-semibold mb-3">Answers</h3>
                  <div className="space-y-2">
                    {Object.entries(viewSub.draftData).map(([qId, val]) => (
                      <div key={qId} className="flex flex-col sm:flex-row sm:items-start gap-1 py-2 border-b border-border/50 last:border-0">
                        <span className="text-xs font-medium text-muted-foreground sm:w-1/2 flex-shrink-0">
                          Question {qId}
                        </span>
                        <span className="text-sm">{getAnswerDisplay(qId, viewSub.draftData)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}