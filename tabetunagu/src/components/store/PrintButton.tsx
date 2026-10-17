"use client";

import { Printer } from "lucide-react";
import { Button } from "../ui/Button";

export function PrintButton() {
  return (
    <Button variant="dark" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />
      印刷する
    </Button>
  );
}
