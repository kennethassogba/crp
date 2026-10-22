import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { t } from "./i18n";
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal();
    else if (!open && ref.current?.open) ref.current.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const b = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < b.left ||
          e.clientX > b.right ||
          e.clientY < b.top ||
          e.clientY > b.bottom
        )
          ref.current?.close();
      }}
    >
      <header className="sheet-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label={t("Fermer") + " " + title}
          onClick={() => ref.current?.close()}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </header>
      <div className="sheet-body">{children}</div>
    </dialog>
  );
}
