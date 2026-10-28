'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Native modal supplies focus containment, background inertness and Escape handling. */
export function AdminDialog({
  children,
  onClose,
  busy = false,
  className = '',
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`admin-native-dialog ${className}`}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      {children}
    </dialog>
  );
}
