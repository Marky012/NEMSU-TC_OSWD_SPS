import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { STUDENT_CATEGORIES } from '@/lib/constants';
import apiClient from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { TooltipBox } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save, Send, Loader2, GraduationCap, ArrowLeft, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import AddressCascade from '@/components/form/AddressCascade';

const normalizeCategory = (cat) => {
  if (!cat) return cat;
  return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
};

const DynamicField = ({ question, value, onChange, error }) => {
  const options = question.options ? (Array.isArray(question.options) ? question.options : []) : [];

  const handleSelectChange = (val) => {
    onChange(val);
  };

  switch (question.field_type || question.fieldType) {
    case 'text':
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${(question.question_text || question.questionText || '').toLowerCase()}`}
        />
      );
    case 'number':
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
        />
      );
    case 'textarea':
      return (
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${(question.question_text || question.questionText || '').toLowerCase()}`}
        />
      );
    case 'date':
      return (
        <Input
          type="date"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'radio':
      return (
        <RadioGroup value={value || ''} onValueChange={onChange} className="flex flex-col gap-2">
          {options.map((opt) => (
            <div key={opt} className="flex items-center space-x-2">
              <RadioGroupItem value={opt} id={`${question.id}-${opt}`} className="text-[#143A7B]" />
              <Label htmlFor={`${question.id}-${opt}`} className="font-normal cursor-pointer text-sm">
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );
    case 'select':
    case 'dropdown':
      return (
        <Select value={value || ''} onValueChange={handleSelectChange}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case 'checkbox':
    case 'multi_select': {
      const selected = value ? (typeof value === 'string' ? JSON.parse(value) : value) : [];
      return (
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <div key={opt} className="flex items-center space-x-2">
              <Checkbox
                id={`${question.id}-${opt}`}
                checked={selected.includes(opt)}
                onCheckedChange={(checked) => {
                  const newVal = checked
                    ? [...selected, opt]
                    : selected.filter((v) => v !== opt);
                  onChange(JSON.stringify(newVal));
                }}
                className="text-[#143A7B]"
              />
              <Label htmlFor={`${question.id}-${opt}`} className="font-normal cursor-pointer text-sm">{opt}</Label>
            </div>
          ))}
        </div>
      );
    }
    default:
      return <Input value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }
};

const STEP_NAMES = [
  'Personal Information',
  'Indigenous Peoples (IP)',
  'Solo Parent & PWD',
  'Sports / Literary / Arts',
  'Internet & Digital Technology',
];

const BASE44_SECTIONS = [
  { id: 1, name: 'Personal Information', backendIds: [2, 3] },
  { id: 4, name: 'Indigenous Peoples (IP)', backendIds: [4] },
  { id: 5, name: 'Solo Parent & PWD', backendIds: [5] },
  { id: 6, name: 'Sports / Literary / Arts', backendIds: [6] },
  { id: 7, name: 'Internet & Digital Technology', backendIds: [7] },
];

const CATEGORY_ID_MAP = {};
BASE44_SECTIONS.forEach(sec => {
  sec.backendIds.forEach(bid => {
    CATEGORY_ID_MAP[bid] = sec.id;
  });
});

