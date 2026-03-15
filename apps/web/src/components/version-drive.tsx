'use client';

import { useRef, useState } from 'react';
import { useVersionFiles, useUploadVersionFile, useRenameVersionFile, useDeleteVersionFile, useVersionFileUrl } from '@/hooks/useVersionFiles';
import type { VersionFile } from '@lambda/shared';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileCard({
  file,
  versionId,
  isAuthor,
  onDelete,
}: {
  file: VersionFile;
  versionId: string;
  isAuthor: boolean;
  onDelete: (id: string) => void;
}) {
  const { getViewUrl } = useVersionFileUrl(versionId);
  const rename = useRenameVersionFile(versionId);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(file.display_name);

  const handleView = async () => {
    setLoading(true);
    try {
      const { url } = await getViewUrl(file.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameSubmit = async () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === file.display_name) { setEditing(false); return; }
    await rename.mutateAsync({ fileId: file.id, displayName: trimmed });
    setEditing(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') { setEditName(file.display_name); setEditing(false); }
  };

  return (
    <div className="group relative bg-white border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:shadow-sm transition-all">
      {/* Author actions — top-right corner */}
      {isAuthor && (
        <div className={`absolute top-2 right-2 flex items-center gap-0.5 transition-opacity ${editing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          {!editing && (
            <button
              onClick={(e) => { e.stopPropagation(); setEditName(file.display_name); setEditing(true); }}
              title="Rename"
              className="p-1 rounded text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
            title="Delete"
            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
        </div>
      )}

      {/* Clickable body */}
      <button
        onClick={editing ? undefined : handleView}
        disabled={loading}
        className="w-full text-left flex items-center gap-3 disabled:opacity-50"
      >
        {/* PDF icon */}
        <div className="shrink-0 w-8 h-8 bg-red-50 rounded-md flex items-center justify-center">
          {loading ? (
            <svg className="w-4 h-4 animate-spin text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="15" y2="17" />
            </svg>
          )}
        </div>

        {/* Name + size */}
        <div className="min-w-0">
          {editing ? (
            <input
              autoFocus
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              dir="auto"
              className="w-full text-sm border border-gray-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          ) : (
            <p className="text-sm text-gray-800 truncate" dir="auto">{file.display_name}</p>
          )}
          <p className="text-xs text-gray-400">{formatBytes(file.size_bytes)}</p>
        </div>
      </button>
    </div>
  );
}

function UploadForm({ versionId, fileCount }: { versionId: string; fileCount: number }) {
  const upload = useUploadVersionFile(versionId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setError('Only PDF files are allowed'); return; }
    if (file.size > MAX_SIZE_BYTES) { setError(`File is too large. Maximum size is ${MAX_SIZE_MB} MB`); return; }
    setError('');
    setSelectedFile(file);
    setDisplayName(file.name.replace(/\.pdf$/i, ''));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setError('');
    try {
      await upload.mutateAsync({ file: selectedFile, displayName: displayName.trim() || selectedFile.name });
      setSelectedFile(null);
      setDisplayName('');
      if (inputRef.current) inputRef.current.value = '';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    }
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setDisplayName('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  if (fileCount >= 20) return null;

  return (
    <>
      {selectedFile ? (
        <div className="mt-4 p-3 border border-gray-200 rounded-lg space-y-2 bg-white">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name..."
            dir="auto"
            className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 flex-1 truncate">{selectedFile.name} · {formatBytes(selectedFile.size)}</span>
            <button onClick={handleCancel} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 border border-gray-200 rounded-md">Cancel</button>
            <button onClick={handleUpload} disabled={upload.isPending} className="text-xs px-3 py-1 bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
              {upload.isPending ? 'Uploading...' : 'Upload'}
            </button>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors mt-1"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload PDF
          {error && <span className="text-xs text-red-500 ml-1">{error}</span>}
        </button>
      )}
      <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileChange} />
    </>
  );
}

export function VersionDrive({
  versionId,
  isAuthor,
  className = '',
}: {
  versionId: string;
  isAuthor: boolean;
  className?: string;
}) {
  const { data: files, isLoading } = useVersionFiles(versionId);
  const deleteFile = useDeleteVersionFile(versionId);

  const handleDelete = async (fileId: string) => {
    if (!window.confirm('Delete this file?')) return;
    await deleteFile.mutateAsync(fileId);
  };

  return (
    <div className={className}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-700">Study Materials</p>
          {isAuthor && <p className="text-xs text-gray-400">PDF only · up to {MAX_SIZE_MB} MB · max 20 files</p>}
        </div>
      </div>

      {isLoading && <p className="text-sm text-gray-400">Loading...</p>}

      {!isLoading && (!files || files.length === 0) && (
        <p className="text-sm text-gray-400">{isAuthor ? 'No files yet.' : 'No study materials available.'}</p>
      )}

      {files && files.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {files.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              versionId={versionId}
              isAuthor={isAuthor}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {isAuthor && (
        <div className="mt-4">
          <UploadForm versionId={versionId} fileCount={files?.length ?? 0} />
        </div>
      )}
    </div>
  );
}
