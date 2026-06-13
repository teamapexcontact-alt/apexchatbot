import { motion } from "framer-motion";
import { useConfigStore } from "../store/configStore";

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
  const primaryColor = useConfigStore((s) => s.project?.primaryColor ?? "#6366f1");

  return (
    <div className="flex flex-wrap gap-2">
      {ctas.map((cta, i) => (
        <motion.a
          key={i}
          href={cta.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all hover:shadow-lg"
          style={{
            borderColor: `${primaryColor}40`,
            color: primaryColor,
            backgroundColor: `${primaryColor}10`,
          }}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.1 }}
          whileHover={{ scale: 1.04, y: -1 }}
          whileTap={{ scale: 0.97 }}
        >
          <span>{cta.icon ?? icons[cta.label] ?? "🔗"}</span>
          {cta.label}
        </motion.a>
      ))}
    </div>
  );
}
