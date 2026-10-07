import React, { useId } from 'react';
import { Button } from '../ui/primitives';
import { Dialog, DialogPanel } from './Dialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** An in-app replacement for window.confirm, for actions that change or delete data. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}) => {
  const titleId = useId();
  return (
    <Dialog isOpen={isOpen} onClose={busy ? () => {} : onCancel} titleId={titleId} className="max-w-sm">
      <DialogPanel className="p-6">
        <h2 id={titleId} className="text-[17px] font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-2 text-[13px] leading-relaxed text-ink-muted">{children}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onCancel} disabled={busy} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </DialogPanel>
    </Dialog>
  );
};
