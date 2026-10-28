"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.documentElement.style.overflow = overflow;
      // Restore after React removes the dialog, so native close handling cannot reset focus.
      queueMicrotask(() => {
        if (previous?.isConnected && !document.querySelector("dialog[open]"))
          previous.focus({ preventScroll: true });
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose();
        }
      }}
      className={`m-auto w-[calc(100%-1.5rem)] ${wide ? "max-w-5xl" : "max-w-2xl"} max-h-[90dvh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-0 text-slate-100 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm`}
    >
      <div className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-white/10 bg-slate-900/95 px-5 py-4 backdrop-blur-xl">
        <h2 className="font-bold truncate">{title}</h2>
        <button
          type="button"
          aria-label="Close dialog"
          onClick={onClose}
          className="rounded-full bg-white/5 p-2 hover:bg-white/15"
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
