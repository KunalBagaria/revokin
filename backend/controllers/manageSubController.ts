import type { MyContext } from "../bot"
import { prisma } from "../lib/db"

export const manageSubscriptionController = async (ctx: MyContext) => {
  if (!ctx.chat?.id) {
    await ctx.reply("Chat not found!")
    return
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        telegramId: ctx.chat.id,
      },
    })

    if (!user) {
      await ctx.reply(
        "You need to start the bot first, using the /start command."
      )
      return
    }

    await ctx.reply(
      "You can manage you subcription by logging in with the email you registered with.",
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Subscription Management Portal",
                url: "https://billing.stripe.com/p/login/3cs03o8kq2ga3Je5kk",
              },
            ],
          ],
        },
      }
    )
  } catch (e) {
    console.error(e)
    await ctx.reply("An error occurred while processing your request.")
  }
}
