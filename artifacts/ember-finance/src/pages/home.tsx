import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@workspace/ember-design-system/components/ui/button";
import { Card, CardContent } from "@workspace/ember-design-system/components/ui/card";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Flame, Globe2, ShieldCheck, Sparkles } from "lucide-react";

const pillars = [
  { icon: Globe2, title: "Two currencies. One life.", body: "Keep USD earnings and BDT spending side by side, without pretending every conversion is the same." },
  { icon: ShieldCheck, title: "Private by default.", body: "A personal workspace with thoughtful privacy controls and a complete export whenever you need it." },
  { icon: Sparkles, title: "Clarity, not bookkeeping.", body: "Notice what matters, plan for what’s coming, and give your money a little more direction." },
];

export default function HomePage() {
  return <main className="ember-atmosphere dark relative min-h-[100dvh] overflow-hidden text-foreground">
    <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
      <header className="flex h-20 items-center justify-between border-b border-border/50">
        <Link href="/" className="flex items-center gap-2.5" data-testid="link-home-brand"><span className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Flame className="size-5" /></span><span className="text-lg font-semibold tracking-tight">Ember</span></Link>
        <div className="flex items-center gap-2"><Link href="/sign-in" className="rounded-md px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground" data-testid="link-sign-in">Sign in</Link><Button asChild size="sm" data-testid="button-get-started"><Link href="/sign-up">Create your space <ArrowRight className="size-4" /></Link></Button></div>
      </header>
      <section className="grid min-h-[620px] items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-primary"><span className="size-1.5 rounded-full bg-primary" />Made for your money, here and everywhere</p>
          <h1 className="max-w-3xl text-5xl font-light leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">A clearer way to hold <span className="text-primary">both worlds.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">Ember is your private finance space for earning in USD and living in BDT. See the whole picture, make thoughtful decisions, and feel a little more at home with your money.</p>
          <div className="mt-9 flex flex-wrap gap-3"><Button asChild size="lg" data-testid="button-create-account"><Link href="/sign-up">Create your private space <ArrowRight className="size-4" /></Link></Button><Button asChild variant="outline" size="lg" data-testid="button-sign-in-home"><Link href="/sign-in">Sign in</Link></Button></div>
          <p className="mt-5 text-xs text-muted-foreground">Private by design · Made for independent work</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.12 }} className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-8 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <Card className="relative rotate-[-1deg] overflow-hidden ember-glass shadow-2xl">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">A calmer money picture</p><p className="mt-2 text-sm text-foreground">Your month, together</p></div><div className="rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground">USD · BDT</div></div>
              <div className="mt-9"><p className="text-xs uppercase tracking-wider text-muted-foreground">Across your accounts</p><p className="ember-number mt-2 text-4xl font-light sm:text-5xl">$8,420<span className="text-2xl text-muted-foreground">.00</span></p><p className="mt-2 text-sm text-muted-foreground">+ ৳ 986,140 in your everyday currency</p></div>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/50 bg-card/60 p-4"><span className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowDownLeft className="size-3 text-chart-2" />Income</span><p className="ember-number mt-3 text-xl font-light text-chart-2">$3,240</p><p className="mt-1 text-xs text-muted-foreground">from your work</p></div>
                <div className="rounded-xl border border-border/50 bg-card/60 p-4"><span className="flex items-center gap-2 text-xs text-muted-foreground"><ArrowUpRight className="size-3 text-primary" />Spending</span><p className="ember-number mt-3 text-xl font-light">$1,850</p><p className="mt-1 text-xs text-muted-foreground">for the life you live</p></div>
              </div>
              <div className="mt-6 flex items-end gap-2 border-b border-border/50 pb-4">
                {[42, 58, 48, 72, 64, 88, 67, 78, 91, 71, 82, 98].map((bar, index) => <span key={index} className="flex-1 rounded-t-sm bg-primary/70" style={{ height: `${bar}px`, opacity: 0.4 + index / 20 }} />)}
              </div><div className="mt-3 flex justify-between text-[10px] text-muted-foreground"><span>JUL</span><span>AUG</span><span>SEP</span><span>OCT</span><span>NOV</span><span>DEC</span></div>
              <div className="mt-6 flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 p-3"><Sparkles className="size-4 shrink-0 text-primary" /><p className="text-xs leading-relaxed text-muted-foreground">Your USD earnings are making room for your next goal.</p></div>
            </CardContent>
          </Card>
        </motion.div>
      </section>
      <section className="grid gap-3 border-t border-border/50 py-10 md:grid-cols-3">
        {pillars.map(({ icon: Icon, title, body }, index) => <motion.div key={title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + index * 0.1 }}><Card className="h-full bg-card/50"><CardContent className="p-5"><div className="mb-5 flex size-9 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary"><Icon className="size-4" /></div><h2 className="font-medium">{title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p></CardContent></Card></motion.div>)}
      </section>
      <footer className="flex flex-col justify-between gap-3 border-t border-border/50 py-6 text-xs text-muted-foreground sm:flex-row"><span>Ember · Your private finance workspace</span><span>Designed for a life that moves between currencies.</span></footer>
    </div>
  </main>;
}
