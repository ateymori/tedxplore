"use client";

export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          An unexpected error occurred. You can try again.
        </p>
        <button
          onClick={() => unstable_retry()}
          className="text-sm font-medium underline underline-offset-4"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
