"use client";

import { Button, Icon } from "@/components/ds";

export default function PrintButton() {
  return (
    <Button variant="dark" onClick={() => window.print()}>
      <Icon name="print" size={16} />
      Print
    </Button>
  );
}
