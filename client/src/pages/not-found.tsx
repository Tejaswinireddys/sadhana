import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function NotFound() {
  useDocumentTitle("Page not found · Sadhana");
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center">
      <Card className="mx-4 w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
          <Compass className="h-10 w-10 text-primary" />
          <h1 className="font-serif text-3xl">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            This page doesn't exist — perhaps it wandered off to meditate.
          </p>
          <Button asChild data-testid="button-notfound-home">
            <Link href="/">Back to your practice</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
