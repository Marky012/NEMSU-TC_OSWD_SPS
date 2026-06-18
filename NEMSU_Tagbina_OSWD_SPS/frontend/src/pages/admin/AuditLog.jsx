import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Shield, Clock } from 'lucide-react';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    try {
      const data = await base44.entities.AdminLog.list('-created_date', 100);
      setLogs(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const filtered = logs.filter(log => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      log.action?.toLowerCase().includes(s) ||
      log.admin_email?.toLowerCase().includes(s) ||
      log.details?.toLowerCase().includes(s)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">Track all admin actions</p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search actions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="space-y-2">
        {filtered.map(log => (
          <Card key={log.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{log.action}</p>
                {log.details && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{log.admin_email}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(log.created_date).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No log entries found
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}