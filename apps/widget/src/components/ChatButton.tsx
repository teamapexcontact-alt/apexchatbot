import { motion } from "framer-motion";

interface Props {
  onClick: () => void;
  color?: string;
}

import { useConfigStore } from "../store/configStore";

export function ChatButton({ onClick, color }: Props) {
  const theme = useConfigStore((s) => s.theme);
  const c = color || theme.primaryColor;
  const pos = theme.position;

  return (
    <div className="fixed bottom-5 z-[9999]" style={{ [pos]: "20px" }}>
      <motion.button
        onClick={onClick}
        className="group relative flex h-[60px] w-[60px] items-center justify-center rounded-full shadow-xl"
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}dd)`,
          boxShadow: `0 8px 32px -4px ${color}66`,
        }}
        whileHover={{ scale: 1.08, boxShadow: `0 12px 40px -4px ${color}88` }}
        whileTap={{ scale: 0.94 }}
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 350, damping: 18 }}
      >
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform group-hover:scale-110"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-400 ring-2 ring-white" />
        </span>
      </motion.button>
    </div>
  );
}
