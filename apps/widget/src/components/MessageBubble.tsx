import type { Message } from "@apex/shared";

interface Props {
  message: Message;
  primaryColor?: string;
}

function formatTime(d: Date) {
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(d);
}

export function MessageBubble({ message, primaryColor = "#6366f1" }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-end gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs ring-1 ring-white/10"
          style={{ backgroundColor: `${primaryColor}30` }}
        >
          🤖
        </div>
      )}
      <div className="flex max-w-[80%] flex-col">
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap transition-all ${
            isUser
              ? "text-white shadow-lg"
              : "rounded-bl-md bg-neutral-800/80 text-neutral-100 ring-1 ring-white/[0.04]"
          }`}
          style={
            isUser
              ? {
                  backgroundColor: primaryColor,
                  borderRadius: "18px 18px 4px 18px",
                }
              : undefined
          }
        >
          {message.content}
        </div>
        <span className={`mt-1 text-[10px] text-neutral-600 ${isUser ? "text-right" : "text-left"}`}>
          {message.timestamp ? formatTime(message.timestamp) : ""}
        </span>
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: `${primaryColor}cc` }}>
          U
        </div>
      )}
    </div>
  );
}
