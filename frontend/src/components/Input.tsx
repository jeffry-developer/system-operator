import { forwardRef, InputHTMLAttributes, LabelHTMLAttributes } from 'react';
import { cn } from '../utils/helpers';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            'w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
            error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300',
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <label ref={ref} className={cn('block text-sm font-medium text-gray-700 mb-1', className)} {...props}>
        {children}
      </label>
    );
  }
);

Label.displayName = 'Label';