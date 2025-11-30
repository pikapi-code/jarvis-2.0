import React, { useEffect } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface NotificationProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
  duration?: number;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Check size={18} className="text-emerald-400" />;
      case 'error':
        return <X size={18} className="text-red-400" />;
      case 'warning':
        return <AlertTriangle size={18} className="text-amber-400" />;
      case 'info':
        return <Info size={18} className="text-blue-400" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200';
      case 'error':
        return 'bg-red-950/90 border-red-500/30 text-red-200';
      case 'warning':
        return 'bg-amber-950/90 border-amber-500/30 text-amber-200';
      case 'info':
        return 'bg-blue-950/90 border-blue-500/30 text-blue-200';
    }
  };

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-lg animate-in slide-in-from-top max-w-md w-full mx-4 ${getStyles()}`}
      role="alert"
    >
      {getIcon()}
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="ml-2 text-current/60 hover:text-current transition-colors"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default Notification;