const ParticipationField = ({ value, onChange, error, minRows = 0 }) => {
  const COLUMNS = ["Event Participated", "Skills Competed (specify)", "Year", "Award (if any)"];
  const parsed = value ? (typeof value === 'string' ? JSON.parse(value) : value) : [];

  useEffect(() => {
    if (minRows > 0 && (!value || parsed.length === 0)) {
      const emptyRow = {};
      COLUMNS.forEach(col => { emptyRow[col] = ''; });
      onChange(JSON.stringify([emptyRow]));
    }
  }, []);

  const rows = value ? (typeof value === 'string' ? JSON.parse(value) : value) : [];

  const addRow = () => {
    const emptyRow = {};
    COLUMNS.forEach(col => { emptyRow[col] = ''; });
    const newRows = [...rows, emptyRow];
    onChange(JSON.stringify(newRows));
  };

  const updateRow = (index, col, val) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [col]: val };
    onChange(JSON.stringify(updated));
  };

  const removeRow = (index) => {
    const updated = rows.filter((_, i) => i !== index);
    onChange(JSON.stringify(updated));
  };

  const canRemove = rows.length > minRows;

  return (
    <div className="space-y-3">
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[#D4DDE8]/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-accent border-b border-[#D4DDE8]/40">
                {COLUMNS.map(col => (
                  <th key={col} className="px-3 py-2.5 text-left font-semibold text-xs text-gray-900 whitespace-nowrap">{col}</th>
                ))}
                <th className="w-12 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-[#D4DDE8]/40">
                  {COLUMNS.map(col => (
                    <td key={col} className="px-1.5 sm:px-2 py-1.5 sm:py-1">
                      <input
                        value={typeof row === 'string' ? row : (row[col] || '')}
                        onChange={(e) => updateRow(i, col, e.target.value.toUpperCase())}
                        className="w-full h-10 sm:h-9 text-sm text-gray-900 bg-muted border border-[#D4DDE8] rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-[#143A7B] focus:border-[#143A7B]"
                      />
                    </td>
                  ))}
                  <td className="px-1.5 py-1 text-center">
                    <TooltipBox label={canRemove ? 'Remove row' : 'At least one row required'}>
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        disabled={!canRemove}
                        className={`rounded-md p-1.5 transition-colors ${canRemove ? 'text-red-500 hover:bg-blue-100' : 'text-gray-300 cursor-not-allowed'}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TooltipBox>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={addRow} className="flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-[#143A7B] hover:bg-accent px-3 py-1.5 rounded-lg border border-solid border-[#D4DDE8]/40 transition-colors">
        <span className="text-lg leading-none">+</span> Add Row
      </button>
      {minRows > 0 && <p className="text-xs text-muted-foreground">At least {minRows} row(s) required</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

export default function ProfileForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeSemester, setActiveSemester] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [currentSection, setCurrentSection] = useState(0);
  const [submission, setSubmission] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const semRes = await apiClient.get('/forms/semesters/active');
      const sem = semRes.data;
      setActiveSemester(sem);

      const qRes = await apiClient.get('/forms/questions');
      setQuestions(qRes.data || []);

      const subRes = await apiClient.get('/students/active-submission');
      const sub = subRes.data;
      if (sub) {
        setSubmission(sub);
        if (sub.draft_data) {
          setAnswers(sub.draft_data);
        }
      }

      const profRes = await apiClient.get('/auth/profile');
      if (profRes.data?.category) {
        setSelectedCategory(profRes.data.category);
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    setLoading(false);
  };

  const handleCategorySelect = async (cat) => {
    const normalized = normalizeCategory(cat);
    setSelectedCategory(normalized);
    try {
      await apiClient.post('/auth/category', { category: normalized });
    } catch (e) {
      console.error('Failed to save category:', e);
    }
  };

  const resolveConditionalVisibility = (allQ, ans) => {
    const cache = {};
    const isVisible = (q) => {
      if (q.id in cache) return cache[q.id];
      if (!q.conditional_parent_question_id) {
        cache[q.id] = true;
        return true;
      }
      const parent = allQ.find(p => p.id === q.conditional_parent_question_id);
      if (!parent || !isVisible(parent)) {
        cache[q.id] = false;
        return false;
      }
      const parentAnswer = ans[parent.id];
      if (parentAnswer == null) {
        cache[q.id] = false;
        return false;
      }
      cache[q.id] = q.conditional_value === parentAnswer;
      return cache[q.id];
    };
    const visibleIds = new Set();
    allQ.forEach(q => { if (isVisible(q)) visibleIds.add(q.id); });
    return visibleIds;
  };

  const getVisibleQuestions = () => {
    if (!selectedCategory) return [];
    const categoryFiltered = questions.filter(q => {
      const cats = q.applicable_categories || ['all'];
      if (!cats.includes('all') && !cats.includes(selectedCategory)) return false;
      return true;
    });
    const condVisible = resolveConditionalVisibility(categoryFiltered, answers);
    return categoryFiltered.filter(q => condVisible.has(q.id));
  };

  const getSections = () => {
    const visible = getVisibleQuestions();
    const sectionMap = {};

    BASE44_SECTIONS.forEach(sec => {
      sectionMap[sec.id] = { id: sec.id, name: sec.name, questions: [], order: sec.id };
    });

    visible.forEach(q => {
      const rawId = q.category_id ?? q.category ?? q.category_name;
      const catId = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;
      const mappedId = CATEGORY_ID_MAP[catId] || 1;
      if (sectionMap[mappedId]) {
        sectionMap[mappedId].questions.push(q);
      }
    });

    return Object.values(sectionMap).filter(sec => sec.questions.length > 0);
  };

  const handleSaveDraft = async () => {
    const hasData = Object.values(answers).some(v => v !== '' && v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0));
    if (!hasData) {
      toast.error('Fill in at least one field before saving a draft');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/students/draft', {
        draft_data: answers,
      });
      toast.success('Draft saved');
    } catch (e) {
      const data = e.response?.data;
      let msg = 'Save failed';
      if (data) {
        if (typeof data.detail === 'string') msg = data.detail;
        else if (Array.isArray(data.detail)) msg = data.detail.map(d => d.msg).join(', ');
        else if (data.message) msg = data.message;
      }
      toast.error(msg);
    }
    setSaving(false);
  };

  const validate = () => {
    const errs = {};
    const visible = getVisibleQuestions();
    visible.forEach(q => {
      if (q.required) {
        const val = answers[q.id];
        if (!val) {
          errs[q.id] = 'This field is required';
        } else if (q.field_type === 'checkbox' || q.field_type === 'multi_select') {
          let selected;
          try { selected = typeof val === 'string' ? JSON.parse(val) : val; } catch { selected = []; }
          if (!Array.isArray(selected) || selected.length === 0) {
            errs[q.id] = 'This field is required';
          }
        }
      }
      if (q.field_type === 'table' && q.min_rows > 0 && answers[q.id]) {
        let rows;
        try {
          rows = typeof answers[q.id] === 'string' ? JSON.parse(answers[q.id]) : answers[q.id];
        } catch { rows = []; }
        if (!Array.isArray(rows) || rows.length < q.min_rows) {
          errs[q.id] = `At least ${q.min_rows} row(s) required`;
        }
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const answerList = Object.entries(answers).map(([question_id, answer_text]) => ({
        question_id: parseInt(question_id),
        answer_text: String(answer_text),
      }));
      const response = await apiClient.post('/students/submit', { answers: answerList });

      toast.success(`Form submitted! Ref: ${response.data.verification_code}`);
      navigate('/submissions');
    } catch (e) {
      const data = e.response?.data;
      let msg = 'Submission failed';
      if (data) {
        if (typeof data.detail === 'string') msg = data.detail;
        else if (Array.isArray(data.detail)) msg = data.detail.map(d => d.msg).join(', ');
        else if (data.message) msg = data.message;
      }
      toast.error(msg);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <div className="bg-white border border-border rounded-xl p-6 space-y-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!activeSemester) {
    return (
      <Card className="max-w-3xl mx-auto mt-12 shadow-sm">
        <CardContent className="p-6 sm:p-8 text-center">
          <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading text-xl font-bold">No Active Semester</h2>
          <p className="text-muted-foreground mt-2">The profiling period is currently closed. Please check back later.</p>
        </CardContent>
      </Card>
    );
  }

  if (submission?.is_final && submission?.status !== 'returned') {
    return (
      <Card className="max-w-3xl mx-auto mt-12 shadow-sm">
        <CardContent className="p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
            <Send className="w-7 h-7 text-[#143A7B]" />
          </div>
          <h2 className="font-heading text-xl font-bold">Already Submitted</h2>
          <p className="text-muted-foreground mt-2">You have already submitted your form for {activeSemester.label}.</p>
          <div className="bg-accent p-4 rounded-lg mt-4">
            <p className="text-xs text-muted-foreground">Reference Code</p>
            <p className="text-xl font-bold text-[#143A7B] font-mono">{submission.verification_code}</p>
          </div>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/submissions')}>
            View Submissions
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!selectedCategory) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <h1 className="font-heading text-2xl font-bold text-center mb-2">Select Your Category</h1>
        <p className="text-muted-foreground text-center mb-8">Choose the category that best describes your enrollment status.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STUDENT_CATEGORIES.map(cat => (
            <Card
              key={cat.value}
              className="cursor-pointer hover:shadow-md hover:border-[#143A7B]/50 transition-all border-2 border-transparent shadow-sm"
              onClick={() => handleCategorySelect(cat.value)}
            >
              <CardContent className="p-4 sm:p-6 text-center">
                <GraduationCap className="w-8 h-8 text-[#143A7B] mx-auto mb-3" />
                <h3 className="font-heading font-semibold">{cat.label}</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{cat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const sections = getSections();
  const currentSectionData = sections[currentSection];

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <motion.div variants={fadeIn}>
        <h1 className="font-heading text-2xl font-bold text-[#121B2B]">
          {activeSemester.label} Profiling
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {selectedCategory.replace('_', ' ')} Student
        </p>
      </motion.div>

      {submission?.status === 'returned' && submission?.admin_comment && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-medium text-amber-700">Admin Feedback — Please correct the following:</p>
          <p className="text-sm text-amber-800 mt-1">{submission.admin_comment}</p>
        </div>
      )}

      {/* Section Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {sections.map((sec, i) => (
          <button
            key={sec.id}
            onClick={() => setCurrentSection(i)}
            className={`px-3 sm:px-4 py-2 text-sm font-medium transition-all whitespace-nowrap rounded-lg ${i === currentSection
                ? 'bg-[#143A7B] text-white shadow-sm'
                : 'bg-[#D4DDE8] text-muted-foreground hover:text-foreground'
              }`}
          >
            <span className={`mr-1.5 font-bold ${i === currentSection ? 'text-white/80' : 'text-muted-foreground'}`}>{i + 1}.</span>
            {sec.name}
          </button>
        ))}
      </div>

      {/* Form Card */}
      <Card className="w-full border-0 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-2 pt-7 px-4 sm:px-7">
          <CardTitle className="text-lg font-heading text-[#102D60]">{currentSectionData?.name}</CardTitle>
          {currentSectionData?.name === 'Personal Information' && (
            <p className="text-sm text-muted-foreground mt-0.5">Basic personal and demographic information</p>
          )}
          {currentSectionData?.name === 'Indigenous Peoples (IP)' && (
            <p className="text-sm text-muted-foreground mt-0.5">IP group membership</p>
          )}
          {currentSectionData?.name === 'Solo Parent & PWD' && (
            <p className="text-sm text-muted-foreground mt-0.5">Solo parent and PWD status</p>
          )}
          {currentSectionData?.name === 'Sports / Literary / Arts' && (
            <p className="text-sm text-muted-foreground mt-0.5">Co-curricular participation (New/Transferee/Returnee only)</p>
          )}
          {currentSectionData?.name === 'Internet & Digital Technology' && (
            <p className="text-sm text-muted-foreground mt-0.5">Digital access and connectivity information</p>
          )}
        </CardHeader>
        <CardContent className="space-y-5 px-4 sm:px-7 pb-7 pt-5">
          {currentSectionData?.questions.map(q => {
            const addressKeys = ['region', 'municipality', 'barangay_name', 'present_home_address'];
            if (addressKeys.includes(q.system_key)) {
              if (q.system_key === 'region') {
                const munQ = currentSectionData.questions.find(qq => qq.system_key === 'municipality');
                const brgyQ = currentSectionData.questions.find(qq => qq.system_key === 'barangay_name');
                const addrQ = currentSectionData.questions.find(qq => qq.system_key === 'present_home_address');
                return (
                  <div key="address-cascade" className="space-y-1.5">
                    <Label className="text-sm font-semibold text-foreground">
                      Address <span className="text-red-500 ml-0.5">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground mb-1">Select your complete Philippine address</p>
                    <AddressCascade
                      regionValue={answers[q.id]}
                      municipalityValue={answers[munQ?.id]}
                      barangayValue={answers[brgyQ?.id]}
                      addressValue={answers[addrQ?.id]}
                      onRegionChange={val => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                      onMunicipalityChange={val => setAnswers(prev => ({ ...prev, [munQ?.id]: val }))}
                      onBarangayChange={val => setAnswers(prev => ({ ...prev, [brgyQ?.id]: val }))}
                      onAddressChange={val => setAnswers(prev => ({ ...prev, [addrQ?.id]: val }))}
                      error={errors[q.id] || errors[munQ?.id] || errors[brgyQ?.id] || errors[addrQ?.id]}
                    />
                  </div>
                );
              }
              return null;
            }

            return (
              <div key={q.id} className="space-y-1.5">
                <Label className="text-sm font-semibold text-foreground">
                  {q.question_text || q.questionText}
                  {q.required && <span className="text-red-500 ml-0.5">*</span>}
                </Label>
                {q.system_key === 'participation_in_sports_arts' && q.min_rows > 0 && (
                  <p className="text-xs text-muted-foreground">Add at least {q.min_rows} row(s) for each event you have participated in</p>
                )}
                {q.system_key === 'participation_in_sports_arts' ? (
                  <ParticipationField
                    value={answers[q.id]}
                    onChange={val => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                    error={errors[q.id]}
                    minRows={q.min_rows}
                  />
                ) : (
                  <DynamicField
                    question={q}
                    value={answers[q.id]}
                    onChange={val => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                    error={errors[q.id]}
                  />
                )}
                {q.system_key === 'birthdate' && (
                  <p className="text-xs italic text-muted-foreground mt-1">Your age will be calculated automatically</p>
                )}
                {errors[q.id] && (
                  <p className="text-xs text-destructive">{errors[q.id]}</p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={currentSection === 0}
          onClick={() => setCurrentSection(prev => prev - 1)}
          className="border-[#D4DDE8] text-muted-foreground hover:bg-accent hover:text-[#143A7B] rounded-lg"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        <Button
          variant="outline"
          onClick={handleSaveDraft}
          disabled={saving}
          className="border-[#D4DDE8] text-[#121B2B] hover:bg-accent hover:text-[#143A7B] rounded-lg"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Save Draft
        </Button>
        {currentSection < sections.length - 1 ? (
          <Button onClick={() => setCurrentSection(prev => prev + 1)}>
            Next <span className="ml-1">&rarr;</span>
          </Button>
        ) : (
          <Button onClick={() => { if (validate()) setShowSubmitDialog(true); else toast.error('Please fill in all required fields'); }} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Submit
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        onConfirm={handleSubmit}
        title="Submit Profiling Form"
        description="Once submitted, your answers will be finalized and cannot be edited. Are you sure you want to submit?"
        confirmLabel="Submit"
        loading={submitting}
      />
    </motion.div>
    </AnimatedPage>
  );
}