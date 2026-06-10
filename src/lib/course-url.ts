// Build the final Udemy enrol URL (coupon already applied). The coupon is
// baked into the link, so we never display a coupon code to the visitor.
export function buildUdemyUrl(course: {
  udemyUrl: string
  couponUrl: string
  couponCode: string
}): string {
  if (course.couponUrl) return course.couponUrl

  const baseUrl = course.udemyUrl
  const couponCode = course.couponCode
  if (couponCode && baseUrl) {
    try {
      const urlObj = new URL(baseUrl)
      urlObj.searchParams.set('couponCode', couponCode)
      return urlObj.toString()
    } catch {
      /* fall through */
    }
  }
  return baseUrl
}
