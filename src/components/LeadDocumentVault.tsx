import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, Image as ImageIcon, FileSpreadsheet, Archive, File, 
  Upload, Download, Trash2, Eye, X, Check, Plus, AlertCircle, 
  Paperclip, ExternalLink, ShieldCheck, FolderOpen, ZoomIn, ZoomOut,
  RotateCw, RefreshCw, Maximize2, PhoneCall
} from 'lucide-react';
import { Lead, LeadDocument } from '../types';
import { saveDocToLocalDB, getDocFromLocalDB, deleteDocFromLocalDB } from '../utils/documentStorage';
import { maskEmail, maskPhone } from '../utils/masking';
import { getApiUrl } from '../utils/apiUrl';
import { WhatsAppOfficialIcon } from './AdminLeads';

interface LeadDocumentVaultProps {
  lead: Lead;
  onUpdateLeadDocuments: (leadId: string, documents: LeadDocument[]) => Promise<void> | void;
  isOpenModal?: boolean;
  onCloseModal?: () => void;
  userRole?: 'admin' | 'counselor' | null;
}

const DOCUMENT_CATEGORIES: NonNullable<LeadDocument['category']>[] = [
  'Passport',
  'Academic Marksheet',
  'Degree Transcript',
  'Language Test',
  'SOP & Resume',
  'Financial & Bank',
  'Offer Letter / Visa',
  'General'
];

