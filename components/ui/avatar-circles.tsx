'use client'

import Image from 'next/image'
import { cn } from '@/lib/utils/cn'

interface Avatar {
  imageUrl: string
  profileUrl: string
}
interface AvatarCirclesProps {
  className?: string
  numPeople?: number
  avatarUrls: Avatar[]
}

export const AvatarCircles = ({ numPeople, className, avatarUrls }: AvatarCirclesProps) => {
  return (
    <div className={cn('z-10 flex -space-x-4 rtl:space-x-reverse', className)}>
      {avatarUrls.map((url, index) => (
        <a key={index} href={url.profileUrl} target="_blank" rel="noopener noreferrer">
          <Image
            key={index}
            className="border-card h-10 w-10 rounded-full border-2"
            src={url.imageUrl}
            width={40}
            height={40}
            alt={`Avatar ${index + 1}`}
          />
        </a>
      ))}
      {(numPeople ?? 0) > 0 && (
        <a
          className="border-card bg-foreground text-background hover:bg-foreground/80 flex h-10 w-10 items-center justify-center rounded-full border-2 text-center text-xs font-medium"
          href=""
        >
          +{numPeople}
        </a>
      )}
    </div>
  )
}
