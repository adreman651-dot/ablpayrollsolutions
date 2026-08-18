import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { fetchTodaysCelebrations, ordinal, todayKey, type Celebrations } from "@/lib/celebrations";

const AUTHORIZED_ROLES = ["admin", "hr", "payroll_officer"];

export default function CelebrationDialog() {
  const { roles, loading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Celebrations | null>(null);

  const authorized = roles.some(r => AUTHORIZED_ROLES.includes(r));

  useEffect(() => {
    if (loading || !authorized) return;
    const flagKey = `celebration_notification_${todayKey()}`;
    if (localStorage.getItem(flagKey) === "shown") return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetchTodaysCelebrations();
        if (cancelled) return;
        if (res.birthdays.length === 0 && res.anniversaries.length === 0) return;
        setData(res);
        setOpen(true);
        localStorage.setItem(flagKey, "shown");
      } catch {
        /* silent — greeting is non-critical */
      }
    })();
    return () => { cancelled = true; };
  }, [loading, authorized]);

  if (!data) return null;

  const { birthdays, anniversaries, companyName } = data;
  const single = birthdays.length + anniversaries.length === 1;
  const onlyBirthday = single && birthdays.length === 1;
  const onlyAnniversary = single && anniversaries.length === 1;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {onlyBirthday ? "🎂 Happy Birthday!" : onlyAnniversary ? "🎉 Happy Work Anniversary!" : "🎉 Today's Celebrations!"}
          </DialogTitle>
        </DialogHeader>

        {onlyBirthday ? (
          <div className="space-y-3 text-sm">
            <p className="text-base font-semibold">Happy Birthday, {birthdays[0].firstName}! 🎉</p>
            <p className="text-muted-foreground">
              Wishing you a wonderful birthday filled with happiness, good health, and success.
            </p>
            <p className="text-muted-foreground">Have a great day!</p>
          </div>
        ) : onlyAnniversary ? (
          <div className="space-y-3 text-sm">
            <p className="text-base font-semibold">Congratulations, {anniversaries[0].firstName}!</p>
            <p className="text-muted-foreground">
              Today marks your {ordinal(anniversaries[0].years)} year with {companyName}.
            </p>
            <p className="text-muted-foreground">
              Thank you for your dedication and hard work. We appreciate everything you do!
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            {birthdays.length > 0 && (
              <div>
                <p className="font-semibold mb-1">🎂 Birthday</p>
                <ul className="space-y-1 text-muted-foreground">
                  {birthdays.map(b => <li key={b.id}>• {b.name}</li>)}
                </ul>
              </div>
            )}
            {anniversaries.length > 0 && (
              <div>
                <p className="font-semibold mb-1">🏆 Work Anniversary</p>
                <ul className="space-y-1 text-muted-foreground">
                  {anniversaries.map(a => (
                    <li key={a.id}>• {a.name} — {a.years} {a.years === 1 ? "Year" : "Years"}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {!single && (
            <Button variant="outline" onClick={() => { setOpen(false); navigate("/employees"); }}>
              View Employees
            </Button>
          )}
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
