import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Consistent framing for the auth pages, so they read as one flow. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {children}
        {footer ? <p className="text-center text-sm text-muted-foreground">{footer}</p> : null}
      </CardContent>
    </Card>
  );
}
