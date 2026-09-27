"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function SignInButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          // Redirects to GitHub; failures (e.g. not on the allowlist) come
          // back to "/" with ?error_description=… for the page to show.
          await authClient.signIn.social({ provider: "github", callbackURL: "/", errorCallbackURL: "/" });
        })
      }
    >
      {pending ? "Redirecting…" : "Sign in with GitHub"}
    </Button>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          router.refresh();
        })
      }
    >
      Sign out
    </Button>
  );
}
