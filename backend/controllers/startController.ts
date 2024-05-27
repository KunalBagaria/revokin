import crypto from "crypto"
import type { Message } from "grammy/types"

import type { MyContext, MyConversation } from "../bot"
import { prisma } from "../lib/db"
import { resend } from "../lib/resend"
import { isSubActive } from "../lib/utils"

export const startController = async (ctx: MyContext) => {
  await ctx.conversation.enter("start")
}

export const sendCatalogue = async (ctx: MyContext) => {
  await ctx.reply(
    `You can now receive notifications for $5/month or $50/year.`,
    {
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
  )
}

let i = 0

export const startConversation = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
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

    if (
      user &&
      user.subscriptionEndDate &&
      isSubActive(user.subscriptionEndDate)
    ) {
      await ctx.reply("You are already subscribed to Revokin! 🎉")
      return
    }

    if (
      user &&
      (!user.subscriptionEndDate || !isSubActive(user.subscriptionEndDate))
    ) {
      await sendCatalogue(ctx)
      return
    }

    if (!user) {
      await ctx.reply(
        "Welcome to the Revokin bot! Please enter your email to continue: ",
        {
          reply_markup: {
            force_reply: true,
          },
        }
      )

      const emailCtx = await conversation.wait()

      if (!emailCtx?.message?.text) {
        throw new Error("Message not found!")
      }

      const email = (emailCtx.message as Message).text

      if (!email) {
        await ctx.reply("Email not found!")
        return
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        await ctx.reply("Invalid email! Please try again.")
        return
      }

      const userWithEmail = await prisma.user.findFirst({
        where: {
          email: email,
        },
      })

      if (userWithEmail) {
        await ctx.reply(
          `Oops, it looks like ${email} is already connected to another Telegram account. Please try again!`
        )
        return
      }

      const random = await conversation.random()
      const randomCode = Math.floor(100000 + random * 900000).toString()
      i++
      console.log("Random code: ", randomCode, i)

      await conversation.external(async () => {
        await resend.emails.send({
          from: "Revokin <contact@revokin.com>",
          to: [email],
          subject: "Revokin Verification Code",
          text: `Your verification code is: ${randomCode}`,
        })
      })

      await ctx.reply(
        `We have sent a verification code to your email. Please enter the code here: `,
        {
          reply_markup: {
            force_reply: true,
          },
        }
      )

      const codeCtx = await conversation.wait()

      if (!codeCtx?.message?.text) {
        throw new Error("Message not found!")
      }

      const code = (codeCtx.message as Message).text

      if (!code) {
        await ctx.reply("Code not found!")
        return
      }

      console.log("Code: ", code, i)

      if (code !== randomCode) {
        await ctx.reply(
          `Oops, that is an invalid verification code. Please try again by using the /start command.`,
          {
            parse_mode: "Markdown",
          }
        )
        return
      }

      await prisma.user.create({
        data: {
          name:
            ctx.chat.first_name && ctx.chat.last_name
              ? `${ctx.chat.first_name} ${ctx.chat.last_name}`
              : "Unknown",
          email: email,
          telegramId: ctx.chat.id,
          tgConnectCode: randomCode,
        },
      })

      await ctx.reply(
        `Your email has been successfully connected to your Telegram account on Revokin! 🎉`
      )

      await sendCatalogue(ctx)
    }
  } catch (error) {
    console.error("Error in startConversation: ", error)
  }
}
