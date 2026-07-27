"use client"

import * as React from "react"
import { Bot, Send, Sparkles, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type ChatPrompt = {
  keywords: string[]
  answer: string
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

function matchPrompt(input: string, prompts: ChatPrompt[]): string | null {
  const lower = input.toLowerCase()
  let best: { prompt: ChatPrompt; hits: number } | null = null

  for (const prompt of prompts) {
    const hits = prompt.keywords.filter((keyword) =>
      lower.includes(keyword.toLowerCase())
    ).length
    if (hits > 0 && (!best || hits > best.hits)) {
      best = { prompt, hits }
    }
  }

  return best ? best.prompt.answer : null
}

export function ChatSidebar({
  title = "Data Assistant",
  description = "Trained on this page's live dataset. Ask about trends, outliers, or specific lots and operators.",
  suggestions,
  prompts,
  fallback = "I don't have a canned answer for that yet, but based on the current dataset I'd flag it as worth a closer look in the visual above — try one of the suggested questions for a fuller answer.",
}: {
  title?: string
  description?: string
  suggestions: string[]
  prompts: ChatPrompt[]
  fallback?: string
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState("")
  const [isThinking, setIsThinking] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, isThinking])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isThinking) return

    setMessages((prev) => [...prev, { role: "user", content: trimmed }])
    setInput("")
    setIsThinking(true)

    const answer = matchPrompt(trimmed, prompts) ?? fallback
    window.setTimeout(
      () => {
        setMessages((prev) => [...prev, { role: "assistant", content: answer }])
        setIsThinking(false)
      },
      500 + Math.min(trimmed.length * 15, 900)
    )
  }

  return (
    <div className="sticky top-6 flex h-[calc(100svh-8rem)] w-80 shrink-0 flex-col rounded-lg border bg-background/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 size-3.5 shrink-0" />
              <span>Try asking:</span>
            </div>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => send(suggestion)}
                  className="rounded-md border bg-muted/40 px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-start gap-2 text-sm",
                  message.role === "user" && "flex-row-reverse text-right"
                )}
              >
                <div
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                    message.role === "user"
                      ? "bg-foreground/10"
                      : "bg-primary/10 text-primary"
                  )}
                >
                  {message.role === "user" ? (
                    <User className="size-3" />
                  ) : (
                    <Bot className="size-3" />
                  )}
                </div>
                <div className="rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs leading-relaxed">
                  {message.content}
                </div>
              </div>
            ))}
            {isThinking && (
              <div className="flex items-start gap-2 text-sm">
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Bot className="size-3" />
                </div>
                <div className="rounded-lg border bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex gap-1">
                    <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.2s]" />
                    <span className="size-1 animate-bounce rounded-full bg-current [animation-delay:-0.1s]" />
                    <span className="size-1 animate-bounce rounded-full bg-current" />
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          send(input)
        }}
        className="flex items-center gap-2 border-t p-3"
      >
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about this data..."
          className="h-8 text-xs"
        />
        <Button
          type="submit"
          size="icon"
          className="size-8 shrink-0"
          disabled={!input.trim() || isThinking}
        >
          <Send className="size-3.5" />
        </Button>
      </form>
    </div>
  )
}
