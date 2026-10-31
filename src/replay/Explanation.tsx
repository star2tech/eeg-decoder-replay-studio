import { createPortal } from 'react-dom'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { EXPLANATIONS, type ExplanationTopic } from './explanations'

interface ExplanationProps {
  topic?: ExplanationTopic
  title?: string
  body?: string
  label?: string
  preferAbove?: boolean
  triggerText?: string
}

export default function Explanation({
  topic,
  title,
  body,
  label,
  preferAbove = false,
  triggerText,
}: ExplanationProps) {
  const contentId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<number | undefined>(undefined)
  const interaction = useRef({ pinned: false, hovered: false, focused: false })
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ left: 12, top: 12 })
  const content = topic ? EXPLANATIONS[topic] : undefined
  const popoverTitle = title ?? content?.title ?? 'Explanation'
  const popoverBody = body ?? content?.body ?? ''
  const accessibleLabel = label ?? `Explain ${popoverTitle}`
  const openExplanation = () => {
    window.dispatchEvent(
      new CustomEvent('replay:open-explanation', { detail: contentId }),
    )
    setIsOpen(true)
  }

  const closeIfInactive = useCallback(() => {
    if (interaction.current.pinned || interaction.current.hovered || interaction.current.focused) return
    setIsOpen(false)
  }, [])

  const hideAfterPointerLeaves = () => {
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(closeIfInactive, 120)
  }

  useLayoutEffect(() => {
    if (!isOpen || !popoverRef.current || !triggerRef.current) return
    const trigger = triggerRef.current.getBoundingClientRect()
    const popover = popoverRef.current.getBoundingClientRect()
    const margin = 12
    const left = Math.max(
      margin,
      Math.min(trigger.left, document.documentElement.clientWidth - popover.width - margin),
    )
    const hasRoomBelow = window.innerHeight - trigger.bottom >= popover.height + 12
    const top = preferAbove || !hasRoomBelow
      ? Math.max(margin, trigger.top - popover.height - 8)
      : trigger.bottom + 8
    setPosition({ left, top })
  }, [isOpen, popoverBody, popoverTitle, preferAbove])

  useEffect(() => {
    const onExplanationOpen = (event: Event) => {
      if ((event as CustomEvent<string>).detail === contentId) return
      setIsOpen(false)
      interaction.current = { pinned: false, hovered: false, focused: false }
    }
    window.addEventListener('replay:open-explanation', onExplanationOpen)
    return () => window.removeEventListener('replay:open-explanation', onExplanationOpen)
  }, [contentId])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setIsOpen(false)
      interaction.current = { pinned: false, hovered: false, focused: false }
      window.clearTimeout(hoverTimer.current)
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setIsOpen(false)
      interaction.current.pinned = false
    }
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    const onScroll = () => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const popover = popoverRef.current?.getBoundingClientRect()
      if (!trigger || !popover) return
      const margin = 12
      const left = Math.max(
        margin,
        Math.min(trigger.left, document.documentElement.clientWidth - popover.width - margin),
      )
      const hasRoomBelow = window.innerHeight - trigger.bottom >= popover.height + 12
      const top = preferAbove || !hasRoomBelow
        ? Math.max(margin, trigger.top - popover.height - 8)
        : trigger.bottom + 8
      setPosition({ left, top })
    }
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [isOpen, preferAbove])

  useEffect(
    () => () => {
      window.clearTimeout(hoverTimer.current)
    },
    [],
  )

  return (
    <>
      <button
        ref={triggerRef}
        className={`explanation-trigger${triggerText ? ' explanation-trigger-value' : ''}`}
        type="button"
        aria-label={accessibleLabel}
        aria-expanded={isOpen}
        aria-controls={contentId}
        aria-haspopup="dialog"
        onFocus={() => {
          interaction.current.focused = true
          openExplanation()
        }}
        onBlur={(event) => {
          interaction.current.focused = false
          if (!event.relatedTarget || !popoverRef.current?.contains(event.relatedTarget as Node)) {
            if (!interaction.current.pinned && !interaction.current.hovered) setIsOpen(false)
          }
        }}
        onPointerEnter={() => {
          interaction.current.hovered = true
          window.clearTimeout(hoverTimer.current)
          openExplanation()
        }}
        onPointerLeave={() => {
          interaction.current.hovered = false
          hideAfterPointerLeaves()
        }}
        onClick={() => {
          window.clearTimeout(hoverTimer.current)
          const nextPinned = !interaction.current.pinned
          interaction.current.pinned = nextPinned
          if (nextPinned) openExplanation()
          else closeIfInactive()
        }}
      >
        <span aria-hidden={triggerText ? undefined : 'true'}>{triggerText ?? 'i'}</span>
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            className="explanation-popover"
            id={contentId}
            role="dialog"
            aria-label={popoverTitle}
            style={{ left: `${position.left}px`, top: `${position.top}px` }}
            onPointerEnter={() => {
              window.clearTimeout(hoverTimer.current)
              interaction.current.hovered = true
            }}
            onPointerLeave={() => {
              interaction.current.hovered = false
              hideAfterPointerLeaves()
            }}
          >
            <strong>{popoverTitle}</strong>
            <p>{popoverBody}</p>
          </div>,
          document.body,
        )}
    </>
  )
}