export default function LeadDocumentVault({
  lead,
  onUpdateLeadDocuments,
  isOpenModal = false,
  onCloseModal,
  userRole = 'admin'
}: LeadDocumentVaultProps) {
  const [selectedCategory, setSelectedCategory] = useState<NonNullable<LeadDocument['category']>>('General');
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<LeadDocument | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [hydratedDocs, setHydratedDocs] = useState<LeadDocument[]>(lead.documents || []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync and hydrate documents from IndexedDB if dataUrl was stored locally
  useEffect(() => {
    let isMounted = true;
    const rawDocs = lead.documents || [];

    async function hydrate() {
      const resolved = await Promise.all(
        rawDocs.map(async (doc) => {
          if (!doc.dataUrl || doc.dataUrl === '') {
            const localData = await getDocFromLocalDB(doc.id);
            if (localData) {
              return { ...doc, dataUrl: localData };
            }
          }
          return doc;
        })
      );
      if (isMounted) {
        setHydratedDocs(resolved);
      }
    }

    hydrate();
    return () => {
      isMounted = false;
    };
  }, [lead.id, lead.documents]);

  // Clean up blob URLs on preview changes
  useEffect(() => {
    if (!previewDoc) {
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      setTextContent(null);
      setZoomLevel(1);
      setRotation(0);
      return;
    }

    let blobUrl = '';
    if (previewDoc.dataUrl) {
      try {
        if (previewDoc.dataUrl.startsWith('data:')) {
          const arr = previewDoc.dataUrl.split(',');
          const mimeMatch = arr[0].match(/:(.*?);/);
          const mime = mimeMatch ? mimeMatch[1] : (previewDoc.type || 'application/octet-stream');
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          blobUrl = URL.createObjectURL(blob);
          setPreviewBlobUrl(blobUrl);

          // If text or CSV, decode string for preview
          if (mime.includes('text') || mime.includes('csv') || mime.includes('json')) {
            const textDecoder = new TextDecoder();
            setTextContent(textDecoder.decode(u8arr));
          }
        } else if (previewDoc.dataUrl.startsWith('http://') || previewDoc.dataUrl.startsWith('https://')) {
          setPreviewBlobUrl(previewDoc.dataUrl);
        }
      } catch (err) {
        console.warn('Error constructing blob URL for preview:', err);
      }
    }

    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [previewDoc]);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const isImageDoc = (doc: LeadDocument) => {
    const lowerName = (doc.name || '').toLowerCase();
    const lowerType = (doc.type || '').toLowerCase();
    const dataUrlPrefix = (doc.dataUrl || '').substring(0, 35).toLowerCase();
    return (
      lowerType.startsWith('image/') ||
      dataUrlPrefix.startsWith('data:image/') ||
      lowerName.match(/\.(png|jpg|jpeg|webp|gif|svg|bmp|ico|heic|avif)$/i) !== null
    );
  };

  const isPdfDoc = (doc: LeadDocument) => {
    const lowerName = (doc.name || '').toLowerCase();
    const lowerType = (doc.type || '').toLowerCase();
    const dataUrlPrefix = (doc.dataUrl || '').substring(0, 35).toLowerCase();
    return (
      lowerType === 'application/pdf' ||
      lowerType.includes('pdf') ||
      dataUrlPrefix.startsWith('data:application/pdf') ||
      lowerName.endsWith('.pdf')
    );
  };

  const isTextDoc = (doc: LeadDocument) => {
    const lowerName = (doc.name || '').toLowerCase();
    const lowerType = (doc.type || '').toLowerCase();
    return lowerType.startsWith('text/') || lowerName.match(/\.(txt|csv|json|log|md|xml)$/i) !== null;
  };

  const getFileIcon = (fileName: string, type: string) => {
    const lowerName = (fileName || '').toLowerCase();
    const lowerType = (type || '').toLowerCase();

    if (lowerType.startsWith('image/') || lowerName.match(/\.(png|jpg|jpeg|webp|gif|svg|bmp|heic)$/)) {
      return <ImageIcon className="w-5 h-5 text-indigo-500" />;
    }
    if (lowerType === 'application/pdf' || lowerName.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (lowerName.match(/\.(doc|docx|rtf|odt|pages)$/)) {
      return <FileText className="w-5 h-5 text-blue-500" />;
    }
    if (lowerName.match(/\.(xls|xlsx|csv|numbers)$/)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    }
    if (lowerName.match(/\.(zip|rar|7z|tar|gz)$/)) {
      return <Archive className="w-5 h-5 text-amber-500" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    setUploadSuccess(null);
    setUploadError(null);

    const newDocs: LeadDocument[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const dataUrl = await readFileAsDataURL(file);
        
        // 1. Upload to live backend document storage API
        try {
          const res = await fetch(getApiUrl(`/api/leads/${lead.id}/documents`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              size: file.size,
              type: file.type || getExtensionMime(file.name),
              dataUrl,
              category: selectedCategory || 'General'
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.document) {
              await saveDocToLocalDB(data.document.id, dataUrl);
              newDocs.push({
                ...data.document,
                dataUrl
              });
              continue;
            }
          }
        } catch (serverErr) {
          console.warn('Server upload notice, caching locally:', serverErr);
        }

        // Fallback if offline or server endpoint responded with error
        const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await saveDocToLocalDB(docId, dataUrl);
        const doc: LeadDocument = {
          id: docId,
          name: file.name,
          size: file.size,
          type: file.type || getExtensionMime(file.name),
          dataUrl,
          url: `/api/documents/${docId}`,
          uploadedAt: new Date().toISOString(),
          category: selectedCategory || 'General'
        };
        newDocs.push(doc);
      } catch (err: any) {
        console.error('File read error:', err);
        setUploadError(`Failed to process file "${file.name}"`);
      }
    }

    if (newDocs.length > 0) {
      const currentList = hydratedDocs && hydratedDocs.length > 0 ? hydratedDocs : (lead.documents || []);
      const updatedDocs = [...currentList, ...newDocs];
      setHydratedDocs(updatedDocs);
      await onUpdateLeadDocuments(lead.id, updatedDocs);
      setUploadSuccess(`Successfully uploaded ${newDocs.length} ${newDocs.length === 1 ? 'document' : 'documents'}!`);
      setTimeout(() => setUploadSuccess(null), 4000);
    }
    setIsUploading(false);
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const getExtensionMime = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'webp': return 'image/webp';
      case 'svg': return 'image/svg+xml';
      case 'gif': return 'image/gif';
      case 'doc': return 'application/msword';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls': return 'application/vnd.ms-excel';
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'csv': return 'text/csv';
      case 'zip': return 'application/zip';
      case 'txt': return 'text/plain';
      default: return 'application/octet-stream';
    }
  };

  const handleDeleteDocument = async (docId: string, docName: string) => {
    if (window.confirm(`Are you sure you want to remove document "${docName}"?`)) {
      const currentList = hydratedDocs && hydratedDocs.length > 0 ? hydratedDocs : (lead.documents || []);
      const updatedDocs = currentList.filter(d => d.id !== docId);
      setHydratedDocs(updatedDocs);
      await deleteDocFromLocalDB(docId);

      try {
        await fetch(getApiUrl(`/api/leads/${lead.id}/documents/${docId}`), {
          method: 'DELETE'
        });
      } catch (e) {
        console.warn('Error deleting document on server:', e);
      }

      await onUpdateLeadDocuments(lead.id, updatedDocs);
      if (previewDoc?.id === docId) {
        setPreviewDoc(null);
      }
    }
  };

  const handleDownloadDocument = async (doc: LeadDocument) => {
    let dataToUse = previewBlobUrl || doc.dataUrl;
    if (!dataToUse || dataToUse.startsWith('/api/')) {
      const cachedData = await getDocFromLocalDB(doc.id);
      if (cachedData) {
        dataToUse = cachedData;
      } else {
        const directUrl = getApiUrl(doc.url || `/api/documents/${doc.id}`);
        const link = document.createElement('a');
        link.href = directUrl;
        link.download = doc.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
    }
    if (dataToUse) {
      const link = document.createElement('a');
      link.href = dataToUse;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenInNewWindow = async (doc: LeadDocument) => {
    let urlToOpen = '';
    let rawData = doc.dataUrl;
    if (!rawData || rawData.startsWith('/api/')) {
      const cachedData = await getDocFromLocalDB(doc.id);
      if (cachedData) rawData = cachedData;
    }

    if (rawData && rawData.startsWith('data:')) {
      try {
        const arr = rawData.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : (doc.type || 'application/octet-stream');
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        urlToOpen = URL.createObjectURL(blob);
      } catch (e) {
        urlToOpen = rawData;
      }
    } else {
      urlToOpen = doc.url ? getApiUrl(doc.url) : getApiUrl(`/api/documents/${doc.id}`);
    }
    window.open(urlToOpen, '_blank');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const openDocumentViewer = async (doc: LeadDocument) => {
    let targetDoc = { ...doc };
    if (!targetDoc.dataUrl || targetDoc.dataUrl === '' || targetDoc.dataUrl.startsWith('/api/')) {
      const cachedData = await getDocFromLocalDB(doc.id);
      if (cachedData) {
        targetDoc.dataUrl = cachedData;
      } else {
        const liveDocUrl = getApiUrl(doc.url || `/api/documents/${doc.id}`);
        targetDoc.dataUrl = liveDocUrl;
      }
    }
    setPreviewDoc(targetDoc);
  };

  const content = (
    <div className="flex flex-col space-y-5" id={`document-vault-${lead.id}`}>
      
      {/* Upload Zone & Category Selector */}
      <div className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3.5">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-teal-600" />
            <h4 className="font-extrabold text-slate-800 text-sm">
              Upload Student Documents & Verification Files
            </h4>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor={`doc-category-select-${lead.id}`} className="text-[11px] font-bold text-slate-500 whitespace-nowrap">
              Tag Category:
            </label>
            <select
              id={`doc-category-select-${lead.id}`}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-700 font-bold outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer w-full sm:w-auto shadow-sm"
            >
              {DOCUMENT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Drag and Drop Box */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
            dragActive 
              ? 'border-teal-500 bg-teal-50/60 scale-[1.01]' 
              : 'border-slate-300 hover:border-teal-400 bg-white hover:bg-teal-50/20'
          }`}
          id={`dropzone-${lead.id}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="*/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            id={`file-input-${lead.id}`}
          />
          
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 border border-teal-100 shadow-sm">
              <Upload className={`w-6 h-6 ${isUploading ? 'animate-bounce' : ''}`} />
            </div>
            
            <div>
              <p className="text-xs font-bold text-slate-700">
                <span className="text-teal-600 font-extrabold hover:underline">Click to browse</span> or drag and drop any files here
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Compatible with any file type: Images (PNG, JPG, WEBP), PDF, Word (DOC/DOCX), Excel, ZIP, etc.
              </p>
            </div>

            {isUploading && (
              <span className="text-xs font-bold text-teal-600 animate-pulse flex items-center gap-1.5 pt-1">
                Processing & encoding documents...
              </span>
            )}
          </div>
        </div>

        {uploadSuccess && (
          <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{uploadSuccess}</span>
          </div>
        )}

        {uploadError && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}
      </div>

      {/* Document Records List */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-teal-600" />
            Attached Documents ({hydratedDocs.length})
          </h5>
          {hydratedDocs.length > 0 && (
            <span className="text-[10px] text-slate-400 font-semibold">
              Click "View" or the file thumbnail to open full preview
            </span>
          )}
        </div>

        {hydratedDocs.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200/70 rounded-2xl p-8 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-600">No documents attached yet</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
              Upload passports, transcripts, marksheets, scorecards, SOPs, or visa letters for {lead.name}.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5" id={`doc-list-grid-${lead.id}`}>
            {hydratedDocs.map((doc) => {
              const isImage = isImageDoc(doc);
              const isPdf = isPdfDoc(doc);

              return (
                <div
                  key={doc.id}
                  className="bg-white border border-slate-200/90 rounded-2xl p-3.5 flex flex-col justify-between hover:shadow-md hover:border-teal-300 transition-all group"
                  id={`doc-card-${doc.id}`}
                >
                  {/* Top: Thumbnail Preview & Info */}
                  <div className="flex items-start gap-3">
                    {/* Visual Thumbnail or Icon */}
                    <div 
                      onClick={() => openDocumentViewer(doc)}
                      className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0 overflow-hidden cursor-pointer group-hover:ring-2 group-hover:ring-teal-400 transition-all relative"
                      title="Click to preview file"
                    >
                      {isImage && (doc.dataUrl || doc.url) ? (
                        <img 
                          src={doc.dataUrl && doc.dataUrl.startsWith('data:') ? doc.dataUrl : getApiUrl(doc.url || `/api/documents/${doc.id}`)} 
                          alt={doc.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        getFileIcon(doc.name, doc.type)
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Eye className="w-3.5 h-3.5 text-white drop-shadow" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h6 
                        onClick={() => openDocumentViewer(doc)}
                        className="text-xs font-bold text-slate-800 truncate cursor-pointer hover:text-teal-600 transition-colors" 
                        title={doc.name}
                      >
                        {doc.name}
                      </h6>
                      
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 border border-teal-100 text-teal-800 text-[9px] font-black uppercase tracking-wider">
                          {doc.category || 'General'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">
                          {formatFileSize(doc.size)}
                        </span>
                      </div>

                      <span className="text-[9px] text-slate-400 block mt-1">
                        {new Date(doc.uploadedAt).toLocaleDateString()} at {new Date(doc.uploadedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center justify-between gap-1.5 mt-3 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center gap-1">
                      {/* ALWAYS SHOW VIEW BUTTON */}
                      <button
                        type="button"
                        onClick={() => openDocumentViewer(doc)}
                        className="px-2.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                        title="View Document in Full Viewer"
                        id={`preview-doc-btn-${doc.id}`}
                      >
                        <Eye className="w-3.5 h-3.5 text-teal-700" />
                        <span>View</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(doc)}
                        className="px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        title="Download File"
                        id={`download-doc-btn-${doc.id}`}
                      >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span className="hidden sm:inline">Download</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc.id, doc.name)}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                      title="Delete File"
                      id={`delete-doc-btn-${doc.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FULL DOCUMENT INTERACTIVE VIEWER MODAL */}
      {previewDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                  {getFileIcon(previewDoc.name, previewDoc.type)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-800 truncate" title={previewDoc.name}>
                    {previewDoc.name}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold mt-0.5">
                    <span className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded font-black text-[9px] uppercase border border-teal-100">
                      {previewDoc.category}
                    </span>
                    <span>•</span>
                    <span>{formatFileSize(previewDoc.size)}</span>
                    <span>•</span>
                    <span>{new Date(previewDoc.uploadedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Viewer Control Bar */}
              <div className="flex items-center gap-2">
                {/* Image zoom & rotate controls */}
                {isImageDoc(previewDoc) && (
                  <div className="hidden sm:flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setZoomLevel(prev => Math.max(0.4, prev - 0.2))}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-500 px-1 min-w-[36px] text-center">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.2))}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <div className="h-4 w-px bg-slate-200 mx-0.5" />
                    <button
                      type="button"
                      onClick={() => setRotation(prev => (prev + 90) % 360)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                      title="Rotate 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenInNewWindow(previewDoc)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                  title="Open in new browser tab"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                  <span className="hidden sm:inline">New Tab</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadDocument(previewDoc)}
                  className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                  title="Close Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body / Viewer Canvas */}
            <div className="p-4 sm:p-6 flex-1 overflow-auto bg-slate-900/90 flex items-center justify-center min-h-[360px] max-h-[72vh] relative select-none">
              {(() => {
                const docSrc = previewBlobUrl || (previewDoc.dataUrl && previewDoc.dataUrl.startsWith('data:') ? previewDoc.dataUrl : getApiUrl(previewDoc.url || `/api/documents/${previewDoc.id}`));
                
                if (isImageDoc(previewDoc)) {
                  return (
                    <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
                      {docSrc ? (
                        <img
                          src={docSrc}
                          alt={previewDoc.name}
                          style={{
                            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                            transition: 'transform 0.2s ease-out'
                          }}
                          className="max-h-[64vh] max-w-full object-contain rounded-xl shadow-2xl transition-all"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="text-white text-center">
                          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                          <p className="text-xs font-bold">Image data is loading...</p>
                        </div>
                      )}
                    </div>
                  );
                }

                if (isPdfDoc(previewDoc)) {
                  return (
                    <div className="w-full h-full flex flex-col items-center justify-center">
                      {docSrc ? (
                        <div className="w-full h-full flex flex-col">
                          <object
                            data={docSrc}
                            type="application/pdf"
                            className="w-full h-[62vh] rounded-xl bg-white shadow-lg border border-slate-700"
                          >
                            <iframe
                              src={docSrc}
                              title={previewDoc.name}
                              className="w-full h-full rounded-xl bg-white border-0"
                            />
                          </object>
                          
                          {/* PDF Quick Open Action Banner */}
                          <div className="mt-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenInNewWindow(previewDoc)}
                              className="text-xs font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1.5 underline underline-offset-4"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              If PDF is not displaying inside browser frame, click here to open in full screen window
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-white text-center">
                          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                          <p className="text-xs font-bold">PDF data not available</p>
                        </div>
                      )}
                    </div>
                  );
                }

                if (isTextDoc(previewDoc) && textContent) {
                  return (
                    <div className="w-full h-full bg-slate-950 p-4 rounded-xl overflow-auto border border-slate-800 text-left font-mono text-xs text-slate-200 whitespace-pre-wrap max-h-[60vh]">
                      {textContent}
                    </div>
                  );
                }

                return (
                  <div className="bg-white p-8 rounded-3xl text-center max-w-md border border-slate-200 shadow-2xl">
                    <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mx-auto mb-4 shadow-sm">
                      {getFileIcon(previewDoc.name, previewDoc.type)}
                    </div>
                    <h5 className="font-extrabold text-slate-800 text-sm mb-1">{previewDoc.name}</h5>
                    <div className="flex justify-center items-center gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 text-[10px] font-black uppercase border border-teal-100">
                        {previewDoc.category}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">{formatFileSize(previewDoc.size)}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                      This file is stored in student record. Click below to download and view the original file with your local application.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <button
                        type="button"
                        onClick={() => handleDownloadDocument(previewDoc)}
                        className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black text-xs inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        Download {previewDoc.name.split('.').pop()?.toUpperCase()} File
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInNewWindow(previewDoc)}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open Link
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isOpenModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shadow-2xs">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
                  Student Document Vault: {lead.name}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-semibold flex-wrap">
                  <a
                    href={`tel:${lead.phone ? lead.phone.replace(/[^\d+]/g, '') : ''}`}
                    className="inline-flex items-center gap-1.5 text-emerald-900 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md font-bold transition-colors cursor-pointer"
                    title={`Click to call ${lead.phone}`}
                  >
                    <PhoneCall className="w-3 h-3 text-emerald-600" />
                    <span>{userRole === 'counselor' ? maskPhone(lead.phone) : lead.phone}</span>
                    <span className="text-[8px] uppercase tracking-wider bg-emerald-600 text-white font-black px-1.5 py-0.2 rounded-xs shadow-2xs">Call</span>
                  </a>
                  <a
                    href={`https://wa.me/${(lead.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hello ${lead.name}! This is Enrol Overseas regarding your documents.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center p-1 text-[#25D366] hover:text-[#20bd5a] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors cursor-pointer"
                    title={`WhatsApp chat with ${lead.name}`}
                  >
                    <WhatsAppOfficialIcon className="w-3.5 h-3.5" />
                  </a>
                  <span>•</span>
                  <span>{userRole === 'counselor' ? maskEmail(lead.email) : lead.email}</span>
                  {lead.counsellor && (
                    <>
                      <span>•</span>
                      <span>Assigned: {lead.counsellor}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            {onCloseModal && (
              <button
                type="button"
                onClick={onCloseModal}
                className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                title="Close Document Vault"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return content;
}
