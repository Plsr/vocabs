import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { Reader } from "./reader";

export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    const { error_description } = await searchParams;
    return (
      <main className="mx-auto max-w-sm w-full p-8 mt-24">
        <Card className="p-6 flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">Vocabs</h1>
          <p className="text-muted-foreground text-sm">Sign in to start reading.</p>
          {typeof error_description === "string" && (
            <Alert variant="destructive">
              <AlertDescription>{error_description}</AlertDescription>
            </Alert>
          )}
          <SignInButton />
        </Card>
      </main>
    );
  }

  return (
    <>
      <header className="mx-auto max-w-3xl w-full px-8 pt-4 flex items-center justify-end gap-3 text-sm">
        <span className="text-muted-foreground">{session.user.githubLogin ?? session.user.name}</span>
        <SignOutButton />
      </header>
      <Reader />
    </>
  );
}
