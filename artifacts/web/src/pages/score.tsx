import { useState } from "react";
import { Link } from "wouter";
import {
  Gauge, ShieldCheck, Sparkles, Building2, User, Database, EyeOff, Workflow, Target, Handshake,
  TrendingUp, Lock, HelpCircle, ChevronRight, CheckCircle2, Clock, XCircle, Lightbulb, CalendarClock,
} from "lucide-react";
import {
  SCORE_INTRO, SCORE_TAGLINE, SCORE_MIN, SCORE_MAX, SCORE_TRUSTED_THRESHOLD, SCORE_PARTNER_SHARING_TARGET_YEAR,
  SCORE_BENEFITS, SCORE_DATA_USED, SCORE_DATA_NOT_USED, SCORE_HOW_COLLECTED, SCORE_WHY_COLLECTED,
  SCORE_PARTNER_SHARING_NOTICE, SCORE_PARTNER_SHARING_BENEFITS, SCORE_TIPS, SCORE_MYTHS, SCORE_CONTROLS, SCORE_TIMELINE, SCORE_FAQS,
  SCORE_PAGE_META, SCORE_EXAMPLE, scoreFactorInfo, scoreBandsWithPerks, scorePageJsonLd,
  type ScoreAccountType,
} from "@workspace/score-model";
import { PublicLayout } from "@/components/public-layout";
import { Layout } from "@/components/layout";
import { ScoreGauge, bandVar } from "@/components/score-gauge";
import { getToken } from "@/lib/auth";
import { usePageMeta } from "@/lib/page-meta";

const SITE = "https://spayewallet.com";

/**
 * Public explainer for the S-PAY Score — benefits, how it's calculated, what
 * data it uses and why, how to keep it high, controls and the partner roadmap.
 * Signed-in members get it inside the app shell; visitors get the marketing
 * shell. Crawlers get the identical content server-rendered (routes/ssr.ts).
 */
export default function ScorePage() {
  usePageMeta({
    title: SCORE_PAGE_META.title,
    description: SCORE_PAGE_META.description,
    canonical: `${SITE}/score`,
    jsonLd: scorePageJsonLd(SITE),
  });
  const authed = Boolean(getToken());
  if (authed) {
    return (
      <Layout back title="How S-PAY Score works">
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm score-light">
          <Content authed />
        </div>
      </Layout>
    );
  }
  return (
    <PublicLayout active="score">
      <div className="pt-16 score-light">
        <Content />
      </div>
    </PublicLayout>
  );
}

const SECTIONS = [
  { id: "how-its-calculated", label: "How it's calculated" },
  { id: "bands", label: "Score bands" },
  { id: "benefits", label: "Benefits" },
  { id: "business", label: "For business" },
  { id: "your-data", label: "Your data" },
  { id: "partners", label: "Roadmap" },
  { id: "keep-it-high", label: "Keep it high" },
  { id: "faq", label: "FAQ" },
];

