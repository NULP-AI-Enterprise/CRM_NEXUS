import type { Metadata } from "next";

import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export const metadata: Metadata = {
  title: "Підтвердження email — Personal CRM",
};

export default function ResendVerificationPage() {
  return <ResendVerificationForm />;
}
