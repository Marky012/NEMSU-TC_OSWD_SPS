import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton } from '@/components/ui/skeleton';
import apiClient from '@/api/apiClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TooltipBox } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Shield, UserCheck, LogOut, Loader2, Mail, User, Clock, Eye } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

const STAFF_LABELS = [
  'OSWD TG Office Staff 1',
  'OSWD TG Office Staff 2',
  'OSWD TG Office Staff 3',
  'OSWD TG Office Staff 4',
  'OSWD TG Office Staff 5',
];

export default function ManageAdmins() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimSlot, setClaimSlot] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '' });
  const [mySlot, setMySlot] = useState(null);
  const [showRelease, setShowRelease] = useState(false);
  const [releasing, setReleasing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('staff_slot');
    if (stored) {
      try { setMySlot(JSON.parse(stored)); } catch { localStorage.removeItem('staff_slot'); }
    }
    loadSlots();
  }, []);

  const loadSlots = async () => {
    try {
      const { data } = await apiClient.get('/admin/staff-slots');
      setSlots(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleClaim = async () => {
    if (!form.email || !form.full_name) {
      toast.error('Please enter both email and full name');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/admin/staff-slots/claim', {
        slot_number: claimSlot,
        email: form.email,
        full_name: form.full_name,
      });
      const slotInfo = { slot_number: claimSlot, email: form.email, full_name: form.full_name };
      localStorage.setItem('staff_slot', JSON.stringify(slotInfo));
      setMySlot(slotInfo);
      toast.success(`Slot ${claimSlot} claimed! Redirecting to staff view...`);
      setClaimSlot(null);
      setForm({ email: '', full_name: '' });
      loadSlots();
      window.location.href = '/admin/staff-view';
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to claim slot');
    }
    setSaving(false);
  };

  const handleRelease = async () => {
    if (!mySlot) return;
    setReleasing(true);
    try {
      await apiClient.post('/admin/staff-slots/release', { slot_number: mySlot.slot_number });
      localStorage.removeItem('staff_slot');
      setMySlot(null);
      toast.success('Slot released');
      setShowRelease(false);
      loadSlots();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to release slot');
    }
    setReleasing(false);
  };

  const handleUnclaim = (slot) => {
    if (mySlot && slot.slot_number === mySlot.slot_number) {
      setShowRelease(true);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn} className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Manage Admins</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mySlot
              ? `You are currently on Slot ${mySlot.slot_number} (${mySlot.full_name})`
              : 'Claim an available slot to start managing student submissions'}
          </p>
        </div>
        {mySlot && (
          <TooltipBox label="Release this staff slot">
            <Button variant="outline" size="sm" onClick={() => setShowRelease(true)} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10 rounded-lg">
              <LogOut className="w-4 h-4" /> Release Slot
            </Button>
          </TooltipBox>
        )}
      </motion.div>

      <motion.div variants={fadeIn} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {slots.map((slot) => {
          const isMine = mySlot && slot.slot_number === mySlot.slot_number;
          const isClaimed = slot.is_active;
          const idx = slot.slot_number - 1;

          return (
            <Card
              key={slot.slot_number}
              className={`relative overflow-hidden transition-all hover-lift ${
                isMine ? 'ring-2 ring-brand-blue' : ''
              } ${isClaimed && !isMine ? 'opacity-75' : ''}`}
            >
              <CardContent className="p-5 flex flex-col h-full">
                {/* Slot icon */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  isMine ? 'bg-brand-blue text-white' : isClaimed ? 'bg-muted text-muted-foreground' : 'bg-brand-blue/10 text-brand-blue'
                }`}>
                  {isMine ? <UserCheck className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
                </div>

                {/* Slot title */}
                <h3 className="font-heading font-semibold text-sm mb-1">{STAFF_LABELS[idx]}</h3>

                {/* Status / Info */}
                {isMine && (
                  <div className="space-y-1 mb-3">
                    <p className="text-xs font-medium text-brand-blue">{mySlot.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">{mySlot.email}</p>
                  </div>
                )}
                {isClaimed && !isMine && (
                  <div className="space-y-1 mb-3">
                    <p className="text-xs text-muted-foreground">{slot.full_name}</p>
                    <p className="text-[10px] text-muted-foreground">{slot.email}</p>
                  </div>
                )}

                {/* Availability */}
                <div className="mt-auto">
                  {!isClaimed && !mySlot && (
                    <TooltipBox label="Claim this staff slot for yourself">
                      <Button size="sm" className="w-full gap-1.5 rounded-lg" onClick={() => { setClaimSlot(slot.slot_number); setForm({ email: '', full_name: '' }); }}>
                        <Eye className="w-3.5 h-3.5" /> Claim Slot
                      </Button>
                    </TooltipBox>
                  )}
                  {!isClaimed && mySlot && (
                    <p className="text-xs text-muted-foreground text-center py-1">Claim another slot first</p>
                  )}
                  {isClaimed && !isMine && (
                    <p className="text-xs text-muted-foreground text-center py-1 flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" /> Taken
                    </p>
                  )}
                  {isMine && (
                    <TooltipBox label="Open staff dashboard for this slot">
                      <Button size="sm" className="w-full gap-1.5 rounded-lg" onClick={() => window.location.href = '/admin/staff-view'}>
                        <Eye className="w-3.5 h-3.5" /> Open Staff View
                      </Button>
                    </TooltipBox>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      {/* Claim dialog */}
      <Dialog open={!!claimSlot} onOpenChange={(open) => { if (!open) { setClaimSlot(null); setForm({ email: '', full_name: '' }); }}}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading">Claim {STAFF_LABELS[(claimSlot || 1) - 1]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Full Name</Label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="e.g. Juan Dela Cruz"
                  value={form.full_name}
                  onChange={e => setForm(prev => ({ ...prev, full_name: e.target.value }))}
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
          </div>
          <DialogFooter className="gap-2">
            <TooltipBox label="Cancel">
              <Button variant="outline" onClick={() => { setClaimSlot(null); setForm({ email: '', full_name: '' }); }}>
                Cancel
              </Button>
            </TooltipBox>
            <TooltipBox label="Confirm slot claim">
              <Button onClick={handleClaim} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Claim Slot
              </Button>
            </TooltipBox>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release confirm */}
      <ConfirmDialog
        open={showRelease}
        onOpenChange={setShowRelease}
        onConfirm={handleRelease}
        title="Release Slot"
        description="Releasing your slot will unassign you from student submissions. You can claim again later."
        confirmLabel="Release"
        variant="destructive"
        loading={releasing}
      />
    </motion.div>
    </AnimatedPage>
  );
}