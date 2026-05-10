import { useState, useRef } from 'react';
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Upload, X, Check, Image } from 'lucide-react';

/**
 * LogoUploader – supports SVG (vector) and PNG/WEBP/JPG.
 * SVGs are stored as-is (vector, tiny file size).
 * All uploads go to Firebase Storage at: companyLogos/{companyId}/logo.{ext}
 */
export default function LogoUploader({ companyId, currentURL, onUpload }) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const inputRef = useRef();

  const ACCEPTED = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];
  const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

  const processFile = async (file) => {
    setError('');
    setDone(false);

    if (!ACCEPTED.includes(file.type)) {
      setError('Only SVG, PNG, JPG, or WEBP files allowed.');
      return;
    }
    if (file.size > MAX_SIZE) {
      setError('File too large. Max 2 MB.');
      return;
    }

    // Local preview
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(file);

    if (!companyId) {
      // If no companyId yet (new company), just set the preview URL as data URI
      // The parent will store it after saving
      onUpload(URL.createObjectURL(file), file);
      return;
    }

    // Upload to Firebase Storage
    try {
      setUploading(true);
      const ext = file.name.split('.').pop().toLowerCase();
      const storageRef = ref(storage, `companyLogos/${companyId}/logo.${ext}`);
      await uploadBytes(storageRef, file, { contentType: file.type, cacheControl: 'public,max-age=31536000' });
      const url = await getDownloadURL(storageRef);
      onUpload(url, file);
      setDone(true);
    } catch (e) {
      console.error(e);
      setError('Upload failed: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const displaySrc = preview || currentURL;

  return (
    <div style={{ width: '100%' }}>
      <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151', display: 'block', marginBottom: 8 }}>
        Company Logo <span style={{ fontSize: '0.72rem', fontWeight: 400, color: '#94a3b8' }}>(SVG recommended — vector, tiny size)</span>
      </label>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#6366f1' : '#e2e8f0'}`,
          borderRadius: 14,
          padding: 20,
          cursor: 'pointer',
          background: dragging ? '#eff6ff' : '#fafafa',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          transition: 'all 0.2s',
        }}>
        {/* Preview */}
        <div style={{ width: 64, height: 64, borderRadius: 12, border: '1px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
          {displaySrc ? (
            <img src={displaySrc} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={e => { e.target.style.display = 'none'; }} />
          ) : (
            <Image size={24} color="#cbd5e1" />
          )}
        </div>

        <div style={{ flex: 1 }}>
          {uploading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6366f1', fontWeight: 600, fontSize: '0.85rem' }}>
              <div style={{ width: 16, height: 16, border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              Uploading...
            </div>
          ) : done ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
              <Check size={16} /> Logo uploaded successfully!
            </div>
          ) : (
            <>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>
                {displaySrc ? 'Click or drag to replace logo' : 'Click or drag & drop your logo'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 3 }}>
                SVG (vector) · PNG · JPG · WEBP — Max 2 MB
              </div>
            </>
          )}
          {error && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: 4 }}>{error}</div>}
        </div>

        {displaySrc && !uploading && (
          <button
            onClick={e => { e.stopPropagation(); setPreview(null); onUpload('', null); setDone(false); }}
            style={{ background: '#fef2f2', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <X size={14} />
          </button>
        )}

        <Upload size={18} color="#94a3b8" style={{ flexShrink: 0 }} />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".svg,image/svg+xml,.png,image/png,.jpg,.jpeg,image/jpeg,.webp,image/webp"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
