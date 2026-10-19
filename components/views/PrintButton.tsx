"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-sm btn-line bg-white print:hidden" onClick={() => window.print()}>
      Export PDF
    </button>
  );
}
