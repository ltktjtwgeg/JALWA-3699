import React, { useState, useEffect } from 'react';
import { Folder, File, Upload, Trash2, ChevronRight, Home, Image as ImageIcon, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

export default function AssetManagement() {
  const [currentFolder, setCurrentFolder] = useState('');
  const [items, setItems] = useState<{ folders: string[], files: string[] }>({ folders: [], files: [] });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customFilename, setCustomFilename] = useState('');

  const fetchAssets = async (folder: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/assets/list?folder=${encodeURIComponent(folder)}`);
      const data = await res.json();
      setItems(data);
    } catch (e) {
      toast.error('Failed to fetch assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets(currentFolder);
  }, [currentFolder]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('folder', currentFolder);
    if (customFilename) {
      formData.append('filename', customFilename);
    }

    try {
      const res = await fetch('/api/admin/assets/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success('File uploaded successfully');
        setSelectedFile(null);
        setCustomFilename('');
        fetchAssets(currentFolder);
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (e) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to delete ${filename}?`)) return;

    try {
      const res = await fetch('/api/admin/assets/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: currentFolder, filename }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('File deleted');
        fetchAssets(currentFolder);
      } else {
        toast.error(data.error || 'Delete failed');
      }
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const breadcrumbs = currentFolder.split('/').filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-purple-500" />
          Asset Management
        </h2>
        <button 
          onClick={() => fetchAssets(currentFolder)}
          className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-400 bg-gray-900/50 p-3 rounded-xl border border-white/5">
        <button 
          onClick={() => setCurrentFolder('')}
          className="hover:text-white flex items-center gap-1"
        >
          <Home className="w-4 h-4" />
          images
        </button>
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={idx}>
            <ChevronRight className="w-4 h-4 text-gray-600" />
            <button 
              onClick={() => setCurrentFolder(breadcrumbs.slice(0, idx + 1).join('/'))}
              className="hover:text-white"
            >
              {crumb}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Upload Section */}
      <div className="bg-gray-900/80 p-6 rounded-2xl border border-white/5 space-y-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Upload to /{currentFolder}
        </h3>
        <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-gray-500 ml-1">Select File</label>
            <input 
              type="file" 
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-gray-300 focus:outline-none focus:border-purple-500/50"
              accept="image/*"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-gray-500 ml-1">Custom Filename (Optional)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. logo_new"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-gray-300 focus:outline-none focus:border-purple-500/50"
              />
              <button 
                type="submit"
                disabled={!selectedFile || uploading}
                className="px-6 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all flex items-center gap-2"
              >
                {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Folders */}
        {items.folders.map(folder => (
          <button
            key={folder}
            onClick={() => setCurrentFolder(currentFolder ? `${currentFolder}/${folder}` : folder)}
            className="flex flex-col items-center gap-3 p-4 bg-gray-900 border border-white/5 rounded-2xl hover:border-purple-500/30 hover:bg-purple-500/5 transition-all group"
          >
            <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Folder className="w-6 h-6 text-purple-500" />
            </div>
            <span className="text-xs font-medium text-gray-300 truncate w-full text-center">{folder}</span>
          </button>
        ))}

        {/* Files */}
        {items.files.map(file => (
          <div
            key={file}
            className="flex flex-col items-center gap-2 p-3 bg-gray-900 border border-white/5 rounded-2xl relative group"
          >
            <div className="w-full aspect-square bg-black/40 rounded-xl overflow-hidden flex items-center justify-center relative">
              <img 
                src={`/images/${currentFolder ? currentFolder + '/' : ''}${file}`} 
                alt={file}
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                   e.currentTarget.src = 'https://via.placeholder.com/150?text=Error';
                }}
              />
              <button 
                onClick={() => handleDelete(file)}
                className="absolute top-1 right-1 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <span className="text-[10px] text-gray-400 truncate w-full text-center px-1" title={file}>{file}</span>
          </div>
        ))}

        {!loading && items.folders.length === 0 && items.files.length === 0 && (
          <div className="col-span-full py-12 text-center space-y-2">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto text-gray-600">
              <Folder className="w-8 h-8" />
            </div>
            <p className="text-gray-500 text-sm">Target folder is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
