import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const Field = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cn('grid gap-2', className)}
      ref={ref}
      {...props}
    />
  ),
);
Field.displayName = 'Field';

const FieldGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div className={cn('grid gap-4', className)} ref={ref} {...props} />,
);
FieldGroup.displayName = 'FieldGroup';

const FieldLabel = React.forwardRef<
  React.ElementRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => (
  <Label className={cn('mb-0.5', className)} ref={ref} {...props} />
));
FieldLabel.displayName = 'FieldLabel';

const FieldDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p className={cn('text-sm text-muted-foreground', className)} ref={ref} {...props} />
  ),
);
FieldDescription.displayName = 'FieldDescription';

type FieldErrorProps = React.HTMLAttributes<HTMLParagraphElement> & {
  errors?: Array<{ message?: string } | undefined>;
};

const FieldError = React.forwardRef<HTMLParagraphElement, FieldErrorProps>(
  ({ className, errors, ...props }, ref) => {
    const message = errors?.find((error) => error?.message)?.message;
    if (!message) {
      return null;
    }

    return (
      <p
        className={cn('rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700', className)}
        ref={ref}
        {...props}
      >
        {message}
      </p>
    );
  },
);
FieldError.displayName = 'FieldError';

export { Field, FieldDescription, FieldError, FieldGroup, FieldLabel };
