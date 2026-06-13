"use client";

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getDb$ } from "@/lib/firebase-client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SeedPage() {
  const [seeding, setSeeding] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const seed = async () => {
    setSeeding(true);
    setError("");
    try {
      const db = getDb$()!;

      const projRef = await addDoc(collection(db, "projects"), {
        projectName: "APEX Demo",
        domains: ["localhost", "example.com"],
        primaryColor: "#6366f1",
        logoUrl: "",
        welcomeMessage: "Hi! I'm your APEX assistant. Ask me about pricing, features, courses, or anything else!",
        whatsappLink: "https://wa.me/1234567890",
        ctaConfig: {
          viewPricingUrl: "https://example.com/pricing",
          enrollNowUrl: "https://example.com/enroll",
          bookCallUrl: "https://calendly.com/apex-demo",
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const faqs = [
        { question: "What is the pricing?", answer: "We offer three plans: Basic ($9/mo), Pro ($29/mo), and Enterprise (custom). All include a 14-day free trial. You can upgrade, downgrade, or cancel anytime.", category: "pricing", keywords: ["price", "cost", "fees", "plans", "subscription", "free trial", "basic", "pro", "enterprise", "monthly", "billing"] },
        { question: "Do you offer refunds?", answer: "Yes! 30-day money-back guarantee on all plans. No questions asked. Email support@apexchatbot.com to request a refund.", category: "refund", keywords: ["refund", "return", "cancel", "money back", "guarantee", "cancellation", "cancel plan", "cancel subscription"] },
        { question: "How do I enroll in a course?", answer: "Visit our website, browse courses, and click 'Enroll Now'. Payment is secure via card or UPI. You get instant access after enrollment.", category: "enrollment", keywords: ["enroll", "register", "signup", "join", "admission", "start course", "begin"] },
        { question: "What courses do you offer?", answer: "We offer Web Development, Data Science, AI/ML, Digital Marketing, and UI/UX Design. Each includes live sessions, projects, and certification.", category: "course", keywords: ["course", "class", "program", "curriculum", "web development", "data science", "ai", "ml", "marketing", "design"] },
        { question: "How long are the courses?", answer: "Courses range from 4 to 12 weeks. Self-paced options available. Each course has 20-40 hours of content plus projects.", category: "course", keywords: ["duration", "length", "time", "long", "weeks", "months", "self-paced"] },
        { question: "How do I contact support?", answer: "Email support@apexchatbot.com. Pro users get priority chat support. Enterprise includes dedicated account manager. Response within 2 hours.", category: "contact", keywords: ["support", "contact", "email", "phone", "call", "help", "assist", "reach"] },
        { question: "I'm having a technical issue", answer: "Try clearing your browser cache or using Chrome/Firefox. If the issue persists, email support@apexchatbot.com with screenshots and we'll fix it ASAP.", category: "technical", keywords: ["technical", "issue", "problem", "bug", "error", "not working", "broken", "fix", "trouble", "stuck"] },
        { question: "What features are included?", answer: "Basic: 1 chatbot, 500 conversations/mo. Pro: Unlimited chatbots, custom branding, analytics, API access, priority support. Enterprise: Everything + dedicated server, custom integrations, SLA.", category: "features", keywords: ["feature", "capabilities", "unlimited", "branding", "api", "analytics", "integration", "whatsapp", "slack"] },
        { question: "Can I integrate with WhatsApp?", answer: "Yes! Pro and Enterprise plans include WhatsApp integration. Connect your WhatsApp Business account in Settings → Integrations.", category: "features", keywords: ["integration", "whatsapp", "slack", "telegram", "zapier", "api", "connect"] },
        { question: "How do I reset my password?", answer: "Go to the login page, click 'Forgot Password', enter your email. You'll receive a reset link within 1 minute. Check spam if not received.", category: "account", keywords: ["password", "reset", "forgot", "login", "signin", "account", "access", "credential"] },
        { question: "What are your business hours?", answer: "Mon-Fri 9 AM to 6 PM IST. Email support available on weekends. Pro users get 24/7 chat support.", category: "timing", keywords: ["hours", "timing", "open", "closed", "schedule", "weekend", "business hours", "availability"] },
        { question: "Is there a community?", answer: "Yes! Join our Discord community with 5000+ members. Get help, share projects, and network with peers. Link in your dashboard.", category: "community", keywords: ["community", "group", "discord", "forum", "members", "network", "peer"] },
        { question: "How do I get started?", answer: "Sign up for a free trial at our website. No credit card needed. You'll get a demo chatbot running in 5 minutes with our step-by-step onboarding.", category: "enrollment", keywords: ["start", "begin", "onboarding", "getting started", "signup", "trial", "setup"] },
        { question: "What payment methods do you accept?", answer: "We accept all major credit cards (Visa, Mastercard, Amex), PayPal, and UPI (India). Enterprise customers can request invoice-based billing.", category: "pricing", keywords: ["payment", "pay", "card", "credit card", "debit card", "upi", "paypal", "invoice", "billing"] },
      ];

      for (const faq of faqs) {
        await addDoc(collection(db, "faqs"), {
          projectId: projRef.id,
          ...faq,
          createdAt: serverTimestamp(),
        });
      }

      setDone(true);
    } catch (e: any) {
      setError(e.message || "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  if (done) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-semibold text-green-400">Test data created!</p>
        <p className="mt-2 text-sm text-neutral-400">14 FAQs with categories, keywords, and synonym-friendly content. Head to the Projects page.</p>
        <button onClick={() => router.push("/dashboard/projects")} className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 transition">
          View Projects
        </button>
      </div>
    );
  }

  return (
    <div className="text-center py-20">
      <h1 className="mb-4 text-2xl font-bold">Seed Test Data</h1>
      <p className="mb-6 text-sm text-neutral-400">
        Creates a demo project and 14 categorized FAQs with rich keywords and synonym support.
      </p>
      <button
        onClick={seed}
        disabled={seeding}
        className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium hover:bg-indigo-500 transition disabled:opacity-50"
      >
        {seeding ? "Seeding…" : "Create Test Data"}
      </button>
      {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
    </div>
  );
}
