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
          className="rounded-xl border border-neutral-700 bg-neutral-800/50 p-3 text-left text-sm hover:bg-neutral-700 transition"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08 }}
        >
          <span className="text-lg">{categoryIcons[cat] ?? "📄"}</span>
          <p className="mt-1 font-medium capitalize text-neutral-200">{cat}</p>
        </motion.button>
      ))}
    </div>
  );
}
