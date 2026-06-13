import { motion } from "framer-motion";
import type { FAQ } from "@apex/shared";

interface Props {
  faqs: FAQ[];
  onSelect: (category: string) => void;
}

const categoryIcons: Record<string, string> = {
  general: "💡",
  pricing: "💰",
  support: "🛠️",
  features: "✨",
  contact: "📞",
  refund: "🔄",
  enrollment: "📝",
  course: "📚",
  certificate: "🎓",
  schedule: "📅",
  payment: "💳",
  technical: "⚙️",
  batch: "👥",
  other: "❓",
};

export function CategoryCards({ faqs, onSelect }: Props) {
  const categories = [...new Set(faqs.map((f) => f.category).filter(Boolean))];

  if (categories.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {categories.map((cat, i) => (
        <motion.button
          key={cat}
          onClick={() => onSelect(cat)}
          className="group flex items-center gap-2.5 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3.5 py-3 text-left transition-all hover:border-neutral-700 hover:bg-neutral-800/60"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
        >
          <span className="text-base">{categoryIcons[cat] ?? "📄"}</span>
          <p className="text-[13px] font-medium capitalize text-neutral-300 group-hover:text-neutral-100 transition-colors">
            {cat}
          </p>
        </motion.button>
      ))}
    </div>
  );
}
