"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { joinLeague } from "@/app/actions";
import { UserPlus } from "lucide-react";

export function JoinLeagueDialog() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError("");
    setLoading(true);
    const result = await joinLeague(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1">
          <UserPlus className="h-4 w-4" />
          Join League
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a League</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <Input
            name="code"
            placeholder="Enter 6-character invite code"
            required
            maxLength={6}
            className="text-center text-lg uppercase tracking-widest"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Joining..." : "Join League"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
