"use client";

import { useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface DocumentEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  width?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const widthClasses = {
  sm: "w-80", // 320px
  md: "w-[400px]",
  lg: "w-[480px]",
};

export function DocumentEditorPanel({
  isOpen,
  onClose,
  width = "md",
  children,
}: DocumentEditorPanelProps) {
  // Handle escape key to close panel
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full bg-white border-l border-border z-40",
          "transform transition-transform duration-300 ease-in-out",
          widthClasses[width],
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted transition-colors z-50"
          aria-label="Close panel"
        >
          <XIcon className="h-5 w-5 text-muted-foreground" />
        </button>

        {/* Panel content */}
        <div className="h-full overflow-hidden">{children}</div>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
