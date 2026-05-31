export default function ConfirmDialog({ isOpen, title, message, confirmText = 'Delete', cancelText = 'Cancel', onConfirm, onClose, loading = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface-white rounded-3xl border border-outline-variant/10 p-6 shadow-card max-w-sm w-full animate-in zoom-in-95 duration-200">
        {/* Icon & Title */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-error-container/10 text-error flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-error">warning</span>
          </div>
          <h3 className="text-headline-sm font-bold text-primary leading-tight">{title}</h3>
        </div>

        {/* Message */}
        <p className="text-body-md text-on-surface-variant mb-6 leading-relaxed">
          {message}
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-outline-variant text-on-surface text-label-md font-semibold hover:bg-surface-container-low active:scale-95 transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl bg-error text-on-error text-label-md font-bold hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {loading && <span className="material-symbols-outlined animate-spin text-body-sm">sync</span>}
            <span>{loading ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
