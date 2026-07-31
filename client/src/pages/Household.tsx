import { useState } from "react";
import { FadeIn } from "@/components/motion";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMember,
  readHousehold,
  roleDefaults,
  setActiveMember,
  verifyPin,
  writeHousehold,
  type HouseholdMember,
  type HouseholdRole,
} from "@/lib/household";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";

const ROLES: HouseholdRole[] = ["adult", "child", "senior", "prenatal", "postnatal"];

export default function Household() {
  useDocumentTitle("Household · Sadhana");
  const { toast } = useToast();
  const [household, setHousehold] = useState(() => readHousehold());
  const [name, setName] = useState("");
  const [role, setRole] = useState<HouseholdRole>("adult");
  const [pin, setPin] = useState("");
  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [pinAttempt, setPinAttempt] = useState("");

  const create = () => {
    if (name.trim().length < 2) {
      toast({ title: "Use at least 2 characters for a name", variant: "destructive" });
      return;
    }
    const h = addMember({
      name: name.trim(),
      role,
      pin: pin.trim() || undefined,
    });
    setHousehold({ ...h });
    setName("");
    setPin("");
    toast({ title: "Household member added" });
  };

  const activate = (m: HouseholdMember) => {
    if (m.pin && !verifyPin(m, pinAttempt)) {
      setUnlockId(m.id);
      toast({ title: "Enter PIN to switch", variant: "destructive" });
      return;
    }
    const h = setActiveMember(m.id);
    setHousehold({ ...h });
    setUnlockId(null);
    setPinAttempt("");
    toast({ title: `Active: ${m.name}`, description: roleDefaults(m.role).note });
  };

  return (
    <FadeIn className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="font-serif text-3xl font-semibold tracking-tight">Household</h1>
        <p className="text-muted-foreground">
          Separate adult, child, senior, and prenatal/postnatal experiences on a shared device. PINs
          stay on this browser only.
        </p>
      </header>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-xl">Add member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="hh-name">Name</Label>
            <Input
              id="hh-name"
              className="min-h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="household-name"
            />
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Role">
            {ROLES.map((r) => (
              <Button
                key={r}
                size="sm"
                className="min-h-11 capitalize"
                variant={role === r ? "default" : "outline"}
                onClick={() => setRole(r)}
              >
                {r}
              </Button>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="hh-pin">Optional 4-digit PIN</Label>
            <Input
              id="hh-pin"
              className="min-h-11"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
          <Button className="min-h-11" onClick={create} data-testid="household-add">
            Add to household
          </Button>
        </CardContent>
      </Card>

      <ul className="space-y-3">
        {household.members.map((m) => {
          const hint = roleDefaults(m.role);
          const active = household.activeId === m.id;
          return (
            <li key={m.id}>
              <Card className={active ? "border-primary shadow-soft" : "shadow-soft"}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {m.name}{" "}
                        <span className="text-sm capitalize text-muted-foreground">· {m.role}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">{hint.note}</p>
                    </div>
                    <Button
                      className="min-h-11"
                      variant={active ? "default" : "outline"}
                      onClick={() => activate(m)}
                    >
                      {active ? "Active" : "Switch"}
                    </Button>
                  </div>
                  {unlockId === m.id && (
                    <div className="flex gap-2">
                      <Input
                        className="min-h-11"
                        placeholder="PIN"
                        inputMode="numeric"
                        value={pinAttempt}
                        onChange={(e) => setPinAttempt(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        aria-label={`PIN for ${m.name}`}
                      />
                      <Button className="min-h-11" onClick={() => activate(m)}>
                        Unlock
                      </Button>
                    </div>
                  )}
                  <Button variant="ghost" className="h-auto px-0 text-primary underline-offset-4 hover:underline" asChild>
                    <Link href={hint.pathwayHint}>Suggested path</Link>
                  </Button>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      {household.members.length > 0 && (
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() => {
            writeHousehold({ members: [], activeId: null });
            setHousehold({ members: [], activeId: null });
          }}
        >
          Clear household on this device
        </Button>
      )}
    </FadeIn>
  );
}
