'use client'
import { getInitials, AVATAR_COLORS } from '@/lib/calculations'

interface Props {
  name: string
  index: number
  size?: number
  fontSize?: number
}

export function MemberAvatar({ name, index, size = 32, fontSize = 13 }: Props) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length]
  return (
    <div
      className="avatar"
      style={{
        width: size, height: size, fontSize,
        background: color.bg, color: color.color,
      }}
    >
      {getInitials(name)}
    </div>
  )
}
