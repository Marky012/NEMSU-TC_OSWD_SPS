import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import apiClient from '@/api/apiClient';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, ArrowDown, FileText, BookOpen, BarChart3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function CHEDReports() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedSem, setSelectedSem] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('consolidated');
  const [downloadTarget, setDownloadTarget] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
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
  };

  const filteredSubs = useMemo(() => {
    return selectedSem ? submissions.filter(s => s.semester_id === selectedSem) : submissions;
  }, [submissions, selectedSem]);

  const currentSemester = useMemo(() => {
    return semesters.find(s => s.id === selectedSem);
  }, [semesters, selectedSem]);

  const formatSemesterLabel = (label) => {
    if (!label) return '';
    const match = label.match(/AY\s+(\d{4})-(\d{4})\s+(.+)/);
    if (match) return `${match[3]} ${match[1]}-${match[2]}`;
    return label;
  };

  const semLabel = formatSemesterLabel(currentSemester?.label) || 'No semester selected';

  const findQuestionByKey = (systemKey) => questions.find(q => q.system_key === systemKey);

  const getAnswerByKey = (sub, systemKey) => {
    const q = findQuestionByKey(systemKey);
    if (!q || !sub.draft_data_json) return null;
    try {
      const data = JSON.parse(sub.draft_data_json);
      return data[q.id] || data[String(q.id)] || null;
    } catch { return null; }
  };

  const getPWDCount = useMemo(() => {
    let count = 0;
    filteredSubs.forEach(sub => {
      if (getAnswerByKey(sub, 'is_pwd') === 'Yes') count++;
    });
    return count;
  }, [filteredSubs, questions]);

  const getIPCount = useMemo(() => {
    let count = 0;
    filteredSubs.forEach(sub => {
      if (getAnswerByKey(sub, 'indigenous_peoples_none') === 'Yes') count++;
    });
    return count;
  }, [filteredSubs, questions]);

  const getSoloParentCounts = useMemo(() => {
    let soloParent = 0, childOfSolo = 0;
    filteredSubs.forEach(sub => {
      if (getAnswerByKey(sub, 'is_solo_parent_currently_studying') === 'Yes') soloParent++;
      if (getAnswerByKey(sub, 'is_child_of_solo_parent') === 'Yes') childOfSolo++;
    });
    return { soloParent, childOfSolo };
  }, [filteredSubs, questions]);

  const totalStudents = filteredSubs.length;
  const pwdPct = totalStudents > 0 ? ((getPWDCount / totalStudents) * 100).toFixed(1) : '0.0';
  const ipPct = totalStudents > 0 ? ((getIPCount / totalStudents) * 100).toFixed(1) : '0.0';

  const consolidatedData = useMemo(() => {
    const sexCounts = { Male: 0, Female: 0 };
    const yearCounts = { '1st': 0, '2nd': 0, '3rd': 0, '4th': 0, '5th': 0, '6th': 0 };
    const disabilityTypes = {};
    let ipTotal = 0;
    let soloParentTotal = 0;
    let childOfSoloParent = 0;
    let seniorCitizen = 0, magnaCartaPoor = 0, underprivileged = 0;

    filteredSubs.forEach(sub => {
      const sex = getAnswerByKey(sub, 'gender');
      if (sex === 'Male') sexCounts.Male++;
      else if (sex === 'Female') sexCounts.Female++;

      let year = getAnswerByKey(sub, 'year_level');
      if (year) {
        year = year.split(' ')[0];
        if (yearCounts[year] !== undefined) yearCounts[year]++;
      }

      const isPWD = getAnswerByKey(sub, 'is_pwd');
      if (isPWD === 'Yes') {
        const types = getAnswerByKey(sub, 'pwd_disability_type');
        if (types) {
          try {
            const arr = JSON.parse(types);
            arr.forEach(t => { disabilityTypes[t] = (disabilityTypes[t] || 0) + 1; });
          } catch {}
        }
      }

      if (getAnswerByKey(sub, 'indigenous_peoples_none') === 'Yes') ipTotal++;
      if (getAnswerByKey(sub, 'is_solo_parent_currently_studying') === 'Yes') soloParentTotal++;
      if (getAnswerByKey(sub, 'is_child_of_solo_parent') === 'Yes') childOfSoloParent++;
      if (sub.is_senior_citizen) seniorCitizen++;
      if (sub.is_magna_carta_poor) magnaCartaPoor++;
      if (sub.is_underprivileged) underprivileged++;
    });

    const pwdTotal = Object.values(disabilityTypes).reduce((a, b) => a + b, 0);

    return { sexCounts, yearCounts, disabilityTypes, ipTotal, soloParentTotal, childOfSoloParent, seniorCitizen, magnaCartaPoor, underprivileged, pwdTotal, totalStudents };
  }, [filteredSubs, questions]);

  const programData = useMemo(() => {
    const programs = {};
    filteredSubs.forEach(sub => {
      const prog = getAnswerByKey(sub, 'program') || 'Unspecified';
      if (!programs[prog]) {
        programs[prog] = {
          disabilityTypes: {},
          ipGroups: new Set(),
          ipTotal: 0,
          soloParent: 0,
          childOfSolo: 0,
          seniorCitizen: 0,
          magnaCartaPoor: 0,
          underprivileged: 0,
          total: 0,
        };
      }
      const p = programs[prog];
      p.total++;

      const isPWD = getAnswerByKey(sub, 'is_pwd');
      if (isPWD === 'Yes') {
        const types = getAnswerByKey(sub, 'pwd_disability_type');
        if (types) {
          try {
            const arr = JSON.parse(types);
            arr.forEach(t => { p.disabilityTypes[t] = (p.disabilityTypes[t] || 0) + 1; });
          } catch {}
        }
      }

      if (getAnswerByKey(sub, 'indigenous_peoples_none') === 'Yes') {
        p.ipTotal++;
        const group = getAnswerByKey(sub, 'indigenous_peoples_group');
        if (group) p.ipGroups.add(group);
      }

      if (getAnswerByKey(sub, 'is_solo_parent_currently_studying') === 'Yes') p.soloParent++;
      if (getAnswerByKey(sub, 'is_child_of_solo_parent') === 'Yes') p.childOfSolo++;
      if (sub.is_senior_citizen) p.seniorCitizen++;
      if (sub.is_magna_carta_poor) p.magnaCartaPoor++;
      if (sub.is_underprivileged) p.underprivileged++;
    });
    return Object.entries(programs)
      .map(([program, d]) => ({
        program,
        apparentPhysical: d.disabilityTypes['Apparent Physical'] || 0,
        deafHardOfHearing: d.disabilityTypes['Deaf/Hard of Hearing'] || 0,
        intellectual: d.disabilityTypes['Intellectual Disability'] || 0,
        learning: d.disabilityTypes['Learning Disability'] || 0,
        mentalPsychosocial: d.disabilityTypes['Mental/Psychosocial'] || 0,
        visual: d.disabilityTypes['Visual'] || 0,
        speechLanguage: d.disabilityTypes['Speech/Language'] || 0,
        nonApparentCancer: d.disabilityTypes['Non-apparent Cancer'] || 0,
        nonApparentRare: d.disabilityTypes['Non-apparent Rare Disease'] || 0,
        pwdTotal: Object.values(d.disabilityTypes).reduce((a, b) => a + b, 0),
        ipGroups: [...d.ipGroups].join(', '),
        ipTotal: d.ipTotal,
        soloParent: d.soloParent,
        childOfSolo: d.childOfSolo,
        seniorCitizen: d.seniorCitizen,
        magnaCartaPoor: d.magnaCartaPoor,
        underprivileged: d.underprivileged,
        total: d.total,
      }))
      .sort((a, b) => a.program.localeCompare(b.program));
  }, [filteredSubs, questions]);

  const sexYearData = useMemo(() => {
    const programs = {};
    filteredSubs.forEach(sub => {
      const prog = getAnswerByKey(sub, 'program') || 'Unspecified';
      if (!programs[prog]) {
        programs[prog] = { Male: 0, Female: 0, years: { '1st': 0, '2nd': 0, '3rd': 0, '4th': 0, '5th': 0, '6th': 0 } };
      }
      const sex = getAnswerByKey(sub, 'gender');
      if (sex === 'Male') programs[prog].Male++;
      else if (sex === 'Female') programs[prog].Female++;

      let year = getAnswerByKey(sub, 'year_level');
      if (year) {
        year = year.split(' ')[0];
        if (programs[prog].years[year] !== undefined) programs[prog].years[year]++;
      }
    });
    return Object.entries(programs)
      .map(([program, d]) => ({
        program,
        male: d.Male,
        female: d.Female,
        year1st: d.years['1st'],
        year2nd: d.years['2nd'],
        year3rd: d.years['3rd'],
        year4th: d.years['4th'],
        year5th: d.years['5th'],
        year6th: d.years['6th'],
        total: d.Male + d.Female,
      }))
      .sort((a, b) => a.program.localeCompare(b.program));
  }, [filteredSubs, questions]);

  const [downloading, setDownloading] = useState(null);

  const downloadCSV = async () => {
    if (!downloadTarget) return;
    const endpointMap = { consolidated: 'ched-consolidated', program: 'ched-program', 'sex-year': 'ched-sex-year' };
    const endpoint = endpointMap[downloadTarget] || 'ched-consolidated';
    setDownloading(downloadTarget);
    
    try {
      const semParam = selectedSem ? `?semester_id=${selectedSem}` : '';
      const response = await apiClient.get(`/reports/${endpoint}/export-csv${semParam}`, {
        responseType: 'blob'
      });
      
      let filename = `OSWD_CHED_${downloadTarget}.csv`;
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.setAttribute('download', filename);
      document.body.appendChild(a);
      a.click();
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }, 500);
      
      toast.success('Report downloaded successfully!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download report.');
    } finally {
      setDownloading(null);
      setDownloadTarget(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-border rounded-xl p-5 space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <TableSkeleton rows={5} cols={6} />
      </div>
    );
  }

  const previewTitle = activeTab === 'consolidated' ? 'CHEDRO Consolidated Preview'
    : activeTab === 'program' ? 'By Program (SEGs) Preview'
    : 'By Sex & Year Level Preview';

  const downloadButtons = [
    { id: 'consolidated', label: 'For CHEDRO Consolidated', icon: FileText, description: 'HEI-level summary: Sex, Year Level, PWD types, IP, Solo Parent, and other SEG categories' },
    { id: 'program', label: 'For HEI SEGs by Program', icon: BookOpen, description: 'Per degree program: PWD types, IP ethnolinguistic breakdown, Solo Parent, and all SEG columns' },
    { id: 'sex-year', label: 'For HEI SEGs by Sex & Year Level', icon: BarChart3, description: 'Per degree program: Male/Female counts and Year Level distribution' },
  ];

  const tabs = [
    { id: 'consolidated', label: 'CHEDRO Consolidated' },
    { id: 'program', label: 'By Program (SEGs)' },
    { id: 'sex-year', label: 'By Sex & Year Level' },
  ];

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn} className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#0F172A]">CHED SEG Reports</h1>
          <p className="text-sm text-[#64748B] mt-1">Special Equity Group enrollment data for CHED submission</p>
        </div>
        <Select value={selectedSem} onValueChange={(v) => { setSelectedSem(v); }}>
          <SelectTrigger className="w-full sm:w-[220px] pr-8"><SelectValue placeholder="Filter by semester">{selectedSem ? semesters.find(s => s.id === selectedSem)?.label : ''}</SelectValue></SelectTrigger>
          <SelectContent>
            {semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div variants={fadeIn} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-3xl font-bold text-[#143A7B]">{totalStudents}</p>
            <p className="text-sm text-[#0F172A] font-medium mt-1">Total Students</p>
            <p className="text-xs text-[#566581] mt-0.5">{semLabel}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-3xl font-bold text-[#143A7B]">{getPWDCount}</p>
            <p className="text-sm text-[#0F172A] font-medium mt-1">PWD Students</p>
            <p className="text-xs text-[#566581] mt-0.5">{pwdPct}% of total</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-3xl font-bold text-[#143A7B]">{getIPCount}</p>
            <p className="text-sm text-[#0F172A] font-medium mt-1">IP Students</p>
            <p className="text-xs text-[#566581] mt-0.5">{ipPct}% of total</p>
          </CardContent>
        </Card>
        <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
          <CardContent className="p-4 sm:p-5">
            <p className="text-3xl font-bold text-[#143A7B]">{getSoloParentCounts.soloParent}</p>
            <p className="text-sm text-[#0F172A] font-medium mt-1">Solo Parents</p>
            <p className="text-xs text-[#566581] mt-0.5">{getSoloParentCounts.soloParent} parent, {getSoloParentCounts.childOfSolo} dependent</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Layer 3 onward */}
      <Card className="bg-[#D7E2F4]/50 border border-[#D4DDE8] shadow-sm rounded-xl ring-1 ring-[#D4DDE8]">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Download className="w-5 h-5 text-[#143A7B]" />
            <h2 className="font-heading font-semibold text-base text-[#0F172A]">Download CHED Reports</h2>
          </div>
          <p className="text-sm text-[#64748B] mb-5">
            Exports match the official CHED template (3 sheets). Filter by semester above, then download each report.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {downloadButtons.map(btn => {
              const isLoading = downloading === btn.id;
              return (
              <button
                key={btn.id}
                onClick={() => { if (!isLoading) setDownloadTarget(btn.id); }}
                disabled={isLoading}
                className={`h-auto py-5 px-4 flex flex-col items-start gap-1 bg-white border border-[#D4DDE8] rounded-lg hover:bg-[#D7E2F4]/50 active:bg-[#D7E2F4]/50 hover:shadow-sm ring-1 ring-[#D4DDE8] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2">
                  {(() => { const Icon = btn.icon; return <Icon className={`w-5 h-5 ${isLoading ? 'animate-pulse' : 'text-[#143A7B]'}`} />; })()}
                  <span className="text-sm font-semibold text-[#0F172A]">{btn.label}</span>
                </div>
                <span className="text-[11px] text-[#566581] text-left leading-tight">{btn.description}</span>
                <span className="text-[11px] text-[#143A7B] font-medium mt-1 inline-flex items-center gap-1">
                  {isLoading ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                  ) : (
                    <><ArrowDown className="w-3 h-3" /> Download CSV</>
                  )}
                </span>
              </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Layer 4: Preview Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex bg-[#F1F5F9] p-1 rounded-lg">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-[#0F172A] shadow-sm'
                  : 'text-[#64748B] hover:bg-white/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Layer 5: Data Preview Table */}
      <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-[#0F172A]">{previewTitle}</CardTitle>
          <CardDescription className="text-sm text-[#64748B]">
            North Eastern Mindanao State University Tagbina Campus &middot; {semLabel}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border border-[#E2E8F0] rounded-lg">
            {activeTab === 'consolidated' && (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse" style={{ minWidth: '2000px' }}>
                  <thead>
                    <tr className="bg-[#143A7B] text-white">
                      <th colSpan={2} className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Sex</th>
                      <th colSpan={6} className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Year Level</th>
                      <th colSpan={10} className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">PWD Distribution</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">IP</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Solo Parent</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Dep. of Solo Parent</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Senior Citizen</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Magna Carta Poor</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Underprivileged</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Grand Total</th>
                    </tr>
                    <tr className="bg-[#D7E2F4] text-[#0F172A]">
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Male</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Female</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">1st</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">2nd</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">3rd</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">4th</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">5th</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">6th</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Apparent Physical Disability</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Deaf/Hard of Hearing Disability</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Intellectual Disability</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Learning Disability</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Mental/Psychosocial Disability</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Visual Disability</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Speech and Language Impairment</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Non-apparent Cancer</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Non-apparent Rare Disease</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Total</th>
                      <th className="p-2 border border-[#D4DDE8]"></th>
                      <th className="p-2 border border-[#D4DDE8]"></th>
                      <th className="p-2 border border-[#D4DDE8]"></th>
                      <th className="p-2 border border-[#D4DDE8]"></th>
                      <th className="p-2 border border-[#D4DDE8]"></th>
                      <th className="p-2 border border-[#D4DDE8]"></th>
                      <th className="p-2 border border-[#D4DDE8]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white text-center text-xs text-[#0F172A]">
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.sexCounts.Male}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.sexCounts.Female}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.yearCounts['1st']}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.yearCounts['2nd']}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.yearCounts['3rd']}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.yearCounts['4th']}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.yearCounts['5th']}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.yearCounts['6th']}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.disabilityTypes['Apparent Physical'] || 0}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.disabilityTypes['Deaf/Hard of Hearing'] || 0}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.disabilityTypes['Intellectual Disability'] || 0}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.disabilityTypes['Learning Disability'] || 0}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.disabilityTypes['Mental/Psychosocial'] || 0}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.disabilityTypes['Visual'] || 0}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.disabilityTypes['Speech/Language'] || 0}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.disabilityTypes['Non-apparent Cancer'] || 0}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.disabilityTypes['Non-apparent Rare Disease'] || 0}</td>
                      <td className="p-2 border border-[#E2E8F0] font-semibold">{consolidatedData.pwdTotal}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.ipTotal}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.soloParentTotal}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.childOfSoloParent}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.seniorCitizen}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.magnaCartaPoor}</td>
                      <td className="p-2 border border-[#E2E8F0]">{consolidatedData.underprivileged}</td>
                      <td className="p-2 border border-[#E2E8F0] font-semibold">{consolidatedData.totalStudents}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'program' && (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse" style={{ minWidth: '2000px' }}>
                  <thead>
                    <tr className="bg-[#143A7B] text-white">
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Degree Program</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Apparent Physical Disability</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Deaf/Hard of Hearing Disability</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Intellectual Disability</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Learning Disability</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Mental/Psychosocial Disability</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Visual Disability</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Speech and Language Impairment</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Non-apparent Cancer</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Non-apparent Rare Disease</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">PWD Total</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">IP (Ethnolinguistic)</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">IP Total</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Solo Parent</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Dep. of Solo</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Senior Citizen</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Magna Carta Poor</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Underprivileged</th>
                      <th className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programData.map((row, i) => (
                      <tr key={i} className="bg-white text-center text-xs text-[#0F172A]">
                        <td className="p-2 border border-[#E2E8F0] text-left font-medium">{row.program}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.apparentPhysical}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.deafHardOfHearing}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.intellectual}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.learning}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.mentalPsychosocial}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.visual}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.speechLanguage}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.nonApparentCancer}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.nonApparentRare}</td>
                        <td className="p-2 border border-[#E2E8F0] font-semibold">{row.pwdTotal}</td>
                        <td className="p-2 border border-[#E2E8F0] text-left">{row.ipGroups || '-'}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.ipTotal}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.soloParent}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.childOfSolo}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.seniorCitizen}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.magnaCartaPoor}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.underprivileged}</td>
                        <td className="p-2 border border-[#E2E8F0] font-semibold">{row.total}</td>
                      </tr>
                    ))}
                    {programData.length === 0 && (
                      <tr><td colSpan={19} className="p-8 text-center text-muted-foreground">No data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {activeTab === 'sex-year' && (
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse" style={{ minWidth: '1200px' }}>
                  <thead>
                    <tr className="bg-[#143A7B] text-white">
                      <th rowSpan={2} className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Degree Program</th>
                      <th colSpan={3} className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Sex</th>
                      <th colSpan={7} className="p-2 text-center text-xs font-semibold border border-[#D4DDE8]">Year Level</th>
                    </tr>
                    <tr className="bg-[#D7E2F4] text-[#0F172A]">
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Male</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Female</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Total</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">1st</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">2nd</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">3rd</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">4th</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">5th</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">6th</th>
                      <th className="p-2 text-center text-xs font-medium border border-[#D4DDE8]">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sexYearData.map((row, i) => (
                      <tr key={i} className="bg-white text-center text-xs text-[#0F172A]">
                        <td className="p-2 border border-[#E2E8F0] text-left font-medium">{row.program}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.male}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.female}</td>
                        <td className="p-2 border border-[#E2E8F0] font-semibold">{row.total}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.year1st}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.year2nd}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.year3rd}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.year4th}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.year5th}</td>
                        <td className="p-2 border border-[#E2E8F0]">{row.year6th}</td>
                        <td className="p-2 border border-[#E2E8F0] font-semibold">{row.total}</td>
                      </tr>
                    ))}
                    {sexYearData.length === 0 && (
                      <tr><td colSpan={11} className="p-8 text-center text-muted-foreground">No data available</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Layer 6: Signatories Card */}
      <Card className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl">
        <CardContent className="p-5 sm:p-6">
          <p className="text-[10px] font-semibold text-[#64748B] mb-4">Signatories (included in CSV exports)</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-[10px] text-[#64748B] font-medium">Prepared by</p>
              <p className="text-xs font-bold text-[#0F172A] mt-1">ROMEL C. NEMIÑO, DBA</p>
              <p className="text-[10px] text-[#566581]">OSWD Head</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] font-medium">Reviewed &amp; Certified</p>
              <p className="text-xs font-bold text-[#0F172A] mt-1">CRISTITA U. CALUYO</p>
              <p className="text-[10px] text-[#566581]">Registrar II</p>
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] font-medium">Approved by</p>
              <p className="text-xs font-bold text-[#0F172A] mt-1">ARISTON O. RONQUILLO, DM</p>
              <p className="text-[10px] text-[#566581]">Campus Director</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!downloadTarget}
        onOpenChange={() => setDownloadTarget(null)}
        onConfirm={downloadCSV}
        title="Download CSV"
        description="Download the selected CHED report as a CSV file?"
        confirmLabel="Download"
      />
    </motion.div>
    </AnimatedPage>
  );
}