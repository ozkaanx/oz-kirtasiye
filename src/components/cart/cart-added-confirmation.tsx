'use client';

import { useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { useShop } from '@/context/shop-context';
import styles from './cart-added-confirmation.module.css';

export function CartAddedConfirmation() {
  const { cartFeedback, dismissCartFeedback } = useShop();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = cartFeedback !== null;
  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  if (!cartFeedback) return null;
  const success = cartFeedback.kind === 'success';
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="cart-confirm-title"
      aria-describedby="cart-confirm-message"
      onCancel={(event) => {
        event.preventDefault();
        dismissCartFeedback();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          dismissCartFeedback();
      }}
    >
      <button
        className={styles.close}
        type="button"
        aria-label="Bildirimi kapat"
        onClick={dismissCartFeedback}
      >
        <X size={26} />
      </button>
      <h2 id="cart-confirm-title">{success ? 'Sepete eklendi' : 'Sepete eklenemedi'}</h2>
      <p id="cart-confirm-message">
        {cartFeedback.kind === 'success'
          ? `${cartFeedback.quantity} adet ürün sepetine eklendi.`
          : cartFeedback.message}
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.continue} onClick={dismissCartFeedback}>
          Alışverişe devam et
        </button>
        <Link href="/sepet" className={styles.cart} onClick={dismissCartFeedback}>
          Sepeti görüntüle
        </Link>
      </div>
    </dialog>
  );
}
