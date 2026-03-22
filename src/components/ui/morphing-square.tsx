import { motion } from "motion/react"
import type { HTMLMotionProps } from "motion/react"
import { cn } from "@/lib/utils"

export interface MorphingSquareProps {
  size?: number
  color?: string
}

export function MorphingSquare({
  className,
  size = 16,
  color,
  ...props
}: HTMLMotionProps<"div"> & MorphingSquareProps) {
  return (
    <motion.div
      className={cn("bg-foreground", className)}
      style={{
        width: size,
        height: size,
        ...(color ? { backgroundColor: color } : {}),
      }}
      animate={{
        borderRadius: ["6%", "50%", "6%"],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration: 2,
        repeat: Number.POSITIVE_INFINITY,
        ease: "easeInOut",
      }}
      {...props}
    />
  )
}
