import { SITE_NAME, SITE_DESCRIPTION } from "@/config/site";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">{SITE_NAME}</h1>
      <p className="max-w-md text-lg text-muted-foreground">{SITE_DESCRIPTION}</p>
    </main>
  );
}
