"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignOutButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <Button variant="outline" size="sm" onClick={signOut} disabled={disabled}>
      <LogOut className="size-4" /> Sign out
    </Button>
  );
}
