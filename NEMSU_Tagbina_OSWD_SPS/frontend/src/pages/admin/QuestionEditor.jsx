import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { FIELD_TYPES, STUDENT_CATEGORIES } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil, Trash2, GripVertical, Save, Loader2, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

export default function QuestionEditor() {
  const { user } = useAuth();
  const { toast } = useToast();
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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [cats, sems] = await Promise.all([
        base44.entities.QuestionCategory.list(),
        base44.entities.Semester.list(),
      ]);
      cats.sort((a, b) => (a.order || 0) - (b.order || 0));
      setCategories(cats);
      setSemesters(sems);

      const activeSem = sems.find(s => s.is_active);
      setActiveSemester(activeSem);

      if (activeSem) {
        const qs = await base44.entities.Question.filter({ semester_id: activeSem.id });
        qs.sort((a, b) => (a.order || 0) - (b.order || 0));
        setQuestions(qs);
        if (cats.length > 0) setExpandedCat(cats[0].id);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const logAction = async (action, details) => {
    await base44.entities.AdminLog.create({
      admin_email: user.email,
      action,
      details,
      entity_type: 'Question',
    });
  };

  const handleSaveCategory = async () => {
    setSaving(true);
    try {
      if (editCat?.id) {
        await base44.entities.QuestionCategory.update(editCat.id, { name: editCat.name, description: editCat.description, order: editCat.order || 0 });
      } else {
        await base44.entities.QuestionCategory.create({ name: editCat.name, description: editCat.description, order: categories.length + 1 });
      }
      await logAction('Category saved', editCat.name);
      setShowCatDialog(false);
      setEditCat(null);
      loadData();
      toast({ title: 'Category saved' });
    } catch (e) { toast({ title: 'Error', variant: 'destructive' }); }
    setSaving(false);
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Delete this category and all its questions?')) return;
    const catQs = questions.filter(q => q.category_id === id);
    for (const q of catQs) await base44.entities.Question.delete(q.id);
    await base44.entities.QuestionCategory.delete(id);
    await logAction('Category deleted', id);
    loadData();
    toast({ title: 'Category deleted' });
  };

  const openEditQuestion = (q = null, catId = null) => {
    if (q) {
      setEditQ({ ...q, applicable_cats: q.applicable_categories ? JSON.parse(q.applicable_categories) : ['all'] });
    } else {
      setEditQ({
        category_id: catId,
        question_text: '',
        field_type: 'text',
        options_json: '',
        table_columns_json: '',
        required: false,
        active: true,
        applicable_cats: ['all'],
        help_text: '',
        conditional_parent_id: '',
        conditional_value: '',
        order: questions.filter(qq => qq.category_id === catId).length + 1,
        semester_id: activeSemester?.id,
      });
    }
  };

  const handleSaveQuestion = async () => {
    if (!editQ.question_text.trim()) return;
    setSaving(true);
    try {
      const data = {
        category_id: editQ.category_id,
        question_text: editQ.question_text,
        field_type: editQ.field_type,
        options_json: editQ.options_json || '',
        table_columns_json: editQ.table_columns_json || '',
        required: editQ.required,
        active: editQ.active !== false,
        applicable_categories: JSON.stringify(editQ.applicable_cats || ['all']),
        help_text: editQ.help_text || '',
        conditional_parent_id: editQ.conditional_parent_id || '',
        conditional_value: editQ.conditional_value || '',
        order: editQ.order || 0,
        semester_id: activeSemester?.id,
      };
      if (editQ.id) {
        await base44.entities.Question.update(editQ.id, data);
      } else {
        await base44.entities.Question.create(data);
      }
      await logAction('Question saved', editQ.question_text);
      setEditQ(null);
      loadData();
      toast({ title: 'Question saved' });
    } catch (e) { toast({ title: 'Error saving question', variant: 'destructive' }); }
    setSaving(false);
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('Delete this question?')) return;
    await base44.entities.Question.delete(id);
    await logAction('Question deleted', id);
    loadData();
    toast({ title: 'Question deleted' });
  };

  const handleToggleActive = async (q) => {
    await base44.entities.Question.update(q.id, { active: !q.active });
    loadData();
  };

  const moveQuestion = async (q, direction) => {
    const catQs = questions.filter(qq => qq.category_id === q.category_id).sort((a, b) => a.order - b.order);
    const idx = catQs.findIndex(qq => qq.id === q.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= catQs.length) return;
    const other = catQs[swapIdx];
    await Promise.all([
      base44.entities.Question.update(q.id, { order: other.order }),
      base44.entities.Question.update(other.id, { order: q.order }),
    ]);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Question Editor</h1>
          <p className="text-muted-foreground text-sm mt-1">{activeSemester.label}</p>
        </div>
        <Button onClick={() => { setEditCat({ name: '', description: '', order: categories.length + 1 }); setShowCatDialog(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Section
        </Button>
      </div>

      {/* Categories with questions */}
      <div className="space-y-4">
        {categories.map(cat => {
          const catQs = questions.filter(q => q.category_id === cat.id).sort((a, b) => (a.order || 0) - (b.order || 0));
          const isExpanded = expandedCat === cat.id;
          return (
            <Card key={cat.id}>
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpandedCat(isExpanded ? null : cat.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4 rotate-180" />}
                    <div>
                      <CardTitle className="text-base">{cat.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{catQs.length} questions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditCat(cat); setShowCatDialog(true); }}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="pt-0 space-y-2">
                  {catQs.map((q, idx) => (
                    <div key={q.id} className={`flex items-center gap-2 p-3 rounded-lg border ${q.active ? 'bg-background' : 'bg-muted/50 opacity-60'}`}>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveQuestion(q, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button onClick={() => moveQuestion(q, 'down')} disabled={idx === catQs.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{q.question_text}</p>
                        <p className="text-xs text-muted-foreground">
                          {q.field_type} {q.required && '• Required'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleActive(q)}>
                          {q.active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditQuestion(q)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteQuestion(q.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
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
      </div>

      {/* Category Dialog */}
      <Dialog open={showCatDialog} onOpenChange={setShowCatDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCat?.id ? 'Edit' : 'Add'} Section</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Section Name</Label>
              <Input value={editCat?.name || ''} onChange={e => setEditCat(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={editCat?.description || ''} onChange={e => setEditCat(prev => ({ ...prev, description: e.target.value }))} />
            </div>
            <div>
              <Label>Display Order</Label>
              <Input type="number" value={editCat?.order || 0} onChange={e => setEditCat(prev => ({ ...prev, order: parseInt(e.target.value) }))} />
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

      {/* Question Dialog */}
      <Dialog open={!!editQ} onOpenChange={() => setEditQ(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editQ?.id ? 'Edit' : 'Add'} Question</DialogTitle></DialogHeader>
          {editQ && (
            <div className="space-y-4">
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
              {['radio', 'checkbox', 'dropdown', 'multi_select'].includes(editQ.field_type) && (
                <div>
                  <Label>Options (JSON array)</Label>
                  <Textarea
                    value={editQ.options_json}
                    onChange={e => setEditQ(prev => ({ ...prev, options_json: e.target.value }))}
                    placeholder='["Option 1", "Option 2", "Option 3"]'
                    className="font-mono text-xs"
                  />
                </div>
              )}
              {editQ.field_type === 'table' && (
                <div>
                  <Label>Table Columns (JSON array)</Label>
                  <Textarea
                    value={editQ.table_columns_json}
                    onChange={e => setEditQ(prev => ({ ...prev, table_columns_json: e.target.value }))}
                    placeholder='["Column 1", "Column 2"]'
                    className="font-mono text-xs"
                  />
                </div>
              )}
              <div>
                <Label>Help Text</Label>
                <Input value={editQ.help_text || ''} onChange={e => setEditQ(prev => ({ ...prev, help_text: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Conditional Parent Question</Label>
                  <Select value={editQ.conditional_parent_id || 'none'} onValueChange={v => setEditQ(prev => ({ ...prev, conditional_parent_id: v === 'none' ? '' : v }))}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {questions.filter(q => q.id !== editQ.id).map(q => (
                        <SelectItem key={q.id} value={q.id}>{q.question_text?.substring(0, 50)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Show when parent =</Label>
                  <Input value={editQ.conditional_value || ''} onChange={e => setEditQ(prev => ({ ...prev, conditional_value: e.target.value }))} />
                </div>
              </div>
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
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={editQ.required} onCheckedChange={v => setEditQ(prev => ({ ...prev, required: v }))} />
                  <Label>Required</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editQ.active !== false} onCheckedChange={v => setEditQ(prev => ({ ...prev, active: v }))} />
                  <Label>Active</Label>
                </div>
              </div>
              <div>
                <Label>Display Order</Label>
                <Input type="number" value={editQ.order || 0} onChange={e => setEditQ(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))} />
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
    </div>
  );
}