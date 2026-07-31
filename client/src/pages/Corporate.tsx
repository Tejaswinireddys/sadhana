import { useState } from "react";
import { FadeIn } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { readTenant, writeTenant, type CorporateTenant } from "@/lib/corporate";
import { useToast } from "@/hooks/use-toast";

export default function Corporate() {
  useDocumentTitle("Corporate wellness · Sadhana");
  const { toast } = useToast();
  const [tenant, setTenant] = useState<CorporateTenant>(() => readTenant());

  const save = () => {
    if (!tenant.name.trim()) {
      toast({ title: "Organization name required", variant: "destructive" });
      return;
    }
    writeTenant(tenant);
    toast({
      title: "Tenant saved locally",
      description: "SSO and DPA wiring come next — aggregates never expose individuals.",
    });
  };

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Corporate wellness</h1>
        <p className="text-muted-foreground">
          Tenant admin for desk, stress, and inclusive chair tracks. Reporting is aggregate-only —
          no individual health disclosure.
        </p>
      </header>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-xl">Tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="corp-name">Organization</Label>
            <Input
              id="corp-name"
              className="min-h-11"
              value={tenant.name}
              onChange={(e) => setTenant({ ...tenant, name: e.target.value })}
              data-testid="corporate-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="corp-seats">Seats</Label>
            <Input
              id="corp-seats"
              type="number"
              className="min-h-11"
              min={5}
              value={tenant.seats}
              onChange={(e) => setTenant({ ...tenant, seats: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="SSO provider">
            {(["none", "okta", "azure", "google"] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                className="min-h-11 capitalize"
                variant={tenant.ssoProvider === p ? "default" : "outline"}
                onClick={() => setTenant({ ...tenant, ssoProvider: p })}
              >
                {p === "none" ? "No SSO yet" : p}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Program library: {tenant.programs.join(", ")}
          </p>
          <Button className="min-h-11" onClick={save} data-testid="corporate-save">
            Save tenant
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-xl">Aggregate dashboard</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-serif text-2xl">{tenant.aggregates.weeklyActive}</p>
            <p className="text-xs text-muted-foreground">Weekly active</p>
          </div>
          <div>
            <p className="font-serif text-2xl">{tenant.aggregates.sessionsCompleted}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div>
            <p className="font-serif text-2xl">{tenant.aggregates.avgMinutes}</p>
            <p className="text-xs text-muted-foreground">Avg minutes</p>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  );
}
