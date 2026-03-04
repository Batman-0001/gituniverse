"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Sun,
  Orbit,
  Telescope,
  Clock,
  Users,
  GitBranch,
  Zap,
  BarChart3,
  Shield,
  Network,
} from "lucide-react";
import StarfieldCanvas from "@/components/StarfieldCanvas";
import IngestionPanel from "@/components/IngestionPanel";

const pillars = [
  {
    icon: Sun,
    title: "Stellar Theory",
    subtitle: "Individual Impact",
    description:
      "Developers are suns. Their mass is determined by commits, lines authored, and longevity. Files orbit as planets.",
    color: "var(--star-core)",
    gradient: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,140,0,0.05))",
    borderColor: "rgba(255,215,0,0.25)",
  },
  {
    icon: Orbit,
    title: "Orbital Intersection",
    subtitle: "Collaboration Mapping",
    description:
      "When developers collaborate, their orbits intersect. Binary stars form when pair-programmers are gravitationally locked.",
    color: "var(--binary-pulse)",
    gradient: "linear-gradient(135deg, rgba(224,64,251,0.15), rgba(108,52,131,0.05))",
    borderColor: "rgba(224,64,251,0.25)",
  },
  {
    icon: Telescope,
    title: "Galactic Evolution",
    subtitle: "Architecture Drift",
    description:
      "Microservices form galaxies. Watch them drift apart (decoupling) or merge (monolith formation) over time.",
    color: "var(--galaxy-teal)",
    gradient: "linear-gradient(135deg, rgba(38,198,218,0.15), rgba(0,229,255,0.05))",
    borderColor: "rgba(38,198,218,0.25)",
  },
  {
    icon: Clock,
    title: "Temporal Dimension",
    subtitle: "Digital Archaeology",
    description:
      "Star births on first commits. White dwarfs when developers leave. Supernovas on massive refactors.",
    color: "var(--supernova-gold)",
    gradient: "linear-gradient(135deg, rgba(255,213,79,0.15), rgba(255,183,77,0.05))",
    borderColor: "rgba(255,213,79,0.25)",
  },
];

const features = [
  {
    icon: Users,
    label: "Bus Factor Detection",
    desc: "Identify critical points of failure when one developer owns too much",
  },
  {
    icon: Network,
    label: "Social Architecture",
    desc: "See who actually talks to each other through code",
  },
  {
    icon: GitBranch,
    label: "Code Ancestry",
    desc: "Trace the lineage of every file back to its original author",
  },
  {
    icon: Zap,
    label: "Supernova Events",
    desc: "Visualize massive refactors and technical debt clearance",
  },
  {
    icon: BarChart3,
    label: "Stellar Mass",
    desc: "Quantified developer impact across commits, ownership, and longevity",
  },
  {
    icon: Shield,
    label: "Knowledge Silos",
    desc: "Detect isolated code ownership before it becomes a risk",
  },
];

const stagger = {
  container: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  },
};

