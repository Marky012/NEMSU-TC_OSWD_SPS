import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { Download, FileText, Loader2, Users, Heart, Globe, Smartphone, UserCheck } from 'lucide-react';

export default function CHEDReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [selectedSem, setSelectedSem] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [subs, qs, sems] = await Promise.all([
        base44.entities.Submission.filter({ is_final: true }),
        base44.entities.Question.list(),
        base44.entities.Semester.list(),
      ]);
      setSubmissions(subs);
      setQuestions(qs);
      setSemesters(sems);
      const active = sems.find(s => s.is_active);
      if (active) setSelectedSem(active.id);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filteredSubs = useMemo(() => {
    return selectedSem ? submissions.filter(s => s.semester_id === selectedSem) : submissions;
  }, [submissions, selectedSem]);

  const findQuestion = (textFragment) => questions.find(q => q.question_text?.includes(textFragment));

  const getAnswerValue = (sub, textFragment) => {
    const q = findQuestion(textFragment);
    if (!q || !sub.draft_data_json) return null;
    const data = JSON.parse(sub.draft_data_json);
    return data[q.id] || null;
  };

  const exportTableCSV = (headers, rows, filename) => {
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    base44.entities.AdminLog.create({ admin_email: user.email, action: 'CHED Report Export', details: filename });
  };

  // Report 1: Student counts by program/year
  const report1 = useMemo(() => {
    const counts = {};
    filteredSubs.forEach(sub => {
      const program = getAnswerValue(sub, 'Program/Course') || 'Unspecified';
      const year = getAnswerValue(sub, 'Year Level') || 'Unspecified';
      const key = `${program}|||${year}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([key, count]) => {
      const [program, year] = key.split('|||');
      return { program, year, count };
    }).sort((a, b) => a.program.localeCompare(b.program));
  }, [filteredSubs, questions]);

  // Report 2: PWD summary
  const report2 = useMemo(() => {
    const disabilityCounts = {};
    let totalPWD = 0;
    let wantCard = 0;
    filteredSubs.forEach(sub => {
      const isPWD = getAnswerValue(sub, 'Person with Disability');
      if (isPWD === 'Yes') {
        totalPWD++;
        const card = getAnswerValue(sub, 'PWD card');
        if (card === 'No, but would like to have one') wantCard++;
        const types = getAnswerValue(sub, 'Disability Type');
        if (types) {
          try {
            const arr = JSON.parse(types);
            arr.forEach(t => { disabilityCounts[t] = (disabilityCounts[t] || 0) + 1; });
          } catch { /* skip */ }
        }
      }
    });
    return { totalPWD, wantCard, disabilityCounts: Object.entries(disabilityCounts).map(([type, count]) => ({ type, count })) };
  }, [filteredSubs, questions]);

  // Report 3: IP summary
  const report3 = useMemo(() => {
    const ipCounts = {};
    let totalIP = 0;
    filteredSubs.forEach(sub => {
      const isIP = getAnswerValue(sub, 'Indigenous Peoples');
      if (isIP === 'Yes') {
        totalIP++;
        const group = getAnswerValue(sub, 'IP group');
        if (group) ipCounts[group] = (ipCounts[group] || 0) + 1;
      }
    });
    return { totalIP, groups: Object.entries(ipCounts).map(([group, count]) => ({ group, count })).sort((a, b) => b.count - a.count) };
  }, [filteredSubs, questions]);

  // Report 4: Internet & device access
  const report4 = useMemo(() => {
    let smartphone = 0, laptop = 0, noAccess = 0;
    const loadCosts = {};
    const reliabilityData = {};
    filteredSubs.forEach(sub => {
      const gadgets = getAnswerValue(sub, 'Gadgets Owned');
      if (gadgets?.includes('Smartphone') || gadgets?.includes('Both')) smartphone++;
      if (gadgets?.includes('Laptop') || gadgets?.includes('Both')) laptop++;
      const access = getAnswerValue(sub, 'access the internet');
      if (access === 'No access') noAccess++;
      const cost = getAnswerValue(sub, 'Weekly Load Cost');
      if (cost) loadCosts[cost] = (loadCosts[cost] || 0) + 1;
      const rel = getAnswerValue(sub, 'Internet Reliability');
      if (rel) reliabilityData[rel] = (reliabilityData[rel] || 0) + 1;
    });
    const total = filteredSubs.length || 1;
    return {
      smartphonePct: ((smartphone / total) * 100).toFixed(1),
      laptopPct: ((laptop / total) * 100).toFixed(1),
      noAccessPct: ((noAccess / total) * 100).toFixed(1),
      loadCosts: Object.entries(loadCosts).map(([range, count]) => ({ range, count })),
      reliability: Object.entries(reliabilityData).map(([level, count]) => ({ level, count })),
    };
  }, [filteredSubs, questions]);

  // Report 5: Solo parent
  const report5 = useMemo(() => {
    let soloParent = 0, childOfSolo = 0;
    filteredSubs.forEach(sub => {
      if (getAnswerValue(sub, 'solo parent currently studying') === 'Yes') soloParent++;
      if (getAnswerValue(sub, 'son/daughter of a solo parent') === 'Yes') childOfSolo++;
    });
    return { soloParent, childOfSolo, total: filteredSubs.length };
  }, [filteredSubs, questions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const ReportTable = ({ headers, rows, filename }) => (
    <div>
      <div className="flex justify-end mb-3">
        <Button variant="outline" size="sm" onClick={() => exportTableCSV(headers, rows, filename)}>
          <Download className="w-3 h-3 mr-1" /> Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              {headers.map(h => <th key={h} className="p-3 text-left font-medium text-xs">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t">
                {row.map((cell, j) => <td key={j} className="p-3 text-sm">{cell}</td>)}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={headers.length} className="p-8 text-center text-muted-foreground">No data available</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">CHED Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Pre-built reports for CHED submission</p>
        </div>
        <Select value={selectedSem} onValueChange={setSelectedSem}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select Semester" /></SelectTrigger>
          <SelectContent>
            {semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="r1">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="r1" className="text-xs"><Users className="w-3 h-3 mr-1" /> Enrollment</TabsTrigger>
          <TabsTrigger value="r2" className="text-xs"><Heart className="w-3 h-3 mr-1" /> PWD</TabsTrigger>
          <TabsTrigger value="r3" className="text-xs"><Globe className="w-3 h-3 mr-1" /> IP Groups</TabsTrigger>
          <TabsTrigger value="r4" className="text-xs"><Smartphone className="w-3 h-3 mr-1" /> Digital Access</TabsTrigger>
          <TabsTrigger value="r5" className="text-xs"><UserCheck className="w-3 h-3 mr-1" /> Solo Parent</TabsTrigger>
        </TabsList>

        <TabsContent value="r1" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Report 1: Student Counts per Program/Year Level</CardTitle>
              <CardDescription>Total: {filteredSubs.length} students</CardDescription>
            </CardHeader>
            <CardContent>
              <ReportTable
                headers={['Program', 'Year Level', 'Count']}
                rows={report1.map(r => [r.program, r.year, String(r.count)])}
                filename="CHED_Report1_Enrollment"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="r2" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Report 2: PWD Summary</CardTitle>
              <CardDescription>Total PWDs: {report2.totalPWD} | Want PWD Card: {report2.wantCard}</CardDescription>
            </CardHeader>
            <CardContent>
              <ReportTable
                headers={['Disability Type', 'Count']}
                rows={report2.disabilityCounts.map(r => [r.type, String(r.count)])}
                filename="CHED_Report2_PWD"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="r3" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Report 3: Indigenous Peoples (IP) Summary</CardTitle>
              <CardDescription>Total IP Students: {report3.totalIP}</CardDescription>
            </CardHeader>
            <CardContent>
              <ReportTable
                headers={['IP Group', 'Count']}
                rows={report3.groups.map(r => [r.group, String(r.count)])}
                filename="CHED_Report3_IP"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="r4" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Report 4: Internet & Device Access Summary</CardTitle>
              <CardDescription>
                Smartphone: {report4.smartphonePct}% | Laptop: {report4.laptopPct}% | No Internet: {report4.noAccessPct}%
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-2">Weekly Load Cost Distribution</h3>
                <ReportTable
                  headers={['Cost Range', 'Count']}
                  rows={report4.loadCosts.map(r => [r.range, String(r.count)])}
                  filename="CHED_Report4_LoadCost"
                />
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Internet Reliability</h3>
                <ReportTable
                  headers={['Rating', 'Count']}
                  rows={report4.reliability.map(r => [r.level, String(r.count)])}
                  filename="CHED_Report4_Reliability"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="r5" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Report 5: Solo Parent Summary</CardTitle>
              <CardDescription>Total Students: {report5.total}</CardDescription>
            </CardHeader>
            <CardContent>
              <ReportTable
                headers={['Category', 'Count', 'Percentage']}
                rows={[
                  ['Solo Parent (Currently Studying)', String(report5.soloParent), `${((report5.soloParent / (report5.total || 1)) * 100).toFixed(1)}%`],
                  ['Child of Solo Parent', String(report5.childOfSolo), `${((report5.childOfSolo / (report5.total || 1)) * 100).toFixed(1)}%`],
                ]}
                filename="CHED_Report5_SoloParent"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}