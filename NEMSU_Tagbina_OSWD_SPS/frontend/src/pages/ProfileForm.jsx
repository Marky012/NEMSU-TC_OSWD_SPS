import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { STUDENT_CATEGORIES } from '@/lib/constants';
import apiClient from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Save, Send, Loader2, ArrowLeft, ArrowRight, GraduationCap } from 'lucide-react';

// Simplified field renderer
const DynamicField = ({ question, value, onChange, error }) => {
  const options = question.options ? JSON.parse(question.options) : [];
  
  switch (question.fieldType) {
    case 'text':
      return (
        <Input
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${question.questionText.toLowerCase()}`}
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
          placeholder={`Enter ${question.questionText.toLowerCase()}`}
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
        <RadioGroup value={value || ''} onValueChange={onChange} className="space-y-2">
          {options.map((opt) => (
            <div key={opt} className="flex items-center space-x-2">
              <RadioGroupItem value={opt} id={`${question.id}-${opt}`} />
              <Label htmlFor={`${question.id}-${opt}`} className="font-normal cursor-pointer">
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      );
    case 'dropdown':
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    default:
      return <Input value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }
};

export default function ProfileForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activeSemester, setActiveSemester] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [currentSection, setCurrentSection] = useState(0);
  const [submission, setSubmission] = useState(null);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      // Fetch active semester
      const semRes = await apiClient.get('/semesters/active');
      const sem = semRes.data;
      setActiveSemester(sem);

      // Fetch questions for this semester
      const qRes = await apiClient.get('/questions', {
        params: { semesterId: sem?.id }
      });
      setQuestions(qRes.data || []);

      // Fetch existing submission (draft)
      const subRes = await apiClient.get('/submissions/draft');
      const sub = subRes.data;
      if (sub) {
        setSubmission(sub);
        if (sub.draftData) {
          setAnswers(sub.draftData);
        }
        if (sub.category) {
          setSelectedCategory(sub.category);
        }
      }

      // Fetch user profile for category
      const profRes = await apiClient.get('/profile');
      if (profRes.data?.category) {
        setSelectedCategory(profRes.data.category);
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
    setLoading(false);
  };

  const handleCategorySelect = async (cat) => {
    setSelectedCategory(cat);
    try {
      await apiClient.post('/profile/category', { category: cat });
    } catch (e) {
      console.error('Failed to save category:', e);
    }
  };

  const getVisibleQuestions = () => {
    if (!selectedCategory) return [];
    return questions.filter(q => {
      const cats = q.applicableCategories ? JSON.parse(q.applicableCategories) : ['all'];
      if (!cats.includes('all') && !cats.includes(selectedCategory)) return false;
      return true;
    });
  };

  const getSections = () => {
    const visible = getVisibleQuestions();
    const sections = {};
    visible.forEach(q => {
      const catId = q.categoryId || 'default';
      if (!sections[catId]) sections[catId] = { id: catId, name: q.categoryName || 'General', questions: [] };
      sections[catId].questions.push(q);
    });
    return Object.values(sections);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await apiClient.post('/submissions/draft', {
        semesterId: activeSemester?.id,
        draftData: answers,
        category: selectedCategory,
      });
      toast({ title: 'Draft saved' });
    } catch (e) {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
    setSaving(false);
  };

  const validate = () => {
    const errs = {};
    const visible = getVisibleQuestions();
    visible.forEach(q => {
      if (q.required && !answers[q.id]) {
        errs[q.id] = 'This field is required';
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post('/submissions', {
        semesterId: activeSemester?.id,
        profileData: answers,
        category: selectedCategory,
        isFinal: true,
      });

      toast({ 
        title: 'Form submitted successfully!', 
        description: `Your reference code: ${response.data.verificationCode}` 
      });
      navigate('/submissions');
    } catch (e) {
      toast({ title: 'Submission failed', description: e.response?.data?.message || 'Please try again.', variant: 'destructive' });
    }
    setSubmitting(false);
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
          <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-heading text-xl font-bold">No Active Semester</h2>
          <p className="text-muted-foreground mt-2">The profiling period is currently closed. Please check back later.</p>
        </CardContent>
      </Card>
    );
  }

  // Check if already submitted
  if (submission?.isFinal) {
    return (
      <Card className="max-w-lg mx-auto mt-12">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
            <Send className="w-7 h-7 text-primary" />
          </div>
          <h2 className="font-heading text-xl font-bold">Already Submitted</h2>
          <p className="text-muted-foreground mt-2">You have already submitted your form for {activeSemester.label}.</p>
          <div className="bg-accent p-4 rounded-lg mt-4">
            <p className="text-xs text-muted-foreground">Reference Code</p>
            <p className="text-xl font-bold text-primary font-mono">{submission.verificationCode}</p>
          </div>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/submissions')}>
            View Submissions
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Category selection step
  if (!selectedCategory) {
    return (
      <div className="max-w-lg mx-auto mt-8">
        <h1 className="font-heading text-2xl font-bold text-center mb-2">Select Your Category</h1>
        <p className="text-muted-foreground text-center mb-8">Choose the category that best describes your enrollment status.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {STUDENT_CATEGORIES.map(cat => (
            <Card
              key={cat.value}
              className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
              onClick={() => handleCategorySelect(cat.value)}
            >
              <CardContent className="p-6 text-center">
                <GraduationCap className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-heading font-semibold">{cat.label}</h3>
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
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold">{activeSemester.label} Profiling</h1>
        <p className="text-muted-foreground text-sm mt-1 capitalize">
          {selectedCategory.replace('_', ' ')} Student
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex overflow-x-auto gap-1 pb-2">
        {sections.map((sec, i) => (
          <button
            key={sec.id}
            onClick={() => setCurrentSection(i)}
            className={`
              px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0
              ${i === currentSection
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-accent'
              }
            `}
          >
            {i + 1}. {sec.name}
          </button>
        ))}
      </div>

      {/* Current section */}
      {currentSectionData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-heading">{currentSectionData.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentSectionData.questions.map(q => (
              <div key={q.id} className="space-y-2">
                <Label className="text-sm font-medium">
                  {q.questionText}
                  {q.required && <span className="text-destructive ml-0.5">*</span>}
                </Label>
                <DynamicField
                  question={q}
                  value={answers[q.id]}
                  onChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}
                  error={errors[q.id]}
                />
                {errors[q.id] && (
                  <p className="text-xs text-destructive">{errors[q.id]}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button
          variant="outline"
          disabled={currentSection === 0}
          onClick={() => setCurrentSection(prev => prev - 1)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Previous
        </Button>

        <Button variant="ghost" onClick={handleSaveDraft} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
          Save Draft
        </Button>

        {currentSection < sections.length - 1 ? (
          <Button onClick={() => setCurrentSection(prev => prev + 1)}>
            Next <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} className="bg-primary">
            {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Submit Form
          </Button>
        )}
      </div>
    </div>
  );
}