export default function HomePage() {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <StarfieldCanvas />

      {/* Nebula gradient overlays */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(ellipse at 20% 50%, rgba(108,52,131,0.12) 0%, transparent 60%), " +
            "radial-gradient(ellipse at 80% 20%, rgba(79,195,247,0.08) 0%, transparent 50%), " +
            "radial-gradient(ellipse at 50% 80%, rgba(224,64,251,0.06) 0%, transparent 50%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* ── Hero Section ──────────────────────────────────────── */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "40px 24px",
            textAlign: "center",
          }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "6px 16px",
              background: "rgba(79, 195, 247, 0.1)",
              border: "1px solid rgba(79, 195, 247, 0.2)",
              borderRadius: "var(--radius-full)",
              fontSize: "13px",
              color: "var(--blue-giant)",
              marginBottom: "32px",
              fontWeight: 500,
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--blue-giant)", animation: "pulseGlow 2s infinite" }} />
            Sociotechnical Visualization Engine
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            style={{
              fontSize: "clamp(2.5rem, 6vw, 5rem)",
              fontWeight: 900,
              lineHeight: 1.1,
              marginBottom: "24px",
              letterSpacing: "-0.03em",
            }}
          >
            <span className="text-gradient">The Ancestry</span>
            <br />
            <span style={{ color: "#fff" }}>Map</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            style={{
              fontSize: "clamp(1rem, 2vw, 1.25rem)",
              color: "rgba(255,255,255,0.6)",
              maxWidth: "600px",
              lineHeight: 1.6,
              marginBottom: "48px",
            }}
          >
            Your codebase is a living universe. Developers are stars, files are planets,
            and collaboration creates orbital intersections. Map the ancestry of every line of code.
          </motion.p>

          {/* Ingestion Panel */}
          <IngestionPanel />

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            style={{
              position: "absolute",
              bottom: "40px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", letterSpacing: "2px", textTransform: "uppercase" }}>
              Explore the Theory
            </span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{
                width: "20px",
                height: "30px",
                border: "2px solid rgba(255,255,255,0.2)",
                borderRadius: "10px",
                display: "flex",
                justifyContent: "center",
                paddingTop: "6px",
              }}
            >
              <div
                style={{
                  width: "3px",
                  height: "6px",
                  background: "rgba(255,255,255,0.4)",
                  borderRadius: "2px",
                }}
              />
            </motion.div>
          </motion.div>
        </section>

        {/* ── Four Pillars Section ──────────────────────────────── */}
        <section
          style={{
            padding: "100px 24px",
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: "center", marginBottom: "64px" }}
          >
            <h2
              style={{
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                fontWeight: 800,
                marginBottom: "16px",
                letterSpacing: "-0.02em",
              }}
            >
              <span className="text-gradient">Four Theoretical</span>{" "}
              <span style={{ color: "#fff" }}>Pillars</span>
            </h2>
            <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.5)", maxWidth: "500px", margin: "0 auto" }}>
              Every feature serves one of these four lenses of codebase evolution.
            </p>
          </motion.div>

          <motion.div
            variants={stagger.container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "20px",
            }}
          >
            {pillars.map((pillar, i) => (
              <motion.div
                key={i}
                variants={stagger.item}
                whileHover={{ scale: 1.02, y: -4 }}
                transition={{ type: "spring", stiffness: 300 }}
                style={{
                  background: pillar.gradient,
                  border: `1px solid ${pillar.borderColor}`,
                  borderRadius: "var(--radius-lg)",
                  padding: "28px",
                  cursor: "default",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Ambient glow */}
                <div
                  style={{
                    position: "absolute",
                    top: "-30px",
                    right: "-30px",
                    width: "100px",
                    height: "100px",
                    borderRadius: "50%",
                    background: pillar.color,
                    opacity: 0.05,
                    filter: "blur(40px)",
                  }}
                />

                <pillar.icon size={28} style={{ color: pillar.color, marginBottom: "16px" }} />

                <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "4px" }}>
                  {pillar.title}
                </h3>
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: pillar.color,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "12px",
                  }}
                >
                  {pillar.subtitle}
                </p>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  {pillar.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Features Grid ─────────────────────────────────────── */}
        <section
          style={{
            padding: "60px 24px 120px",
            maxWidth: "1000px",
            margin: "0 auto",
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{ textAlign: "center", marginBottom: "48px" }}
          >
            <h2
              style={{
                fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)",
                fontWeight: 800,
                marginBottom: "12px",
                letterSpacing: "-0.02em",
                color: "#fff",
              }}
            >
              Insights That Matter
            </h2>
            <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.45)" }}>
              Not just beautiful — actionable intelligence from your codebase history.
            </p>
          </motion.div>

          <motion.div
            variants={stagger.container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {features.map((feature, i) => (
              <motion.div
                key={i}
                variants={stagger.item}
                whileHover={{ scale: 1.01 }}
                className="glass-light"
                style={{
                  borderRadius: "var(--radius-md)",
                  padding: "20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "var(--radius-sm)",
                    background: "rgba(79, 195, 247, 0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <feature.icon size={18} style={{ color: "var(--blue-giant)" }} />
                </div>
                <div>
                  <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#fff", marginBottom: "4px" }}>
                    {feature.label}
                  </h4>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Footer ────────────────────────────────────────────── */}
        <footer
          style={{
            padding: "32px 24px",
            textAlign: "center",
            borderTop: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
            Ancestry Map — A Sociotechnical Visualization Engine
          </p>
        </footer>
      </div>
    </main>
  );
}
