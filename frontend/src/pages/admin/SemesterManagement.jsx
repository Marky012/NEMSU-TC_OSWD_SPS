import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton, CardSkeleton } from '@/components/ui/skeleton';
import apiClient from '@/api/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, GraduationCap, Loader2, Save, Calendar, Archive, Copy } from 'lucide-react';
import { TooltipBox } from '@/components/ui/tooltip';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function SemesterManagement() {
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSem, setEditSem] = useState(null);
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [seedTarget, setSeedTarget] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data } = await apiClient.get('/admin/semesters');
      setSemesters(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const formatDateForInput = (isoStr) => {
    if (!isoStr) return '';
    try {
      return new Date(isoStr).toISOString().slice(0, 16);
    } catch { return ''; }
  };

  const handleSave = async () => {
    if (!editSem?.label?.trim()) return;
    setSaving(true);
    try {
      if (editSem.id) {
        await apiClient.put(`/admin/semesters/${editSem.id}`, {
          label: editSem.label,
          opens_at: editSem.opens_at ? new Date(editSem.opens_at).toISOString() : undefined,
          closes_at: editSem.closes_at ? new Date(editSem.closes_at).toISOString() : undefined,
          is_active: editSem.is_active,
        });
      } else {
        const opensAt = editSem.opens_at ? new Date(editSem.opens_at).toISOString() : new Date().toISOString();
        const closesAt = editSem.closes_at ? new Date(editSem.closes_at).toISOString() : new Date(Date.now() + 86400000 * 90).toISOString();
        await apiClient.post(`/admin/semesters?clone_questions=true`, {
          label: editSem.label,
          opens_at: opensAt,
          closes_at: closesAt,
        });
      }
      setEditSem(null);
      loadData();
      toast.success('Semester saved');
    } catch (e) {
      toast.error('Error saving semester');
    }
    setSaving(false);
  };

  const handleActivate = async (id) => {
    try {
      await apiClient.post(`/admin/semesters/${id}/activate`);
      loadData();
      toast.success('Semester activated');
    } catch (e) {
      toast.error('Failed to activate semester');
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await apiClient.post(`/admin/semesters/${archiveTarget}/archive`);
      loadData();
      toast.success('Semester archived');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to archive semester');
    }
    setArchiveTarget(null);
  };

  const handleSeed = async () => {
    if (!seedTarget) return;
    setSeeding(true);
    try {
      await apiClient.post(`/admin/semesters/${seedTarget}/seed-default`);
      toast.success('Default questions seeded successfully');
      setSeedTarget(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to seed default questions');
    }
    setSeeding(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Semester Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage academic semesters and profiling periods</p>
        </div>
        <Button onClick={() => setEditSem({ label: '', is_active: false, opens_at: '', closes_at: '' })}>
          <Plus className="w-4 h-4 mr-1" /> New Semester
        </Button>
      </motion.div>

      <motion.div variants={fadeIn} className="space-y-3">
        {semesters.map(sem => (
          <Card key={sem.id} className={sem.is_active ? 'border-primary/50 shadow-sm' : ''}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${sem.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                    <GraduationCap className={`w-5 h-5 ${sem.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm flex items-center gap-2">
                      {sem.label}
                      {sem.is_active && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Active</span>}
                      {sem.is_archived && <span className="text-[10px] bg-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded-full">Archived</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sem.opens_at && `Opens: ${new Date(sem.opens_at).toLocaleDateString()}`}
                      {sem.closes_at && ` • Closes: ${new Date(sem.closes_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!sem.is_active && !sem.is_archived && (
                    <Button variant="outline" size="sm" onClick={() => handleActivate(sem.id)} className="text-xs">
                      Activate
                    </Button>
                  )}
                  {!sem.is_archived && (
                    <>
                      <TooltipBox label="Seed default questions for this semester">
                        <Button variant="ghost" size="sm" onClick={() => setSeedTarget(sem.id)} className="text-xs text-muted-foreground hover:text-foreground hover:bg-blue-50">
                          <Copy className="w-3 h-3 mr-1" /> Seed Default
                        </Button>
                      </TooltipBox>
                      <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(sem.id)} className="text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50">
                        <Archive className="w-3 h-3 mr-1" /> Archive
                      </Button>
                    </>
                  )}
                  <TooltipBox label="Edit semester">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditSem({
                      id: sem.id,
                      label: sem.label,
                      is_active: sem.is_active,
                      opens_at: formatDateForInput(sem.opens_at),
                      closes_at: formatDateForInput(sem.closes_at),
                    })}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </TooltipBox>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {semesters.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-lg font-semibold">No Semesters</h2>
            <p className="text-muted-foreground mt-1">Create your first semester to get started.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editSem} onOpenChange={() => setEditSem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editSem?.id ? 'Edit' : 'New'} Semester</DialogTitle></DialogHeader>
          {editSem && (
            <div className="space-y-4">
              <div>
                <Label>Label</Label>
                <Input value={editSem.label} onChange={e => setEditSem(prev => ({ ...prev, label: e.target.value }))} placeholder="AY 2025-2026 1st Semester" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Opens At</Label>
                  <Input type="datetime-local" value={editSem.opens_at || ''} onChange={e => setEditSem(prev => ({ ...prev, opens_at: e.target.value }))} />
                </div>
                <div>
                  <Label>Closes At</Label>
                  <Input type="datetime-local" value={editSem.closes_at || ''} onChange={e => setEditSem(prev => ({ ...prev, closes_at: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editSem.is_active || false} onCheckedChange={v => setEditSem(prev => ({ ...prev, is_active: v }))} />
                <Label>Set as Active Semester</Label>
              </div>
              {!editSem.id && (
                <p className="text-xs text-muted-foreground">Questions will be auto-cloned from the previous semester.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSem(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Semester"
        description="All finalized submissions will be moved to history. This cannot be undone."
        confirmLabel="Archive"
        variant="destructive"
      />

      <ConfirmDialog
        open={!!seedTarget}
        onOpenChange={() => setSeedTarget(null)}
        onConfirm={handleSeed}
        title="Seed Default Questions"
        description="This will replace all existing questions, sections, and dropdown options with the default template. Existing submissions may be affected. Continue?"
        confirmLabel="Seed Default"
        loading={seeding}
      />
    </motion.div>
    </AnimatedPage>
  );
}
