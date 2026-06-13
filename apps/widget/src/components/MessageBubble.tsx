import type { Message } from "@apex/shared";

interface Props {
  message: Message;
}

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(d);
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-xs">
          🤖
        </div>
      )}
      <div className="flex max-w-[80%] flex-col">
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
            isUser
              ? "rounded-br-md bg-indigo-600 text-white"
              : "rounded-bl-md bg-neutral-800 text-neutral-100"
          }`}
        >
          {message.content}
        </div>
        <span className={`mt-0.5 text-[10px] text-neutral-500 ${isUser ? "text-right" : "text-left"}`}>
          {message.timestamp ? formatTime(message.timestamp) : ""}
        </span>
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-medium text-white">
          U
        </div>
      )}
    </div>
  );
}
