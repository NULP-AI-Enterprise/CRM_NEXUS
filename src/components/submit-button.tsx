"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

export function SubmitButton({
  children,
  pendingText,
  className,
  ...props
}: ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className={className} {...props}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}
