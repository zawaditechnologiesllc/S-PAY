import { MapPin, ArrowRight, Globe, Zap, Heart, Users } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";

const OPEN_ROLES = [
  {
    title: "Senior Backend Engineer",
    team: "Engineering",
    type: "Full-time · Remote",
    location: "Anywhere",
    desc: "Build the payment infrastructure that moves money across 180+ countries. Deep experience with Node.js, TypeScript, PostgreSQL, and financial APIs required.",
    tags: ["Node.js", "TypeScript", "PostgreSQL"],
  },
  {
    title: "Product Designer",
    team: "Design",
    type: "Full-time · Remote",
    location: "Anywhere",
    desc: "Design intuitive financial experiences for users in Africa, Southeast Asia, and Latin America. Experience with mobile-first design for emerging markets preferred.",
    tags: ["Figma", "Mobile-first", "Fintech"],
  },
  {
    title: "Business Development Lead",
    team: "Growth",
    type: "Full-time · Remote",
    location: "Africa or SE Asia",
    desc: "Identify and close partnerships with mobile money operators, banks, and employer platforms across our key markets. Prior fintech or payments experience required.",
    tags: ["Partnerships", "Fintech", "BD"],
  },
];

const BENEFITS = [
  { icon: <Globe size={22} />, title: "Fully Remote", desc: "Work from anywhere in the world. We have teammates on 4 continents." },
  { icon: <Zap size={22} />, title: "Competitive Salary", desc: "Market-rate compensation benchmarked against US and global fintech companies." },
  { icon: <Heart size={22} />, title: "Equity", desc: "Own a piece of what we're building. All full-time employees receive stock options." },
  { icon: <Users size={22} />, title: "Health Benefits", desc: "Full health, dental, and vision insurance for you and your dependants." },
  { icon: <MapPin size={22} />, title: "30 Days PTO", desc: "Generous paid time off plus local public holidays wherever you are." },
  { icon: <ArrowRight size={22} />, title: "$2,000 Learning Budget", desc: "Annual budget for courses, conferences, books, and professional development." },
];

export default function Careers() {
  return (
    <PublicLayout active="careers">

      {/* Hero */}
      <section className="pt-16 bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
            <Users size={12} /> We're hiring
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white mb-6 leading-tight">
            Build the future of<br />
            <span className="text-[#4DC9EE]">global payments.</span>
          </h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto leading-relaxed">
            Join the team making financial access possible for 1 billion+ remote workers worldwide. We are a remote-first company with big ambitions and a real mission.
          </p>
        </div>
      </section>

      {/* Culture */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">Culture</span>
              <h2 className="text-4xl font-black text-[#1A2B4A] mt-3 mb-6 leading-tight">
                Remote-first,<br />mission-driven.
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-5">
                We're a distributed team united by one goal: making global payments effortless for remote workers. We move fast, ship often, and hold ourselves to a high bar.
              </p>
              <p className="text-gray-500 text-lg leading-relaxed">
                Our team has roots in fintech, mobile money, cross-border payments, and consumer apps. We've all experienced the pain of getting paid across borders — and we're fixing it.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {[
                { icon: <Globe size={20} />, title: "Remote-first", desc: "No office. Async by default. Results over hours." },
                { icon: <Zap size={20} />, title: "Move fast", desc: "Shipped weekly. Broken things fixed same day." },
                { icon: <Heart size={20} />, title: "Mission-driven", desc: "Every feature makes money more accessible." },
                { icon: <Users size={20} />, title: "Diverse by design", desc: "Team members in 12+ countries across 4 continents." },
              ].map((v) => (
                <div key={v.title} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4DC9EE] to-[#1A2B4A] flex items-center justify-center text-white mb-3 flex-shrink-0">
                    {v.icon}
                  </div>
                  <h4 className="font-bold text-[#1A2B4A] text-sm mb-1">{v.title}</h4>
                  <p className="text-gray-500 text-xs leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Open roles */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">Open Positions</span>
            <h2 className="text-4xl font-black text-[#1A2B4A] mt-3 mb-4">Join the team</h2>
            <p className="text-gray-500">All roles are fully remote and open worldwide unless noted.</p>
          </div>
          <div className="space-y-5">
            {OPEN_ROLES.map((role) => (
              <div key={role.title} className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="text-xs font-bold bg-[#4DC9EE]/10 text-[#4DC9EE] px-3 py-1 rounded-full">{role.team}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={11} /> {role.location}</span>
                    </div>
                    <h3 className="font-bold text-[#1A2B4A] text-xl mb-2">{role.title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed mb-4">{role.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {role.tags.map((tag) => (
                        <span key={tag} className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full uppercase tracking-wide">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <a
                      href="mailto:careers@spayewallet.com"
                      className="inline-flex items-center gap-2 bg-[#1A2B4A] text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-[#0d1f38] transition-colors whitespace-nowrap"
                    >
                      Apply Now <ArrowRight size={15} />
                    </a>
                    <p className="text-xs text-gray-400 mt-1.5 text-center">{role.type}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">Benefits</span>
            <h2 className="text-4xl font-black text-[#1A2B4A] mt-3">What we offer</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {BENEFITS.map((b) => (
              <div key={b.title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4DC9EE] to-[#1A2B4A] flex items-center justify-center text-white mb-4">
                  {b.icon}
                </div>
                <h4 className="font-bold text-[#1A2B4A] mb-1">{b.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open application CTA */}
      <section className="py-20 px-6 bg-[#1A2B4A]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black text-white mb-4">Don't see your role?</h2>
          <p className="text-blue-200 mb-8 leading-relaxed">
            We're always looking for exceptional people. Send us your CV and a note about what you'd like to build.
          </p>
          <a
            href="mailto:careers@spayewallet.com"
            className="inline-flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-8 py-4 rounded-2xl hover:bg-[#2E8FD6] transition-colors shadow-lg"
          >
            Send Open Application <ArrowRight size={18} />
          </a>
        </div>
      </section>

    </PublicLayout>
  );
}
