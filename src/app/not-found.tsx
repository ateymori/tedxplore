import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-lg text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link href="/" className="text-sm font-medium underline underline-offset-4">
        Back to home
      </Link>
    </main>
  );
}
