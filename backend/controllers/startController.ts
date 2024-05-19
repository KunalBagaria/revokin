import type { Message } from "grammy/types"

import type { MyContext, MyConversation } from "../bot"
import { prisma } from "../lib/db"

export const startController = async (ctx: MyContext) => {
  await ctx.conversation.enter("start")
}

export const startConversation = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  if (!ctx.chat?.id) {
    await ctx.reply("Chat not found!")
    return
  }

  try {
    // const user = await prisma.user.findUnique({
    //   where: {
    //     telegramId: ctx.chat.id,
    //   },
    // })

    // if (!user) {
    //   await ctx.reply(
    //     "Welcome to the Revokin bot! Please enter the authentication code to continue: ",
    //     {
    //       reply_markup: {
    //         force_reply: true,
    //       },
    //     }
    //   )

    //   ctx = await conversation.wait()

    //   if (!ctx?.message?.text) {
    //     throw new Error("Message not found!")
    //   }

    //   const code = (ctx.message as Message).text

    //   const user = await prisma.user.findUnique({
    //     where: {
    //       tgConnectCode: code,
    //     },
    //   })

    //   if (!user) {
    //     await ctx.reply(
    //       `Oops, we couldn't find a code matching ${code}. Please try again!`
    //     )

    //     return
    //   }

    //   if (!ctx.chat?.id) {
    //     await ctx.reply("Chat not found!")
    //     return
    //   }

    //   await prisma.user.update({
    //     where: {
    //       id: user.id,
    //     },
    //     data: {
    //       telegramId: ctx.chat.id,
    //     },
    //   })

    //   await ctx.reply(`You are now receiving notifications!`)

    // }

    // send two stripe links formatted, $5/month or $50/year
    await ctx.reply(
      `Welcome to Revokin! You can now receive notifications for $5/month or $50/year.`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "$5/month",
                url: "https://buy.stripe.com/4gw3g81bD4sPgmscMP",
              },
            ],
            [
              {
                text: "$50/year",
                url: "https://buy.stripe.com/bIYdUMdYpcZl5HOeUW",
              },
            ],
          ],
        },
      }
    );

  } catch (error) {
    console.error("Error in startController: ", error)
  }
}
