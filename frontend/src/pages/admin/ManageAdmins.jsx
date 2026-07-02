import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton';
import apiClient from '@/api/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Shield, Plus, Trash2, Loader2, Mail, User, ShieldCheck, Eye } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function ManageAdmins() {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ email: '', first_name: '', password: '', confirm_password: '', role: 'verification_officer' });

  useEffect(() => { loadAdmins(); }, []);

  const loadAdmins = async () => {
    try {
      const { data } = await apiClient.get('/admin/admins');
      setAdmins(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.email || !form.first_name || !form.password) {
      toast.error('All fields are required');
      return;
    }
    if (form.password !== form.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/admin/admins', {
        email: form.email,
        first_name: form.first_name,
        password: form.password,
        role: form.role,
      });
      toast.success(`Admin account created for ${form.email}`);
      setShowAdd(false);
      setForm({ email: '', first_name: '', password: '', confirm_password: '', role: 'verification_officer' });
      loadAdmins();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create admin');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/admins/${deleteTarget.id}`);
      toast.success(`Admin ${deleteTarget.email} deleted`);
      setDeleteTarget(null);
      loadAdmins();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete admin');
    }
    setDeleting(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
        <TableSkeleton rows={4} cols={4} />
      </div>
    );
  }

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn} className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Manage Admins</h1>
          <p className="text-muted-foreground text-sm mt-1">{admins.length} admin(s) in the system</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5 rounded-lg">
          <Plus className="w-4 h-4" /> Add Admin
        </Button>
      </motion.div>

      <motion.div variants={fadeIn} className="space-y-3">
        {admins.map(admin => (
          <Card key={admin.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-brand-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{admin.first_name || 'Admin'}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
                    admin.role === 'admin'
                      ? 'bg-brand-blue/10 text-brand-blue'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {admin.role === 'admin' ? <ShieldCheck className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {admin.role === 'admin' ? 'Full Admin' : 'Verification Officer'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{admin.email}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Joined {new Date(admin.created_at).toLocaleDateString()}
                </p>
              </div>
              {admin.id !== user?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => setDeleteTarget(admin)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
              {admin.id === user?.id && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">You</span>
              )}
            </CardContent>
          </Card>
        ))}
        {admins.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No admin accounts found
            </CardContent>
          </Card>
        )}
      </motion.div>

      <Dialog open={showAdd} onOpenChange={(open) => { if (!open) { setShowAdd(false); setForm({ email: '', first_name: '', password: '', confirm_password: '' }); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Add New Admin Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Full Name</Label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="e.g. Juan Dela Cruz"
                  value={form.first_name}
                  onChange={e => setForm(prev => ({ ...prev, first_name: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="e.g. staff@nemsu.edu.ph"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Password</Label>
              <Input
                type="password"
                placeholder="At least 6 characters"
                value={form.password}
                onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Confirm Password</Label>
              <Input
                type="password"
                placeholder="Repeat password"
                value={form.confirm_password}
                onChange={e => setForm(prev => ({ ...prev, confirm_password: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Role</Label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer border border-border rounded-lg px-3 py-2 flex-1 has-[:checked]:border-brand-blue has-[:checked]:bg-brand-blue/5">
                  <input
                    type="radio"
                    name="role"
                    value="verification_officer"
                    checked={form.role === 'verification_officer'}
                    onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                    className="accent-brand-blue"
                  />
                  <Eye className="w-4 h-4 text-amber-600" />
                  <span>Verification Officer</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer border border-border rounded-lg px-3 py-2 flex-1 has-[:checked]:border-brand-blue has-[:checked]:bg-brand-blue/5">
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={form.role === 'admin'}
                    onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                    className="accent-brand-blue"
                  />
                  <ShieldCheck className="w-4 h-4 text-brand-blue" />
                  <span>Full Admin</span>
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowAdd(false); setForm({ email: '', first_name: '', password: '', confirm_password: '' }); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Admin"
        description={deleteTarget ? `Remove admin access for ${deleteTarget.email} (${deleteTarget.first_name})? They will no longer be able to access the admin panel.` : ''}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
      />
    </motion.div>
    </AnimatedPage>
  );
}