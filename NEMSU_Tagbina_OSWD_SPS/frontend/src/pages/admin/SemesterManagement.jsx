import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { DEFAULT_CATEGORIES, getDefaultQuestions } from '@/lib/seedData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil, GraduationCap, Copy, Loader2, Save, CheckCircle2, Calendar } from 'lucide-react';

export default function SemesterManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [semesters, setSemesters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSem, setEditSem] = useState(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const sems = await base44.entities.Semester.list();
      sems.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setSemesters(sems);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editSem?.label) return;
    setSaving(true);
    try {
      if (editSem.is_active) {
        // Deactivate all other semesters
        const activeSems = semesters.filter(s => s.is_active && s.id !== editSem.id);
        for (const s of activeSems) {
          await base44.entities.Semester.update(s.id, { is_active: false });
        }
      }
      if (editSem.id) {
        await base44.entities.Semester.update(editSem.id, {
          label: editSem.label,
          academic_year: editSem.academic_year,
          semester_number: editSem.semester_number,
          is_active: editSem.is_active,
          opens_at: editSem.opens_at,
          closes_at: editSem.closes_at,
        });
      } else {
        await base44.entities.Semester.create({
          label: editSem.label,
          academic_year: editSem.academic_year,
          semester_number: editSem.semester_number,
          is_active: editSem.is_active || false,
          opens_at: editSem.opens_at,
          closes_at: editSem.closes_at,
        });
      }
      await base44.entities.AdminLog.create({ admin_email: user.email, action: 'Semester saved', details: editSem.label });
      setEditSem(null);
      loadData();
      toast({ title: 'Semester saved' });
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    setSaving(false);
  };

  const handleSeedDefault = async (semesterId) => {
    setSeeding(true);
    try {
      // Check if categories exist
      let cats = await base44.entities.QuestionCategory.list();
      if (cats.length === 0) {
        for (const dc of DEFAULT_CATEGORIES) {
          await base44.entities.QuestionCategory.create(dc);
        }
        cats = await base44.entities.QuestionCategory.list();
      }

      const categoryMap = {};
      cats.forEach(c => { categoryMap[c.name] = c.id; });

      const defaultQs = getDefaultQuestions(categoryMap, semesterId);

      // Check if questions already exist for this semester
      const existingQs = await base44.entities.Question.filter({ semester_id: semesterId });
      if (existingQs.length > 0) {
        if (!confirm('This semester already has questions. This will add default questions. Continue?')) {
          setSeeding(false);
          return;
        }
      }

      for (const q of defaultQs) {
        await base44.entities.Question.create(q);
      }

      // Also seed IP groups
      const ipGroups = await base44.entities.IPGroup.list();
      if (ipGroups.length === 0) {
        const groups = ['Blaan', 'Mamanwa', 'Mangyan', 'Subanen', 'Bukidnon', 'Mandaya', 'Manobo', "T'boli"];
        for (const g of groups) {
          await base44.entities.IPGroup.create({ name: g, active: true });
        }
      }

      await base44.entities.AdminLog.create({ admin_email: user.email, action: 'Seeded default questions', details: semesterId });
      toast({ title: 'Default questions loaded!', description: `${defaultQs.length} questions added.` });
      loadData();
    } catch (e) {
      toast({ title: 'Seeding failed', variant: 'destructive' });
    }
    setSeeding(false);
  };

  const handleCloneQuestions = async (fromSemId, toSemId) => {
    setSaving(true);
    try {
      const sourceQs = await base44.entities.Question.filter({ semester_id: fromSemId });
      for (const q of sourceQs) {
        const { id, created_date, updated_date, created_by_id, ...rest } = q;
        await base44.entities.Question.create({ ...rest, semester_id: toSemId });
      }
      toast({ title: 'Questions cloned!', description: `${sourceQs.length} questions copied.` });
    } catch (e) { toast({ title: 'Clone failed', variant: 'destructive' }); }
    setSaving(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Semester Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage academic semesters and profiling periods</p>
        </div>
        <Button onClick={() => setEditSem({ label: '', academic_year: '', semester_number: 1, is_active: false, opens_at: '', closes_at: '' })}>
          <Plus className="w-4 h-4 mr-1" /> New Semester
        </Button>
      </div>

      <div className="space-y-3">
        {semesters.map(sem => (
          <Card key={sem.id} className={sem.is_active ? 'border-primary/50 shadow-sm' : ''}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${sem.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                    <GraduationCap className={`w-5 h-5 ${sem.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm flex items-center gap-2">
                      {sem.label}
                      {sem.is_active && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">Active</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sem.opens_at && `Opens: ${new Date(sem.opens_at).toLocaleDateString()}`}
                      {sem.closes_at && ` • Closes: ${new Date(sem.closes_at).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleSeedDefault(sem.id)} disabled={seeding}>
                    {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
                    <span className="ml-1 hidden sm:inline">Seed Default</span>
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditSem(sem)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {semesters.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-heading text-lg font-semibold">No Semesters</h2>
            <p className="text-muted-foreground mt-1">Create your first semester to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editSem} onOpenChange={() => setEditSem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editSem?.id ? 'Edit' : 'New'} Semester</DialogTitle></DialogHeader>
          {editSem && (
            <div className="space-y-4">
              <div>
                <Label>Label</Label>
                <Input value={editSem.label} onChange={e => setEditSem(prev => ({ ...prev, label: e.target.value }))} placeholder="1st Semester 2025-2026" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Academic Year</Label>
                  <Input value={editSem.academic_year || ''} onChange={e => setEditSem(prev => ({ ...prev, academic_year: e.target.value }))} placeholder="2025-2026" />
                </div>
                <div>
                  <Label>Semester Number</Label>
                  <Input type="number" value={editSem.semester_number || 1} onChange={e => setEditSem(prev => ({ ...prev, semester_number: parseInt(e.target.value) }))} />
                </div>
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
    </div>
  );
}