import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'danger'
}) => {
  if (!isOpen) return null;

  const isDanger = type === 'danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-space-900 border border-white/10 rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 p-2 rounded-full ${isDanger ? 'bg-red-500/20' : 'bg-amber-500/20'}`}>
              <AlertTriangle size={24} className={isDanger ? 'text-red-400' : 'text-amber-400'} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-200 mb-2">{title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
            </div>
            <button
              onClick={onCancel}
              className="flex-shrink-0 text-slate-500 hover:text-slate-300 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 p-6 border-t border-white/5">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-white/5"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              isDanger
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;

