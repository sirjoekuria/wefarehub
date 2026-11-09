"use client";

import { IconPrint } from "./icons";

export function PrintButton() {
  return (
    <button className="rh-btn rh-btn-primary" onClick={() => window.print()}>
      <IconPrint className="w-4 h-4" /> Print / save PDF
    </button>
  );
}
