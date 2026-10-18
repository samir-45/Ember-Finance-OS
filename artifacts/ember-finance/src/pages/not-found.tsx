import { Link } from "wouter";
import { Button } from "@workspace/ember-design-system/components/ui/button";
import { Flame } from "lucide-react";

export default function NotFoundPage() {
  return <main className="ember-atmosphere dark flex min-h-[100dvh] items-center justify-center px-5 text-foreground">
    <div className="relative z-10 max-w-lg text-center"><div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Flame /></div><p className="mt-8 text-xs uppercase tracking-[0.2em] text-primary">404 · off the map</p><h1 className="mt-3 text-4xl font-light tracking-tight">This page wandered off.</h1><p className="mt-4 text-sm leading-relaxed text-muted-foreground">The link may have changed, or this space may not exist. Your money is still where you left it.</p><Button asChild className="mt-7" data-testid="button-back-home"><Link href="/">Return to Ember</Link></Button></div>
  </main>;
}
