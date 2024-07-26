import { redirect } from "next/navigation"

import { siteConfig } from "@/config/site"

export const GET = () => {
  redirect(siteConfig.links.bot)
}
