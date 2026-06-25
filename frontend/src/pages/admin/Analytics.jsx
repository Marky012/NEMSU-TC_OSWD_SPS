import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton } from '@/components/ui/skeleton';
import apiClient from '@/api/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { TooltipBox } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Search, Download, Users, RefreshCw, Filter, X, Eye } from 'lucide-react';
import { toUpperDisplay } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const COLORS = ['#1e40af', '#d97706', '#2d7fc1', '#8b5cf6', '#e85d3a', '#d94480', '#0ea5e9', '#84cc16'];

export default function Analytics() {
  const [submissions, setSubmissions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedSem, setSelectedSem] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupTab, setGroupTab] = useState('all');
  const [expandedGroup, setExpandedGroup] = useState(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [viewSub, setViewSub] = useState(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [subs, qs, sems] = await Promise.all([
        apiClient.get('/admin/submissions'),
        apiClient.get('/forms/questions'),
        apiClient.get('/admin/semesters'),
      ]);
      setSubmissions(subs.data);
      setQuestions(qs.data);
      setSemesters(sems.data);
      const active = sems.data.find(s => s.is_active);
      if (active) setSelectedSem(active.id);
    } catch (e) { console.error(e); }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(true), 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  const filteredSubs = useMemo(() => {
    return selectedSem ? submissions.filter(s => s.semester_id === selectedSem) : submissions;
  }, [submissions, selectedSem]);

  const getAnswerStats = (textFragment) => {
    const q = questions.find(qq => qq.question_text?.includes(textFragment));
    if (!q) return [];
    const counts = {};
    filteredSubs.forEach(sub => {
      if (!sub.draft_data_json) return;
      try {
        const data = JSON.parse(sub.draft_data_json);
        const val = data[q.id] || data[String(q.id)];
        if (val) {
          if (typeof val === 'string' && val.startsWith('[')) {
            try {
              JSON.parse(val).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
            } catch { counts[val] = (counts[val] || 0) + 1; }
          } else {
            counts[val] = (counts[val] || 0) + 1;
          }
        }
      } catch { /* skip */ }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  const getIpGroupData = () => {
    const noneQ = questions.find(q => q.question_text?.includes('Do you belong to an Indigenous Peoples'));
    const groupQ = questions.find(q => q.question_text?.includes('Select your IP group'));
    if (!noneQ && !groupQ) return [];
    const counts = {};
    filteredSubs.forEach(sub => {
      if (!sub.draft_data_json) return;
      try {
        const data = JSON.parse(sub.draft_data_json);
        const belongs = data[noneQ?.id] || data[String(noneQ?.id)];
        if (belongs === 'I do not belong to IP') {
          counts['Non-IP'] = (counts['Non-IP'] || 0) + 1;
        } else if (groupQ) {
          const group = data[groupQ.id] || data[String(groupQ.id)];
          if (group) {
            counts[group] = (counts[group] || 0) + 1;
          } else {
            counts['Not Specified'] = (counts['Not Specified'] || 0) + 1;
          }
        } else {
          counts['Not Specified'] = (counts['Not Specified'] || 0) + 1;
        }
      } catch { /* skip */ }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  const getHouseholdIncomeData = () => {
    const q = questions.find(qq => qq.question_text?.includes('Estimated Household Income'));
    if (!q) return [];
    const brackets = { 'Below 5K': 0, '5K-9,999': 0, '10,000-19,999': 0, '20,000-29,999': 0, '30,000-49,999': 0, '50,000-99,999': 0, '100K & above': 0 };
    filteredSubs.forEach(sub => {
      if (!sub.draft_data_json) return;
      try {
        const data = JSON.parse(sub.draft_data_json);
        const val = parseFloat(data[q.id] || data[String(q.id)]);
        if (isNaN(val)) return;
        if (val < 5000) brackets['Below 5K']++;
        else if (val < 10000) brackets['5K-9,999']++;
        else if (val < 20000) brackets['10,000-19,999']++;
        else if (val < 30000) brackets['20,000-29,999']++;
        else if (val < 50000) brackets['30,000-49,999']++;
        else if (val < 100000) brackets['50,000-99,999']++;
        else brackets['100K & above']++;
      } catch { /* skip */ }
    });
    return Object.entries(brackets).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  };

  // --- Section B: Group Lookup Helpers ---
  const sysKeyMap = useMemo(() => {
    const map = {};
    questions.forEach(q => { if (q.system_key) map[q.system_key] = q.id; });
    return map;
  }, [questions]);

  const getAnswer = (sub, systemKey) => {
    if (!sub.draft_data_json) return null;
    try {
      const data = JSON.parse(sub.draft_data_json);
      const qId = sysKeyMap[systemKey];
      return qId != null ? (data[qId] ?? data[String(qId)] ?? null) : null;
    } catch { return null; }
  };

  const getStudentName = (sub) => {
    const last = getAnswer(sub, 'surname') || '';
    const first = getAnswer(sub, 'first_name') || '';
    const middle = getAnswer(sub, 'middle_name') || '';
    const mid = middle ? ` ${middle.charAt(0)}.` : '';
    if (last || first) return toUpperDisplay(`${last}, ${first}${mid}`);
    return sub.student_email?.split('@')[0] || 'Student';
  };

  const GROUPS = [
    { id: 'all_ip', title: 'All IP Students', description: 'Belong to any Indigenous Peoples group', tab: 'ip', check: (sub) => { const g = getAnswer(sub, 'indigenous_peoples_group'); return !!g && g !== 'Others'; } },
    { id: 'blaan', title: 'Blaan', description: 'IP Group: Blaan', tab: 'ip', check: (sub) => getAnswer(sub, 'indigenous_peoples_group') === 'BLAAN' },
    { id: 'mandaya', title: 'Mandaya', description: 'IP Group: Mandaya', tab: 'ip', check: (sub) => getAnswer(sub, 'indigenous_peoples_group') === 'MANDAYA' },
    { id: 'manobo', title: 'Manobo', description: 'IP Group: Manobo', tab: 'ip', check: (sub) => getAnswer(sub, 'indigenous_peoples_group') === 'MANOBO' },
    { id: 'bukidnon', title: 'Bukidnon', description: 'IP Group: Bukidnon', tab: 'ip', check: (sub) => getAnswer(sub, 'indigenous_peoples_group') === 'BUKIDNON' },
    { id: 'subanen', title: 'Subanen', description: 'IP Group: Subanen', tab: 'ip', check: (sub) => getAnswer(sub, 'indigenous_peoples_group') === 'SUBANEN' },
    { id: 'tboli', title: "T'boli", description: "IP Group: T'boli", tab: 'ip', check: (sub) => getAnswer(sub, 'indigenous_peoples_group') === "T'BOLI" },
    { id: 'mamanwa', title: 'Mamanwa', description: 'IP Group: Mamanwa', tab: 'ip', check: (sub) => getAnswer(sub, 'indigenous_peoples_group') === 'MAMANWA' },
    { id: 'mangyan', title: 'Mangyan', description: 'IP Group: Mangyan', tab: 'ip', check: (sub) => getAnswer(sub, 'indigenous_peoples_group') === 'MANGYAN' },
    { id: 'low_income', title: 'Low Income', description: 'Household income below ₱5,000/month', tab: 'socio', check: (sub) => { const i = parseFloat(getAnswer(sub, 'estimated_household_income')); return !isNaN(i) && i < 5000; } },
    { id: 'mid_income', title: 'Mid Income', description: 'Household income ₱5,000–₱15,000/month', tab: 'socio', check: (sub) => { const i = parseFloat(getAnswer(sub, 'estimated_household_income')); return !isNaN(i) && i >= 5000 && i <= 15000; } },
    { id: 'pwd', title: 'Person with Disability (PWD)', description: 'Declared as PWD', tab: 'special', check: (sub) => getAnswer(sub, 'is_pwd') === 'Yes' },
    { id: 'solo_parent', title: 'Solo Parent / Child of Solo Parent', description: 'Is a solo parent or child of a solo parent', tab: 'special', check: (sub) => getAnswer(sub, 'is_solo_parent_currently_studying') === 'Yes' || getAnswer(sub, 'is_child_of_solo_parent') === 'Yes' },
    { id: 'dormitory', title: 'Campus Dormitory Residents', description: 'Primary mode: campus dormitory', tab: 'residence', check: (sub) => getAnswer(sub, 'primary_mode_of_residence') === 'Campus Dormitory' },
    { id: 'commuter', title: 'Commuters (with family)', description: 'Commuting with family', tab: 'residence', check: (sub) => getAnswer(sub, 'primary_mode_of_residence') === 'Commuter with family' },
    { id: 'off_campus', title: 'Off-Campus Apartment', description: 'Living off-campus in an apartment', tab: 'residence', check: (sub) => getAnswer(sub, 'primary_mode_of_residence') === 'Off-Campus Apartment' },
    { id: 'no_internet', title: 'No Internet Access', description: 'Reported having no internet access', tab: 'digital', check: (sub) => { const ct = getAnswer(sub, 'cellphone_type'); if (ct === 'Basic Phone') return true; const acc = getAnswer(sub, 'internet_access_method'); if (acc) { try { return JSON.parse(acc).includes('No access'); } catch { return acc === 'No access'; } } return false; } },
    { id: 'poor_internet', title: 'Poor Internet Reliability', description: 'Rated internet as Poor or Very Poor', tab: 'digital', check: (sub) => { const r = getAnswer(sub, 'internet_speed_rating'); return r === 'Poor' || r === 'Very Poor'; } },
    { id: 'female', title: 'Female Students', description: 'Gender: Female', tab: 'gender', check: (sub) => getAnswer(sub, 'gender') === 'Female' },
    { id: 'male', title: 'Male Students', description: 'Gender: Male', tab: 'gender', check: (sub) => getAnswer(sub, 'gender') === 'Male' },
    { id: 'lgbt', title: 'LGBT Students', description: 'Gender: LGBT', tab: 'gender', check: (sub) => getAnswer(sub, 'gender') === 'LGBT' },
    { id: 'new_student', title: 'New Students', description: 'Student category: New', tab: 'category', check: (sub) => sub.student_category === 'New' },
    { id: 'transferee', title: 'Transferees', description: 'Student category: Transferee', tab: 'category', check: (sub) => sub.student_category === 'Transferee' },
    { id: 'returnee', title: 'Returnees', description: 'Student category: Returnee', tab: 'category', check: (sub) => sub.student_category === 'Returnee' },
    { id: 'continuing', title: 'Continuing Students', description: 'Student category: Continuing', tab: 'category', check: (sub) => sub.student_category === 'Continuing' },
  ];

  const groupSubs = useMemo(() => {
    const map = {};
    GROUPS.forEach(g => { map[g.id] = []; });
    filteredSubs.forEach(sub => {
      GROUPS.forEach(g => { if (g.check(sub)) map[g.id].push(sub); });
    });
    return map;
  }, [filteredSubs, questions]);

  const TAB_LABELS = { all: 'All', ip: 'IP & Ethnicity', socio: 'Socioeconomic', special: 'Special Groups', residence: 'Residence', digital: 'Digital Access', gender: 'Gender', category: 'Student Category' };
  const TAB_KEYS = ['all', 'ip', 'socio', 'special', 'residence', 'digital', 'gender', 'category'];

  const visibleGroups = GROUPS.filter(g => groupTab === 'all' || g.tab === groupTab);

  const expandedData = useMemo(() => {
    if (!expandedGroup) return [];
    const subs = groupSubs[expandedGroup] || [];
    if (!groupSearch) return subs;
    const q = groupSearch.toLowerCase();
    return subs.filter(sub => getStudentName(sub).toLowerCase().includes(q));
  }, [expandedGroup, groupSubs, groupSearch, questions]);

  const exportGroupCsv = () => {
    if (!expandedGroup) return;
    const subs = groupSubs[expandedGroup] || [];
    const headers = ['Name', 'Email', 'Program', 'Year', 'Category', 'Status'];
    const rows = subs.map(sub => [
      getStudentName(sub),
      sub.student_email || '',
      getAnswer(sub, 'program') || '',
      getAnswer(sub, 'year_level') || '',
      sub.student_category || '',
      sub.status || 'Pending',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date().toISOString().slice(0, 10);
    a.download = `${expandedGroup}_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[320px] w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const genderData = getAnswerStats('Gender');
  const pwdData = getAnswerStats('Person with Disability');
  const internetData = getAnswerStats('Internet Reliability');
  const modalityData = getAnswerStats('Preferred Learning Modality');
  const gadgetData = getAnswerStats('Gadgets Owned');
  const residenceData = getAnswerStats('Primary Mode of Residence');
  const networkData = getAnswerStats('Satisfied Mobile Network');
  const wifiData = getAnswerStats('campus Wi-Fi');
  const ipGroupData = getIpGroupData();
  const householdIncomeData = getHouseholdIncomeData();

  const chartSections = [
    { title: 'Gender Distribution', data: genderData, type: 'pie' },
    { title: 'PWD Status', data: pwdData, type: 'pie' },
    { title: 'IP Group Distribution', data: ipGroupData, type: 'pie' },
    { title: 'Household Income Brackets', data: householdIncomeData, type: 'bar' },
    { title: 'Internet Reliability', data: internetData, type: 'bar' },
    { title: 'Preferred Learning Modality', data: modalityData, type: 'bar' },
    { title: 'Gadgets Owned', data: gadgetData, type: 'pie' },
    { title: 'Primary Residence', data: residenceData, type: 'bar' },
    { title: 'Mobile Network Preference', data: networkData, type: 'pie' },
    { title: 'Campus Wi-Fi Usage', data: wifiData, type: 'bar' },
  ];

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn} className="flex items-start sm:items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">{filteredSubs.length} submissions analyzed</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedSem} onValueChange={setSelectedSem}>
            <SelectTrigger className="w-full sm:w-[220px] pr-8"><SelectValue placeholder="Select Semester">{selectedSem ? semesters.find(s => s.id === selectedSem)?.label : ''}</SelectValue></SelectTrigger>
            <SelectContent>
              {semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <TooltipBox label="Refresh data">
            <Button variant="outline" size="sm" onClick={() => loadData()} disabled={refreshing} className="gap-1.5 rounded-full">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipBox>
        </div>
      </motion.div>

      <motion.div variants={fadeIn} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {refreshing ? Array.from({ length: 10 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[260px] w-full rounded-lg" />
            </CardContent>
          </Card>
        )) : chartSections.map(({ title, data, type }) => (
          <Card key={title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  {type === 'pie' ? (
                    <PieChart>
                      <Pie data={data} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  ) : (
                      <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* ===== SECTION B: STUDENT GROUP LOOKUP ===== */}
      <motion.div variants={fadeIn} className="pt-6 border-t border-border">
        <div className="flex items-center gap-2 mb-5">
          <Filter className="w-5 h-5 text-muted-foreground shrink-0" />
          <h2 className="font-heading text-lg font-bold">Student Group Lookup</h2>
          <span className="text-muted-foreground text-sm hidden sm:inline">&mdash; Click a group to list its students</span>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TAB_KEYS.map(key => (
            <button
              key={key}
              onClick={() => { setGroupTab(key); setExpandedGroup(null); setGroupSearch(''); }}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors whitespace-nowrap border ${groupTab === key ? 'bg-sidebar-primary border-sidebar-primary text-sidebar-primary-foreground' : 'bg-transparent border-gray-300 text-foreground hover:bg-gray-100'}`}
            >
              {TAB_LABELS[key]}
            </button>
          ))}
        </div>

        {/* Group Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {visibleGroups.map(g => {
            const count = (groupSubs[g.id] || []).length;
            const isExpanded = expandedGroup === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setExpandedGroup(isExpanded ? null : g.id)}
                className={`text-left border rounded-xl p-4 transition-all cursor-pointer hover:shadow-md ${isExpanded ? 'bg-blue-50 border-2 border-sidebar-primary shadow-sm' : 'bg-white border border-border shadow-sm'}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{g.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{g.description}</p>
                  <div className="mt-2">
                    <span className={`text-xl font-bold ${isExpanded ? 'text-sidebar-primary' : 'text-foreground'}`}>{count}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Expanded Detail Section */}
        {expandedGroup && (() => {
          const g = GROUPS.find(gr => gr.id === expandedGroup);
          if (!g) return null;
          const subs = groupSubs[expandedGroup] || [];
          const displayData = expandedData || [];
          return (
            <div className="mt-6 bg-white border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="p-5 border-b border-border">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-heading font-bold text-lg">{g.title}</h3>
                    <p className="text-sm text-muted-foreground">{g.description} &mdash; <span className="font-semibold text-foreground">{subs.length} students</span></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Search name..." value={groupSearch} onChange={e => setGroupSearch(e.target.value)} className="pl-9 h-9 w-full sm:w-56 text-sm" />
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5 whitespace-nowrap rounded-lg" onClick={exportGroupCsv}>
                      <Download className="w-3.5 h-3.5" /> Export CSV
                    </Button>
                    <button onClick={() => { setExpandedGroup(null); setGroupSearch(''); }} className="p-1.5 rounded-full hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors" title="Close">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F1F5F9] border-b border-border">
                      <th className="p-3 text-left font-medium text-xs text-muted-foreground w-10">#</th>
                      <th className="p-3 text-left font-medium text-xs text-muted-foreground">Name</th>
                      <th className="p-3 text-left font-medium text-xs text-muted-foreground">Program / Course</th>
                      <th className="p-3 text-left font-medium text-xs text-muted-foreground">Year</th>
                      <th className="p-3 text-left font-medium text-xs text-muted-foreground">Category</th>
                      <th className="p-3 text-left font-medium text-xs text-muted-foreground">Status</th>
                      <th className="p-3 text-center font-medium text-xs text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          No students found
                        </td>
                      </tr>
                    ) : displayData.map((sub, i) => (
                      <tr key={sub.id} className={`border-b border-border/50 ${i % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'}`}>
                        <td className="p-3 text-muted-foreground text-xs">{i + 1}</td>
                        <td className="p-3 font-medium text-sm">{getStudentName(sub)}</td>
                        <td className="p-3 text-sm">{toUpperDisplay(getAnswer(sub, 'program')) || 'N/A'}</td>
                        <td className="p-3 text-sm">{toUpperDisplay(getAnswer(sub, 'year_level')) || 'N/A'}</td>
                        <td className="p-3 text-sm">{toUpperDisplay(sub.student_category) || 'N/A'}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${sub.status === 'verified' ? 'bg-green-100 text-green-700' : sub.status === 'returned' ? 'bg-amber-100 text-amber-700' : sub.status === 'declined' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {sub.status === 'verified' ? 'Verified' : sub.status === 'returned' ? 'Returned' : sub.status === 'declined' ? 'Declined' : 'Pending'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button onClick={() => setViewSub(sub)} className="p-1.5 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors" title="View details">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

      {/* Student Detail Modal */}
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
              {viewSub.draft_data_json && (
                <div className="border-t pt-3 space-y-2">
                  {Object.entries(JSON.parse(viewSub.draft_data_json)).map(([qId, val]) => {
                    const q = questions.find(qq => String(qq.id) === qId || qq.system_key === qId);
                    const rawVal = !val ? 'N/A' : Array.isArray(val) ? val.map(item => typeof item === 'object' ? Object.values(item).join(' — ') : String(item)).join('; ') : typeof val === 'object' ? JSON.stringify(val) : (typeof val === 'string' && val.startsWith('[') ? (() => { try { return JSON.parse(val).map(item => typeof item === 'object' ? Object.values(item).join(' — ') : String(item)).join('; '); } catch { return val; } })() : val);
                    const displayVal = toUpperDisplay(rawVal);
                    return (
                      <div key={qId} className="flex flex-col sm:flex-row gap-1 py-1.5 border-b border-border/30 last:border-0">
                        <span className="text-xs font-medium text-muted-foreground sm:w-1/2">{q?.question_text || qId}</span>
                        <span className="text-sm">{displayVal}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
    </motion.div>
    </AnimatedPage>
  );
}
