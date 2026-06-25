import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton, ListSkeleton } from '@/components/ui/skeleton';
import apiClient from '@/api/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Shield, Clock } from 'lucide-react';

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  useEffect(() => { loadLogs(); }, []);
  useEffect(() => { setPage(1); }, [search]);

  const loadLogs = async () => {
    try {
      const { data } = await apiClient.get('/admin/logs');
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
  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <ListSkeleton rows={6} />
      </div>
    );
  }

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn}>
        <h1 className="font-heading text-2xl font-bold">Audit Log</h1>
        <p className="text-muted-foreground text-sm mt-1">Track all admin actions</p>
      </motion.div>

      <motion.div variants={fadeIn}>
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search actions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </motion.div>

      <motion.div variants={fadeIn} className="space-y-2">
        {paginated.map(log => (
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
                    {new Date(log.timestamp).toLocaleString()}
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
      </motion.div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Page {safePage} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={safePage <= 1}>First</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(safePage - 1)} disabled={safePage <= 1}>Prev</Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(safePage - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="sm" className="min-w-[32px]" onClick={() => setPage(p)}>{p}</Button>;
            })}
            <Button variant="outline" size="sm" onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages}>Next</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={safePage >= totalPages}>Last</Button>
          </div>
        </div>
      )}
    </motion.div>
    </AnimatedPage>
  );
}
