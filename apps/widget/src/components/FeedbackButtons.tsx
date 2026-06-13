import { useState } from "react";
import { useConfigStore } from "../store/configStore";

interface Props {
  messageIndex: number;
  question: string;
  answer: string;
}

export function FeedbackButtons({ messageIndex, question, answer }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const { apiUrl, projectId } = useConfigStore();

  const sendFeedback = async (helpful: boolean) => {
    setSubmitted(true);
    try {
      await fetch(`${apiUrl}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, question, answer, helpful, messageIndex }),
      });
    } catch {}
  };

  if (submitted) {
    return (
      <div className="mt-1.5 ml-9 flex items-center gap-1.5 text-[10px] text-neutral-500">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Thanks for your feedback
      </div>
    );
  }

  return (
    <div className="mt-1.5 ml-9 flex items-center gap-1">
      <span className="text-[10px] text-neutral-500 mr-1">Helpful?</span>
      <button
        onClick={() => sendFeedback(true)}
        className="flex h-6 items-center gap-1 rounded-lg px-2 text-[11px] text-neutral-400 transition-all hover:bg-emerald-500/10 hover:text-emerald-400"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
      <button
        onClick={() => sendFeedback(false)}
        className="flex h-6 items-center gap-1 rounded-lg px-2 text-[11px] text-neutral-400 transition-all hover:bg-red-500/10 hover:text-red-400"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
          <path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
        </svg>
      </button>
    </div>
  );
}
