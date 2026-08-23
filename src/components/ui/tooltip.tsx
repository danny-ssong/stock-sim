"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * 부연 설명을 본문에서 걷어내 트리거 옆으로 내리는 툴팁.
 *
 * Radix 기본 동작은 hover·focus로만 열려 터치 기기에서 도달할 수 없다.
 * open을 제어 상태로 두고 onPointerDown에서 preventDefault를 부른다 —
 * Radix의 composeEventHandlers가 defaultPrevented를 확인한 뒤 내부 닫기
 * 핸들러를 건너뛰므로, 탭 한 번으로 열고 다시 탭해서 닫을 수 있다.
 */
export function InfoTooltip({
  label,
  children,
}: {
  /** 트리거의 접근성 이름. 화면에는 보이지 않는다 */
  label: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <TooltipPrimitive.Provider delayDuration={150}>
      <TooltipPrimitive.Root open={open} onOpenChange={setOpen}>
        <TooltipPrimitive.Trigger
          type="button"
          aria-label={label}
          onPointerDown={(event) => {
            event.preventDefault()
            setOpen((prev) => !prev)
          }}
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-zinc-400 text-[10px] leading-none text-zinc-500 dark:border-zinc-600 dark:text-zinc-400"
        >
          i
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            collisionPadding={8}
            className={cn(
              "z-50 max-w-64 rounded-md bg-zinc-900 px-3 py-2 text-xs leading-relaxed text-zinc-50",
              "dark:bg-zinc-100 dark:text-zinc-900"
            )}
          >
            {children}
            <TooltipPrimitive.Arrow className="fill-zinc-900 dark:fill-zinc-100" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
