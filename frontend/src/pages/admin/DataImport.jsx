import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton, ListSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Download, Upload, FileUp, Eye, CheckCircle2, XCircle, AlertTriangle, History, Loader2, FileSpreadsheet, Archive, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/api/apiClient';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { YEAR_LEVELS } from '@/lib/constants';

export default function DataImport() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedYearLevels, setSelectedYearLevels] = useState([]);
  const fileInputRef = useRef(null);

  // Archived viewer state
  const [showArchived, setShowArchived] = useState(false);
  const [archivedItems, setArchivedItems] = useState([]);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [archivedPage, setArchivedPage] = useState(1);
  const [archivedTotalPages, setArchivedTotalPages] = useState(1);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedYearFilter, setArchivedYearFilter] = useState([]);

  useEffect(() => {
    loadHistory();
    setLoading(false);
  }, []);

  const yearLevelsParam = (yls) => yls.length > 0 ? yls.join(',') : '';

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await apiClient.get('/admin/import/history');
      setImportHistory(data);
    } catch (e) {
      console.error(e);
    }
    setHistoryLoading(false);
  };

  const loadArchived = async (page = 1, ylFilter = []) => {
    setArchivedLoading(true);
    try {
      const params = { page, page_size: 10 };
      if (ylFilter.length > 0) params.year_levels = ylFilter.join(',');
      const { data } = await apiClient.get('/admin/import/archived', { params });
      setArchivedItems(data.items || []);
      setArchivedTotal(data.total || 0);
      setArchivedPage(data.page || 1);
      setArchivedTotalPages(data.total_pages || 1);
    } catch (e) {
      toast.error('Failed to load archived submissions');
    }
    setArchivedLoading(false);
  };

  const handleViewArchived = (ylFilter = []) => {
    setArchivedYearFilter(ylFilter);
    setArchivedPage(1);
    loadArchived(1, ylFilter);
    setShowArchived(true);
  };

  const handleArchivedPageChange = (newPage) => {
    setArchivedPage(newPage);
    loadArchived(newPage, archivedYearFilter);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await apiClient.get('/admin/export-csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const disposition = response.headers['content-disposition'];
      const match = disposition && disposition.match(/filename=(.+)/);
      link.download = match ? match[1] : `OSWD_SPS_Export_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Export CSV downloaded successfully');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Export failed');
    }
    setExporting(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && !file.name.endsWith('.csv')) {
      toast.error('Only CSV files are accepted');
      setSelectedFile(null);
      e.target.value = '';
      return;
    }
    setSelectedFile(file);
    setPreview(null);
    setImportResult(null);
    setError(null);
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      toast.error('Please select a CSV file first');
      return;
    }
    setPreviewing(true);
    setError(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const params = {};
      const ylParam = yearLevelsParam(selectedYearLevels);
      if (ylParam) params.year_levels = ylParam;
      const { data } = await apiClient.post('/admin/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params,
      });
      setPreview(data);
    } catch (e) {
      const msg = e.response?.data?.detail || 'Preview failed';
      setError(msg);
      toast.error(msg);
    }
    setPreviewing(false);
  };

  const handleImportConfirm = () => {
    setConfirmChecked(false);
    setShowConfirm(true);
  };

  const handleExecuteImport = async () => {
    setShowConfirm(false);
    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const params = {};
      const ylParam = yearLevelsParam(selectedYearLevels);
      if (ylParam) params.year_levels = ylParam;
      const { data } = await apiClient.post('/admin/import/execute', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        params,
      });
      setImportResult(data);
      setPreview(null);
      setSelectedFile(null);
      setSelectedYearLevels([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success(`Import complete: ${data.kept} kept, ${data.archived} archived`);
      loadHistory();
    } catch (e) {
      const msg = e.response?.data?.detail || 'Import failed';
      setError(msg);
      toast.error(msg);
    }
    setImporting(false);
  };

  const ylLabel = selectedYearLevels.length > 0 ? selectedYearLevels.join(', ') : 'All Year Levels';

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <AnimatedPage>
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={fadeIn}>
        <h1 className="font-heading text-2xl font-bold">Data Import</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Export current data, clean it externally, then import the result back.
          Select which year levels to target — other year levels remain untouched.
        </p>
      </motion.div>

      {/* Step 1: Export */}
      <motion.div variants={fadeIn}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="w-5 h-5 text-primary" />
              Step 1: Export Current Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Download current active-semester submissions as a CSV file containing
              identifying fields for multi-angle comparison in your external workflow
              (Google Colab, etc.):
              <span className="font-mono text-xs ml-1">email, surname, first_name, program, birthdate, year_level</span>
            </p>
            <div className="flex items-center gap-4">
              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
                {exporting ? 'Exporting...' : 'Download Export CSV'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Step 2: Import */}
      <motion.div variants={fadeIn}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="w-5 h-5 text-primary" />
              Step 2: Import Cleaned CSV
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload the cleaned CSV file. Select which year levels to update —
              only submissions for the selected year levels will be archived and replaced.
            </p>

            {/* Year Level Toggle Buttons */}
            <div>
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Year Levels to Import</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {YEAR_LEVELS.map(year => {
                  const active = selectedYearLevels.includes(year);
                  return (
                    <button
                      key={year}
                      onClick={() => setSelectedYearLevels(prev => active ? prev.filter(y => y !== year) : [...prev, year])}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        active
                          ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                          : 'bg-white text-muted-foreground border-border hover:bg-muted/50 hover:border-muted-foreground/30'
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
                {selectedYearLevels.length > 0 && (
                  <button
                    onClick={() => setSelectedYearLevels([])}
                    className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {selectedYearLevels.length === 0
                  ? 'No year level selected — all year levels will be targeted'
                  : `Targeting: ${selectedYearLevels.join(', ')}`}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="max-w-sm"
              />
              <Button
                variant="secondary"
                onClick={handlePreview}
                disabled={!selectedFile || previewing}
              >
                {previewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
                {previewing ? 'Previewing...' : 'Preview Import'}
              </Button>
            </div>

            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Step 3: Preview Results */}
      {preview && (
        <motion.div variants={fadeIn} key="preview">
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileUp className="w-5 h-5 text-primary" />
                Preview Results
                {preview.year_levels_targeted?.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    — {preview.year_levels_targeted.join(', ')}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-primary/5 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-primary">{preview.total_csv_rows}</p>
                  <p className="text-xs text-muted-foreground">Rows in CSV</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600">{preview.will_keep}</p>
                  <p className="text-xs text-muted-foreground">Matched in SPS</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-amber-600">{preview.will_archive}</p>
                  <p className="text-xs text-muted-foreground">Will be Archived</p>
                </div>
                <div className={preview.not_found > 0 ? 'bg-red-50 rounded-lg p-4 text-center' : 'bg-gray-50 rounded-lg p-4 text-center'}>
                  <p className="text-2xl font-bold" style={{ color: preview.not_found > 0 ? '#dc2626' : '#6b7280' }}>
                    {preview.not_found}
                  </p>
                  <p className="text-xs text-muted-foreground">Not Found</p>
                </div>
              </div>

              {preview.sample_not_found?.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-red-700 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {preview.not_found} row(s) could not be matched to any existing submission
                  </p>
                  <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
                    {preview.sample_not_found.map((name, i) => (
                      <li key={i}>{name}</li>
                    ))}
                  </ul>
                  {preview.not_found > 5 && (
                    <p className="text-xs text-red-500 mt-1">...and {preview.not_found - 5} more</p>
                  )}
                </div>
              )}

              {preview.will_archive > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    {preview.will_archive} submission(s) will be archived
                    {preview.year_levels_targeted?.length > 0 && (
                      <> for <strong>{preview.year_levels_targeted.join(', ')}</strong></>
                    )}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    This will overwrite existing data for the selected year levels with your cleaned CSV.
                    Archived data is preserved in the database and can be viewed later.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button onClick={handleImportConfirm} disabled={importing}>
                  {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  {importing ? 'Importing...' : 'Confirm & Import'}
                </Button>
                <Button variant="outline" onClick={() => { setPreview(null); setError(null); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Error display */}
      {error && !preview && (
        <motion.div variants={fadeIn}>
          <Card className="border-red-300">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 text-red-700">
                <XCircle className="w-5 h-5 mt-0.5" />
                <div>
                  <p className="font-medium">Import Error</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Import result */}
      {importResult && (
        <motion.div variants={fadeIn}>
          <Card className="border-green-300">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 text-green-700">
                <CheckCircle2 className="w-5 h-5 mt-0.5" />
                <div>
                  <p className="font-medium">Import Completed Successfully</p>
                  <div className="text-sm space-y-1 mt-1">
                    <p>Kept active: <strong>{importResult.kept}</strong></p>
                    <p>Archived: <strong>{importResult.archived}</strong></p>
                    <p>Not matched: <strong>{importResult.not_found}</strong></p>
                    {importResult.year_levels_targeted?.length > 0 && (
                      <p>Year Levels: <strong>{importResult.year_levels_targeted.join(', ')}</strong></p>
                    )}
                    <p className="text-xs text-muted-foreground">Import ID: #{importResult.import_id}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Import History */}
      <motion.div variants={fadeIn}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5 text-primary" />
              Import History
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => handleViewArchived()}>
              <Archive className="w-3.5 h-3.5 mr-1" /> View Archived
            </Button>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <ListSkeleton rows={3} />
            ) : importHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No imports have been performed yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead className="text-center">CSV Rows</TableHead>
                      <TableHead className="text-center">Kept</TableHead>
                      <TableHead className="text-center">Archived</TableHead>
                      <TableHead className="text-center">Missed</TableHead>
                      <TableHead>Imported By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importHistory.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="text-muted-foreground">{h.id}</TableCell>
                        <TableCell className="text-nowrap">
                          {new Date(h.imported_at).toLocaleDateString('en-PH', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>{h.semester_label}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={h.filename}>{h.filename}</TableCell>
                        <TableCell className="text-center">{h.total_rows}</TableCell>
                        <TableCell className="text-center text-green-600 font-medium">{h.kept}</TableCell>
                        <TableCell className="text-center text-amber-600">{h.archived}</TableCell>
                        <TableCell className="text-center" style={{ color: h.not_found > 0 ? '#dc2626' : undefined }}>
                          {h.not_found}
                        </TableCell>
                        <TableCell>{h.imported_by_name || 'Unknown'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Enhanced Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Confirm Data Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                You are about to import cleaned data for:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedYearLevels.length > 0 ? selectedYearLevels.map(yl => (
                  <span key={yl} className="px-2.5 py-1 text-xs font-medium bg-brand-blue text-white rounded-md">
                    {yl}
                  </span>
                )) : (
                  <span className="px-2.5 py-1 text-xs font-medium bg-brand-blue text-white rounded-md">
                    All Year Levels
                  </span>
                )}
              </div>
            </div>

            <div className="text-sm space-y-2">
              <p className="text-muted-foreground">
                This action will:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                <li>Archive <strong className="text-foreground">{preview?.will_archive || 0}</strong> existing submission(s)
                  {selectedYearLevels.length > 0 && <> for <strong className="text-foreground">{ylLabel}</strong></>}
                </li>
                <li>Replace them with cleaned data from your CSV</li>
                <li>Keep <strong className="text-foreground">{preview?.will_keep || 0}</strong> matched submission(s) active</li>
                {selectedYearLevels.length > 0 && (
                  <li className="text-green-700">
                    Submissions for <strong>{YEAR_LEVELS.filter(yl => !selectedYearLevels.includes(yl)).join(', ') || 'none'}</strong> will NOT be affected
                  </li>
                )}
              </ul>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300"
                />
                <span className="text-sm text-muted-foreground">
                  I understand this will overwrite existing data for the selected year levels.
                  Archived data can be viewed in the Import History.
                </span>
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button
              onClick={handleExecuteImport}
              disabled={!confirmChecked || importing}
            >
              {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Import & Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archived Submissions Viewer */}
      <Dialog open={showArchived} onOpenChange={setShowArchived}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <Archive className="w-5 h-5" />
              Archived Submissions
              <span className="text-sm font-normal text-muted-foreground">({archivedTotal} total)</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Year level filter for archived view */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">Filter:</span>
              {YEAR_LEVELS.map(year => {
                const active = archivedYearFilter.includes(year);
                return (
                  <button
                    key={year}
                    onClick={() => {
                      const next = active ? archivedYearFilter.filter(y => y !== year) : [...archivedYearFilter, year];
                      setArchivedYearFilter(next);
                      setArchivedPage(1);
                      loadArchived(1, next);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                      active
                        ? 'bg-brand-blue text-white border-brand-blue shadow-sm'
                        : 'bg-white text-muted-foreground border-border hover:bg-muted/50 hover:border-muted-foreground/30'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
              {archivedYearFilter.length > 0 && (
                <button
                  onClick={() => { setArchivedYearFilter([]); setArchivedPage(1); loadArchived(1, []); }}
                  className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>

            {archivedLoading ? (
              <ListSkeleton rows={5} />
            ) : archivedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No archived submissions found.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Year Level</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Code</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-sm">{item.student_name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.student_email}</TableCell>
                          <TableCell className="text-xs">{item.student_category || '—'}</TableCell>
                          <TableCell className="text-xs">{item.year_level || '—'}</TableCell>
                          <TableCell className="text-xs">
                            <span className={`px-2 py-0.5 rounded-full ${
                              item.status === 'verified' ? 'bg-primary/10 text-primary' :
                              item.status === 'returned' ? 'bg-amber-100 text-amber-700' :
                              item.status === 'declined' ? 'bg-red-100 text-red-700' :
                              'bg-secondary/10 text-secondary'
                            }`}>
                              {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{item.verification_code}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {archivedTotalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Page {archivedPage} of {archivedTotalPages} ({archivedTotal} submissions)
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => handleArchivedPageChange(archivedPage - 1)} disabled={archivedPage <= 1}>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleArchivedPageChange(archivedPage + 1)} disabled={archivedPage >= archivedTotalPages}>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
    </AnimatedPage>
  );
}
