import { motion } from "framer-motion";

interface CTA {
  label: string;
  url: string;
  icon?: string;
}

interface Props {
  ctas: CTA[];
}

const icons: Record<string, string> = {
  "Book Call": "📅",
  "Join WhatsApp": "💬",
  "View Pricing": "💰",
  "Contact Team": "📧",
  "Enroll Now": "🎓",
};

export function CTACard({ ctas }: Props) {
  if (ctas.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {ctas.map((cta, i) => (
        <motion.a
          key={i}
          href={cta.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 transition"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
          whileHover={{ scale: 1.05 }}
        >
          <span>{cta.icon ?? icons[cta.label] ?? "🔗"}</span>
          {cta.label}
        </motion.a>
      ))}
    </div>
  );
}
