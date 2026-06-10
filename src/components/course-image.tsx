'use client'

const PLACEHOLDER_IMG = 'https://img-b.udemycdn.com/course/480x270/placeholder.jpg'

// A plain <img> with a placeholder fallback. Lives in a client component so
// the onError handler is allowed (server components cannot pass event handlers).
export function CourseImage({
  src,
  alt,
  className,
  loading,
}: {
  src: string
  alt: string
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  return (
    <img
      src={src || PLACEHOLDER_IMG}
      alt={alt}
      className={className}
      loading={loading}
      onError={(e) => {
        e.currentTarget.src = PLACEHOLDER_IMG
      }}
    />
  )
}
