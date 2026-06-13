import { motion } from "framer-motion";

interface Props {
  onClick: () => void;
  color?: string;
}

export function ChatButton({ onClick, color = "#6366f1" }: Props) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999]">
      <motion.button
        onClick={onClick}
        className="relative flex h-14 w-14 items-center justify-center rounded-full shadow-xl"
        style={{ backgroundColor: color }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-green-400 border-2 border-neutral-950" />
      </motion.button>
    </div>
  );
}
