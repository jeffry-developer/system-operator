import { ReactNode, useEffect } from 'react';
import { cn } from '../utils/helpers';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className={cn(
            'relative w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl transition-all',
            className
          )}
        >
          {(title || onClose) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          <div className="px-6 py-4 max-h-[calc(90vh-140px)] overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}