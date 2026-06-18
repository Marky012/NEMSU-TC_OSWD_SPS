import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';

const COLORS = ['#1a6b3c', '#d4a017', '#2d7fc1', '#8b5cf6', '#e85d3a', '#d94480', '#0ea5e9', '#84cc16'];

export default function Analytics() {
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

  const getAnswerStats = (questionText) => {
    const q = questions.find(qq => qq.question_text?.includes(questionText));
    if (!q) return [];
    const counts = {};
    filteredSubs.forEach(sub => {
      if (!sub.draft_data_json) return;
      const data = JSON.parse(sub.draft_data_json);
      const val = data[q.id];
      if (val) {
        if (typeof val === 'string' && val.startsWith('[')) {
          try {
            JSON.parse(val).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
          } catch { counts[val] = (counts[val] || 0) + 1; }
        } else {
          counts[val] = (counts[val] || 0) + 1;
        }
      }
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
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

  const chartSections = [
    { title: 'Gender Distribution', data: genderData, type: 'pie' },
    { title: 'PWD Status', data: pwdData, type: 'pie' },
    { title: 'Internet Reliability', data: internetData, type: 'bar' },
    { title: 'Preferred Learning Modality', data: modalityData, type: 'bar' },
    { title: 'Gadgets Owned', data: gadgetData, type: 'pie' },
    { title: 'Primary Residence', data: residenceData, type: 'bar' },
    { title: 'Mobile Network Preference', data: networkData, type: 'pie' },
    { title: 'Campus Wi-Fi Usage', data: wifiData, type: 'bar' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">{filteredSubs.length} submissions analyzed</p>
        </div>
        <Select value={selectedSem} onValueChange={setSelectedSem}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select Semester" /></SelectTrigger>
          <SelectContent>
            {semesters.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {chartSections.map(({ title, data, type }) => (
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
                    <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#1a6b3c" radius={[0, 4, 4, 0]} />
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
      </div>
    </div>
  );
}