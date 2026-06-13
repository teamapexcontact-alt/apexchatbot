import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/client";
import { useConfigStore } from "../store/configStore";

interface Props {
  messageIndex: number;
  question: string;
  answer: string;
}

export function FeedbackButtons({ messageIndex, question, answer }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const projectId = useConfigStore((s) => s.project?.projectId ?? "default");

  const sendFeedback = async (helpful: boolean) => {
    setSubmitted(true);
    try {
      await addDoc(collection(db, "feedback"), {
        projectId,
        question,
        answer,
        helpful,
        messageIndex,
        createdAt: serverTimestamp(),
      });
    } catch {}
  };

  if (submitted) {
    return (
      <div className="mt-1 ml-9 text-[10px] text-neutral-500">
        Thanks for your feedback!
      </div>
    );
  }

  return (
    <div className="mt-1 ml-9 flex items-center gap-2">
      <span className="text-[10px] text-neutral-500">Was this helpful?</span>
      <button onClick={() => sendFeedback(true)} className="text-xs text-green-400 hover:text-green-300 transition">👍</button>
      <button onClick={() => sendFeedback(false)} className="text-xs text-red-400 hover:text-red-300 transition">👎</button>
    </div>
  );
}
