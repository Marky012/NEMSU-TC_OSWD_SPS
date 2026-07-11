import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import AnimatedPage, { staggerContainer, fadeIn } from '@/components/AnimatedPage';
import { Skeleton, ListSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Upload, FileUp, Eye, CheckCircle2, XCircle, AlertTriangle, History, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/api/apiClient';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import ConfirmDialog from '@/components/ConfirmDialog';

export default function DataImport() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importHistory, setImportHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadHistory();
    setLoading(false);
  }, []);

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
      const { data } = await apiClient.post('/admin/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
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
    setShowConfirm(true);
  };

  const handleExecuteImport = async () => {
    setShowConfirm(false);
    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const { data } = await apiClient.post('/admin/import/execute', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(data);
      setPreview(null);
      setSelectedFile(null);
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
          Old data is archived (never deleted) for audit purposes.
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
              5 identifying fields for multi-angle comparison in your external workflow
              (Google Colab, etc.):
              <span className="font-mono text-xs ml-1">email, surname, first_name, program, birthdate</span>
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
              Upload the cleaned CSV file (same format as the export above).
              Only students listed in the CSV will remain active —
              all other current submissions will be archived.
            </p>

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
                    {preview.will_archive} submission(s) will be archived (removed from active analytics)
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Archived data is never deleted — it stays in the database with{' '}
                    <code className="bg-amber-100 px-1 rounded">is_archived = True</code>
                    {' '}and can always be restored.
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5 text-primary" />
              Import History
            </CardTitle>
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

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        onConfirm={handleExecuteImport}
        title="Confirm Data Import"
        description={
          preview
            ? `This will archive ${preview.will_archive} submission(s) and keep ${preview.will_keep} active. Old data will NOT be deleted — it is preserved in the database. Are you sure?`
            : 'Are you sure you want to proceed with this import?'
        }
        confirmLabel="Import"
      />
    </motion.div>
    </AnimatedPage>
  );
}
