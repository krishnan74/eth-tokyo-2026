"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Enters once, when scrolled into view: a short rise, never a block fade. */
export function Reveal({ delay = 0, y = 28, ...rest }: HTMLMotionProps<"div"> & { delay?: number; y?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.9, ease: EASE, delay }} {...rest} />
  );
}

/** Section header: a mono chapter marker (these are a real sequence), a serif headline, optional lede. */
export function Chapter({ n, kicker, title, lede, id }: { n: string; kicker: string; title: React.ReactNode; lede?: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="grid scroll-mt-24 gap-6 md:grid-cols-12">
      <Reveal className="md:col-span-3">
        <span className="label flex items-center gap-3"><span className="text-cascade">{n}</span><span className="h-px w-8 bg-line" />{kicker}</span>
      </Reveal>
      <div className="flex flex-col gap-5 md:col-span-9">
        <Reveal delay={0.05}><h2 className="display text-[clamp(2.4rem,5.2vw,4.6rem)]">{title}</h2></Reveal>
        {lede && <Reveal delay={0.12}><p className="max-w-2xl text-lg leading-relaxed text-ink-2">{lede}</p></Reveal>}
      </div>
    </div>
  );
}
