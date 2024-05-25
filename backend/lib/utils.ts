export const isSubActive = (endDate: Date) => {
  const now = new Date()
  return now < endDate
}