function Content({ authed = false }: { authed?: boolean }) {
  const [audience, setAudience] = useState<ScoreAccountType>("personal");
  const cta = authed ? { href: "/my-score", label: "See my score" } : { href: "/register?source=score", label: "Get my free score" };

  return (
    <div className="text-[#1A2B4A]">
      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38] text-white">
        <div className="max-w-6xl mx-auto px-5 md:px-6 py-14 md:py-20 grid md:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-5">
              <Gauge size={14} /> S-PAY Score · personal &amp; business
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-4">
              Your financial track record — scored, explained and yours.
            </h1>
            <p className="text-blue-100 text-base md:text-lg leading-relaxed mb-3">{SCORE_TAGLINE}</p>
            <p className="text-blue-200/90 text-sm leading-relaxed mb-7 max-w-xl">{SCORE_INTRO}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={cta.href} className="inline-flex items-center gap-1.5 bg-[#4DC9EE] text-[#0d1f38] font-bold px-6 py-3 rounded-full hover:bg-[#2E8FD6] transition-colors">
                {cta.label} <ChevronRight size={16} />
              </Link>
              <a href="#how-its-calculated" className="inline-flex items-center gap-1.5 border border-white/25 text-white font-semibold px-6 py-3 rounded-full hover:bg-white/10 transition-colors">
                How it's calculated
              </a>
            </div>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">Example score</p>
            <ScoreGauge score={SCORE_EXAMPLE.score} size="lg" />
            <p className="mt-4 text-sm text-gray-600">{SCORE_EXAMPLE.description}</p>
          </div>
        </div>
      </section>

      {/* ── Quick facts ── */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 md:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { k: `${SCORE_MIN}–${SCORE_MAX}`, v: "Score range" },
            { k: "Free", v: "Checking never lowers it" },
            { k: "5 factors", v: "Shown with your exact points" },
            { k: "You control it", v: "Off, delete or download any time" },
          ].map((f) => (
            <div key={f.v} className="text-center">
              <p className="text-2xl md:text-3xl font-black text-[#1A2B4A]">{f.k}</p>
              <p className="text-xs md:text-sm text-gray-500">{f.v}</p>
            </div>
          ))}
        </div>
        <nav aria-label="On this page" className="max-w-6xl mx-auto px-5 md:px-6 pb-6 flex flex-wrap gap-2 justify-center">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="text-xs font-semibold text-[#2E8FD6] bg-[#4DC9EE]/10 hover:bg-[#4DC9EE]/20 rounded-full px-3 py-1.5">{s.label}</a>
          ))}
        </nav>
      </section>

      {/* ── How it's calculated ── */}
      <Section id="how-its-calculated" icon={<Workflow size={18} />} kicker="How it's calculated" title="Five factors. Every point accounted for." gray>
        <p className="text-gray-600 max-w-3xl mb-6">
          Everyone starts at {SCORE_MIN}. Five factors add up to 550 more points, each capped at its weight. New accounts start
          factors with no data at a fair, neutral value — so you begin in Building, not at the bottom — and small samples are
          blended toward neutral until there's enough history, so one lucky or unlucky payment can't swing your score.
        </p>
        <div role="tablist" aria-label="Account type" className="inline-flex rounded-full bg-white border border-gray-200 p-1 mb-6">
          {(["personal", "business"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={audience === t}
              onClick={() => setAudience(t)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${audience === t ? "bg-[#1A2B4A] text-white" : "text-gray-600 hover:text-[#1A2B4A]"}`}
            >
              {t === "personal" ? <User size={15} /> : <Building2 size={15} />} {t === "personal" ? "Individuals" : "Businesses"}
            </button>
          ))}
        </div>
        {(["personal", "business"] as const).map((t) => (
          <div key={t} className={audience === t ? "grid md:grid-cols-2 gap-4" : "hidden"} role="tabpanel">
            {scoreFactorInfo(t).map((f) => (
              <div key={f.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <h3 className="font-bold">{f.label}</h3>
                  <span className="text-sm font-black text-[#1A2B4A]">{f.weightPct}%</span>
                </div>
                {/* drawn to true scale: the full track is 100% of the score */}
                <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: "var(--score-track)" }} aria-hidden="true">
                  <div className="h-full rounded-full" style={{ width: `${f.weightPct}%`, backgroundColor: "var(--score-mark)" }} />
                </div>
                <p className="text-sm text-gray-600 mb-2">{f.description}</p>
                <ul className="space-y-1">
                  {f.looksAt.map((l) => <li key={l} className="text-xs text-gray-500 flex gap-1.5"><CheckCircle2 size={13} className="text-[#2E8FD6] flex-shrink-0 mt-px" />{l}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </Section>

      {/* ── Bands ── */}
      <Section id="bands" icon={<Gauge size={18} />} kicker="Score bands" title="What your number means">
        <p className="text-gray-600 max-w-3xl mb-6">
          {SCORE_TRUSTED_THRESHOLD}+ marks a trusted member — the same idea as the threshold other super-apps use for deposit-free
          services. <strong>Live</strong> benefits work today; <strong>planned</strong> ones are on our roadmap and may change.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {scoreBandsWithPerks().map((b) => (
            <div key={b.key} className="rounded-2xl border border-gray-100 shadow-sm p-5 bg-white">
              <div className="h-1.5 rounded-full mb-4" style={{ backgroundColor: bandVar(b.key) }} aria-hidden="true" />
              <p className="text-xs font-bold text-gray-400 mb-0.5">{b.min}–{b.max}</p>
              <h3 className="text-lg font-black mb-1">{b.label}</h3>
              <p className="text-sm text-gray-600 mb-3">{b.summary}</p>
              <ul className="space-y-1.5">
                {b.perks.live.map((p) => <li key={p} className="text-xs text-gray-700 flex gap-1.5"><CheckCircle2 size={13} className="text-emerald-600 flex-shrink-0 mt-px" />{p}</li>)}
                {b.perks.planned.map((p) => <li key={p} className="text-xs text-gray-500 flex gap-1.5"><Clock size={13} className="text-gray-400 flex-shrink-0 mt-px" />{p} (planned)</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Benefits ── */}
      <Section id="benefits" icon={<Sparkles size={18} />} kicker="Benefits" title="Why it's worth building" gray>
        <div className="grid md:grid-cols-2 gap-8">
          {(["live", "planned"] as const).map((status) => (
            <div key={status}>
              <h3 className="font-bold mb-3 flex items-center gap-2">
                {status === "live" ? <CheckCircle2 size={18} className="text-emerald-600" /> : <CalendarClock size={18} className="text-gray-400" />}
                {status === "live" ? "Available now" : "Planned"}
              </h3>
              <div className="space-y-3">
                {SCORE_BENEFITS.filter((b) => b.status === status).map((b) => (
                  <div key={b.title} className="bg-white rounded-2xl border border-gray-100 p-4">
                    <p className="font-semibold text-sm mb-0.5">
                      {b.title}
                      {b.audience !== "all" && <span className="ml-2 text-[10px] uppercase tracking-wide font-bold text-gray-400">{b.audience === "business" ? "Business" : "Individuals"}</span>}
                    </p>
                    <p className="text-sm text-gray-600">{b.description}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Business ── */}
      <Section id="business" icon={<Building2 size={18} />} kicker="For business accounts" title="The Business Score">
        <div className="grid md:grid-cols-[1fr_1.1fr] gap-8 items-start">
          <div className="text-gray-600 space-y-3">
            <p>
              Every business account gets a Business Score on the same {SCORE_MIN}–{SCORE_MAX} scale. It leans on what lenders and
              partners care about most for a company: <strong>does the team get paid on time, every time, and is there float to
              cover the next payroll?</strong>
            </p>
            <p>
              Payroll & payment reliability carries 30%, built from live S-PAY Payroll batches only — sandbox tests never count.
              Businesses that don't run payroll on S-PAY are scored on everyday transaction success instead, so no one is penalised
              for not using a feature.
            </p>
            <Link href={authed ? "/payroll" : "/register?type=business&source=score"} className="inline-flex items-center gap-1 font-semibold text-[#2E8FD6]">
              {authed ? "Open the Payroll console" : "Open a business account"} <ChevronRight size={15} />
            </Link>
          </div>
          <div className="bg-gray-50 rounded-2xl p-5">
            <h3 className="font-bold mb-3">Keep a Business Score high</h3>
            <ol className="space-y-2.5">
              {SCORE_TIPS.business.map((t, i) => (
                <li key={t.title} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#1A2B4A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-sm"><strong>{t.title}.</strong> <span className="text-gray-600">{t.description}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      {/* ── Your data ── */}
      <Section id="your-data" icon={<Database size={18} />} kicker="Score Data Notice" title="What we collect, how and why" gray>
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Database size={17} className="text-[#2E8FD6]" /> What your score uses</h3>
            <ul className="space-y-3">
              {SCORE_DATA_USED.map((d) => (
                <li key={d.title} className="text-sm"><strong>{d.title}.</strong> <span className="text-gray-600">{d.description}</span></li>
              ))}
            </ul>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><EyeOff size={17} className="text-[#2E8FD6]" /> What it never uses</h3>
            <ul className="space-y-2">
              {SCORE_DATA_NOT_USED.map((d) => (
                <li key={d} className="text-sm text-gray-600 flex gap-2"><XCircle size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />{d}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Workflow size={17} className="text-[#2E8FD6]" /> How it's collected</h3>
            <ol className="space-y-2.5">
              {SCORE_HOW_COLLECTED.map((d, i) => (
                <li key={d} className="flex gap-3 text-sm text-gray-600">
                  <span className="w-6 h-6 rounded-full bg-[#4DC9EE]/15 text-[#1A2B4A] text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>{d}
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Target size={17} className="text-[#2E8FD6]" /> Why we collect it</h3>
            <ul className="space-y-3">
              {SCORE_WHY_COLLECTED.map((d) => (
                <li key={d.title} className="text-sm"><strong>{d.title}.</strong> <span className="text-gray-600">{d.description}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* ── Partners & roadmap ── */}
      <Section id="partners" icon={<Handshake size={18} />} kicker="Partner sharing & roadmap" title={`From score to fair credit — by ~${SCORE_PARTNER_SHARING_TARGET_YEAR}, only with your consent`}>
        <div className="rounded-2xl border-2 border-[#4DC9EE]/40 bg-[#4DC9EE]/5 p-5 mb-8 flex gap-3">
          <ShieldCheck size={22} className="text-[#2E8FD6] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700 leading-relaxed">{SCORE_PARTNER_SHARING_NOTICE}</p>
        </div>
        <h3 className="font-bold mb-3">What partner sharing will unlock</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-10">
          {SCORE_PARTNER_SHARING_BENEFITS.map((b) => (
            <div key={b.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="font-semibold text-sm mb-0.5">
                {b.title}
                {b.audience === "business" && <span className="ml-2 text-[10px] uppercase tracking-wide font-bold text-gray-400">Business</span>}
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">{b.description}</p>
            </div>
          ))}
        </div>
        <ol className="relative border-l-2 border-gray-100 ml-3 space-y-6">
          {SCORE_TIMELINE.map((t) => (
            <li key={t.when} className="pl-6 relative">
              <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${t.status === "live" ? "bg-[#2E8FD6]" : "bg-gray-300"}`} />
              <p className="text-xs font-bold text-gray-400">{t.when} · {t.status === "live" ? "Live" : "Planned"}</p>
              <h3 className="font-bold">{t.title}</h3>
              <p className="text-sm text-gray-600">{t.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* ── Keep it high ── */}
      <Section id="keep-it-high" icon={<TrendingUp size={18} />} kicker="Keep it high" title="How to raise — and keep — a high score" gray>
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><User size={17} className="text-[#2E8FD6]" /> Individuals</h3>
            <ol className="space-y-2.5">
              {SCORE_TIPS.personal.map((t, i) => (
                <li key={t.title} className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#1A2B4A] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-sm"><strong>{t.title}.</strong> <span className="text-gray-600">{t.description}</span></span>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold mb-3 flex items-center gap-2"><Lightbulb size={17} className="text-[#2E8FD6]" /> Myths vs. facts</h3>
            <div className="space-y-3">
              {SCORE_MYTHS.map((m) => (
                <div key={m.myth}>
                  <p className="text-sm text-gray-500 line-through decoration-gray-300">{m.myth}</p>
                  <p className="text-sm font-medium">{m.fact}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <h3 className="font-bold mb-3 flex items-center gap-2" id="controls"><Lock size={17} className="text-[#2E8FD6]" /> Your controls</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SCORE_CONTROLS.map((c) => (
            <div key={c.title} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="font-semibold text-sm mb-0.5">{c.title}</p>
              <p className="text-xs text-gray-600">{c.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section id="faq" icon={<HelpCircle size={18} />} kicker="FAQ" title="Common questions">
        <div className="grid md:grid-cols-2 gap-3">
          {SCORE_FAQS.map((f) => (
            <div key={f.q} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-sm mb-1.5">{f.q}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── CTA ── */}
      <section className="px-5 md:px-6 pb-16 bg-white">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#4DC9EE] to-[#2E8FD6] rounded-3xl p-8 md:p-10 text-center text-white">
          <h2 className="text-2xl md:text-3xl font-black mb-2">Start building your track record today</h2>
          <p className="text-white/85 text-sm mb-6">Free for every personal and business account · see your score in seconds</p>
          <Link href={cta.href} className="inline-flex items-center gap-1.5 bg-white text-[#1A2B4A] font-bold px-7 py-3 rounded-2xl hover:scale-[1.02] transition-transform">
            {cta.label} <ChevronRight size={16} />
          </Link>
          <p className="text-white/80 text-xs mt-5">
            Read more in our <Link href="/privacy" className="underline">Privacy Policy</Link> and <Link href="/terms" className="underline">Terms of Service</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}

function Section({ id, icon, kicker, title, children, gray = false }: {
  id: string; icon: React.ReactNode; kicker: string; title: string; children: React.ReactNode; gray?: boolean;
}) {
  return (
    <section id={id} className={`scroll-mt-20 py-14 md:py-20 px-5 md:px-6 ${gray ? "bg-gray-50" : "bg-white"}`}>
      <div className="max-w-6xl mx-auto">
        <p className="inline-flex items-center gap-2 text-[#2E8FD6] text-xs font-bold uppercase tracking-wider mb-2">{icon} {kicker}</p>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-5">{title}</h2>
        {children}
      </div>
    </section>
  );
}
