import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton } from '@/components/ui/skeleton';
import apiClient from '@/api/apiClient';
import { useAuth } from '@/context/AuthContext';
import { STUDENT_CATEGORIES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Save, Loader2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { TooltipBox } from '@/components/ui/tooltip';
import ConfirmDialog from '@/components/ConfirmDialog';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'select', label: 'Dropdown Select' },
  { value: 'radio', label: 'Radio' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'file', label: 'File Upload' },
  { value: 'table', label: 'Table' },
];

const HAS_OPTIONS = ['select', 'radio', 'checkbox', 'multi_select'];
const HAS_TABLE_COLUMNS = ['table'];

export default function QuestionEditor() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [activeSemester, setActiveSemester] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editQ, setEditQ] = useState(null);
  const [editCat, setEditCat] = useState(null);
  const [showCatDialog, setShowCatDialog] = useState(false);
  const [expandedCat, setExpandedCat] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [cats, sems, qs] = await Promise.all([
        apiClient.get('/forms/categories'),
        apiClient.get('/admin/semesters'),
        apiClient.get('/forms/questions'),
      ]);
      const sortedCats = (cats.data || []).sort((a, b) => a.display_order - b.display_order);
      setCategories(sortedCats);
      setSemesters(sems.data || []);
      setQuestions(qs.data || []);

      const activeSem = (sems.data || []).find(s => s.is_active);
      setActiveSemester(activeSem);
      if (sortedCats.length > 0) setExpandedCat(sortedCats[0].id);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSaveCategory = async () => {
    if (!editCat?.name?.trim()) return;
    setSaving(true);
    try {
      await apiClient.post('/forms/categories', {
        name: editCat.name,
        display_order: editCat.order || 0,
      });
      setShowCatDialog(false);
      setEditCat(null);
      toast.success('Section created');
      loadData();
    } catch (e) {
      toast.error('Error creating section');
    }
    setSaving(false);
  };

  const openEditQuestion = (q = null, catId = null) => {
    if (q) {
      const opts = q.options ? (Array.isArray(q.options) ? JSON.stringify(q.options) : typeof q.options === 'string' ? q.options : '') : '';
      setEditQ({
        id: q.id,
        category_id: q.category_id,
        question_text: q.question_text,
        field_type: q.field_type,
        options_json: opts,
        required: q.required,
        min_rows: q.min_rows,
        active: q.active,
        applicable_cats: q.applicable_categories?.length ? q.applicable_categories : ['all'],
        conditional_parent_id: q.conditional_parent_question_id || '',
        conditional_value: q.conditional_value || '',
        display_order: q.display_order || 0,
        semester_id: q.semester_id,
      });
    } else {
      setEditQ({
        category_id: catId,
        question_text: '',
        field_type: 'text',
        options_json: '',
        required: false,
        active: true,
        applicable_cats: ['all'],
        conditional_parent_id: '',
        conditional_value: '',
        display_order: questions.filter(qq => qq.category_id === catId).length + 1,
        semester_id: activeSemester?.id,
      });
    }
  };

  const handleSaveQuestion = async () => {
    if (!editQ.question_text.trim()) return;
    setSaving(true);
    try {
      let options = null;
      if (HAS_OPTIONS.includes(editQ.field_type) || HAS_TABLE_COLUMNS.includes(editQ.field_type)) {
        if (editQ.options_json?.trim()) {
          try { options = JSON.parse(editQ.options_json); } catch { options = editQ.options_json.split('\n').filter(Boolean); }
        }
      }

      const data = {
        category_id: editQ.category_id,
        question_text: editQ.question_text,
        field_type: editQ.field_type === 'file_upload' ? 'file' : editQ.field_type,
        options,
        required: editQ.required,
        min_rows: HAS_TABLE_COLUMNS.includes(editQ.field_type) ? (editQ.min_rows || 0) : undefined,
        active: editQ.active !== false,
        applicable_categories: editQ.applicable_cats?.includes('all') ? ['all'] : editQ.applicable_cats || ['all'],
        conditional_parent_question_id: editQ.conditional_parent_id || undefined,
        conditional_value: editQ.conditional_value || undefined,
        display_order: editQ.display_order || 0,
        semester_id: activeSemester?.id,
      };

      if (editQ.id) {
        await apiClient.put(`/forms/questions/${editQ.id}`, data);
      } else {
        await apiClient.post('/forms/questions', data);
      }
      setEditQ(null);
      toast.success('Question saved');
      loadData();
    } catch (e) {
      toast.error('Error saving question');
    }
    setSaving(false);
  };

  const handleDeleteQuestion = async () => {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/forms/questions/${deleteTarget}`);
      toast.success('Question deleted');
      loadData();
    } catch (e) {
      toast.error('Cannot delete system-required questions. Set them to inactive instead.');
    }
    setDeleteTarget(null);
  };

  const handleToggleActive = async (q) => {
    try {
      await apiClient.put(`/forms/questions/${q.id}`, { active: !q.active });
      loadData();
    } catch (e) {
      toast.error('Error toggling question');
    }
  };

  const moveQuestion = async (q, direction) => {
    const catQs = questions.filter(qq => qq.category_id === q.category_id).sort((a, b) => a.display_order - b.display_order);
    const idx = catQs.findIndex(qq => qq.id === q.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= catQs.length) return;
    const other = catQs[swapIdx];
    try {
      await apiClient.post('/forms/questions/reorder', [
        { question_id: q.id, display_order: other.display_order },
        { question_id: other.id, display_order: q.display_order },
      ]);
      loadData();
    } catch (e) {
      toast.error('Error reordering');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="bg-white border border-border rounded-xl p-4 space-y-4">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border border-border rounded-lg p-4 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!activeSemester) {
    return (
      <Card className="max-w-lg mx-auto mt-12">
        <CardContent className="p-8 text-center">
          <h2 className="font-heading text-xl font-bold">No Active Semester</h2>
          <p className="text-muted-foreground mt-2">Create a semester first to manage questions.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn} className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Question Editor</h1>
          <p className="text-muted-foreground text-sm mt-1">{activeSemester.label}</p>
        </div>
        <Button onClick={() => { setEditCat({ name: '', order: categories.length + 1 }); setShowCatDialog(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Section
        </Button>
      </motion.div>

      <motion.div variants={fadeIn} className="space-y-4">
        {categories.map(cat => {
          const catQs = questions.filter(q => q.category_id === cat.id).sort((a, b) => a.display_order - b.display_order);
          const isExpanded = expandedCat === cat.id;
          return (
            <Card key={cat.id}>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedCat(isExpanded ? null : cat.id)}>
      <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4 rotate-180" />}
                    <div>
                      <CardTitle className="text-base">{cat.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{catQs.length} questions</p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0 space-y-2">
                  {catQs.map((q, idx) => (
                    <div key={q.id} className={`flex items-center gap-2 p-3 rounded-lg border ${q.active ? 'bg-background' : 'bg-muted/50 opacity-60'}`}>
                      <div className="flex flex-col gap-0.5">
                        <TooltipBox label="Move up">
                          <button onClick={() => moveQuestion(q, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                        </TooltipBox>
                        <TooltipBox label="Move down">
                          <button onClick={() => moveQuestion(q, 'down')} disabled={idx === catQs.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </TooltipBox>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{q.question_text}</p>
                        <p className="text-xs text-muted-foreground">
                          {q.field_type} {q.required && '• Required'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <TooltipBox label={q.active ? 'Deactivate question' : 'Activate question'}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(q)}>
                            {q.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </Button>
                        </TooltipBox>
                        <TooltipBox label="Edit question">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditQuestion(q)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </TooltipBox>
                        <TooltipBox label="Delete question">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(q.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TooltipBox>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => openEditQuestion(null, cat.id)}>
                    <Plus className="w-3 h-3 mr-1" /> Add Question
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </motion.div>

      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Section</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Section Name</Label>
              <Input value={editCat?.name || ''} onChange={e => setEditCat(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label>Display Order</Label>
              <Input type="number" value={editCat?.order || 0} onChange={e => setEditCat(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveCategory} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editQ} onOpenChange={() => setEditQ(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editQ?.id ? 'Edit' : 'Add'} Question</DialogTitle></DialogHeader>
          {editQ && (
            <div className="space-y-5">
              {/* Basic Settings */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Basic Settings</h3>
                <div>
                  <Label>Question Text</Label>
                  <Textarea value={editQ.question_text} onChange={e => setEditQ(prev => ({ ...prev, question_text: e.target.value }))} />
                </div>
                <div>
                  <Label>Field Type</Label>
                  <Select value={editQ.field_type} onValueChange={v => setEditQ(prev => ({ ...prev, field_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(ft => (
                        <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Display Order</Label>
                  <Input type="number" value={editQ.display_order || 0} onChange={e => setEditQ(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>

              {/* Options */}
              {(HAS_OPTIONS.includes(editQ.field_type) || HAS_TABLE_COLUMNS.includes(editQ.field_type)) && (
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Options</h3>
                  <div>
                    <Label>{HAS_TABLE_COLUMNS.includes(editQ.field_type) ? 'Table Columns' : 'Options'}</Label>
                    <Textarea
                      value={editQ.options_json}
                      onChange={e => setEditQ(prev => ({ ...prev, options_json: e.target.value }))}
                      placeholder={HAS_TABLE_COLUMNS.includes(editQ.field_type) ? '["Column 1", "Column 2"]' : '["Option 1", "Option 2"]'}
                      className="font-mono text-xs"
                    />
                  </div>
                  {HAS_TABLE_COLUMNS.includes(editQ.field_type) && (
                    <div>
                      <Label>Min Rows (0 = no minimum)</Label>
                      <Input type="number" min="0" value={editQ.min_rows ?? 0} onChange={e => setEditQ(prev => ({ ...prev, min_rows: parseInt(e.target.value) || 0 }))} />
                    </div>
                  )}
                </div>
              )}

              {/* Visibility */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Visibility</h3>
                <div>
                  <Label className="mb-2 block">Applicable Student Categories</Label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={editQ.applicable_cats?.includes('all')}
                        onCheckedChange={(checked) => {
                          setEditQ(prev => ({ ...prev, applicable_cats: checked ? ['all'] : [] }));
                        }}
                      />
                      <Label className="font-normal">All Categories</Label>
                    </div>
                    {!editQ.applicable_cats?.includes('all') && STUDENT_CATEGORIES.map(cat => (
                      <div key={cat.value} className="flex items-center gap-2">
                        <Checkbox
                          checked={editQ.applicable_cats?.includes(cat.value)}
                          onCheckedChange={(checked) => {
                            setEditQ(prev => ({
                              ...prev,
                              applicable_cats: checked
                                ? [...(prev.applicable_cats || []), cat.value]
                                : (prev.applicable_cats || []).filter(c => c !== cat.value)
                            }));
                          }}
                        />
                        <Label className="font-normal">{cat.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Conditional Parent Question</Label>
                    <Select value={editQ.conditional_parent_id || 'none'} onValueChange={v => setEditQ(prev => ({ ...prev, conditional_parent_id: v === 'none' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {questions.filter(q => q.id !== editQ.id).map(q => (
                          <SelectItem key={q.id} value={String(q.id)}>{q.question_text?.substring(0, 50)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Show when parent =</Label>
                    <Input value={editQ.conditional_value || ''} onChange={e => setEditQ(prev => ({ ...prev, conditional_value: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Status</h3>
                <div className="flex gap-8">
                  <div>
                    <Label className="mb-2 block">Required</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="required"
                          className="accent-primary"
                          checked={editQ.required === true}
                          onChange={() => setEditQ(prev => ({ ...prev, required: true }))}
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="required"
                          className="accent-primary"
                          checked={editQ.required === false}
                          onChange={() => setEditQ(prev => ({ ...prev, required: false }))}
                        />
                        No
                      </label>
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Active</Label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="active"
                          className="accent-primary"
                          checked={editQ.active !== false}
                          onChange={() => setEditQ(prev => ({ ...prev, active: true }))}
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="radio"
                          name="active"
                          className="accent-primary"
                          checked={editQ.active === false}
                          onChange={() => setEditQ(prev => ({ ...prev, active: false }))}
                        />
                        No
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditQ(null)}>Cancel</Button>
            <Button onClick={handleSaveQuestion} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Save Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        onConfirm={handleDeleteQuestion}
        title="Delete Question"
        description="This action cannot be undone. Are you sure you want to delete this question?"
        confirmLabel="Delete"
        variant="destructive"
      />
    </motion.div>
    </AnimatedPage>
  );
}
