"use client";

import { useEffect, useRef, useState } from "react";
import { renderDocxPreview } from "@/components/docx-preview-render";

type Status = "loading" | "ready" | "error";

/**
 * Renders a .docx file in-browser via `docx-preview`. Client-only — the
 * renderer manipulates the DOM directly, and its module code is only ever
 * loaded inside the effect below (a dynamic `import()`), so nothing from it
 * runs during SSR.
 */
export function DocxPreview({ previewUrl }: { previewUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    container.innerHTML = "";
    setStatus("loading");

    renderDocxPreview(previewUrl, container).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        console.error("Failed to render DOCX preview:", result.error);
      }
      setStatus(result.success ? "ready" : "error");
    });

    return () => {
      cancelled = true;
    };
  }, [previewUrl]);

  if (status === "error") {
    return <p className="p-8 text-center text-sm text-muted">Unable to preview this Word document.</p>;
  }

  return (
    <div>
      {status === "loading" ? (
        <p className="p-8 text-center text-sm text-muted">Loading document preview...</p>
      ) : null}
      <div
        ref={containerRef}
        className={status === "ready" ? "max-h-[70vh] overflow-y-auto p-4" : "hidden"}
      />
    </div>
  );
}
