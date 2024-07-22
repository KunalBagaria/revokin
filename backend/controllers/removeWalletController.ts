import { InlineKeyboard } from "grammy"

import type { MyContext, MyConversation } from "../bot"
import { prisma } from "../lib/db"

export const removeWalletController = async (ctx: MyContext) => {
  await ctx.conversation.enter("remove_wallet")
}

export const removeWalletConversation = async (
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
        telegramId: ctx.chat.id.toString(),
      },
      include: {
        wallets: true,
      },
    })

    if (!user) {
      await ctx.reply(
        "You need to start the bot first, using the /start command."
      )
      return
    }

    if (!user.wallets.length) {
      await ctx.reply(
        "You haven't added any wallets yet. Start by adding one using the /add_wallet command."
      )
      return
    }

    const walletList = user.wallets.map((wallet) => wallet.address).join("\n")

    const inlineKeyboard = new InlineKeyboard()

    for (let i = 0; i < user.wallets.length; i++) {
      inlineKeyboard.text(
        user.wallets[i].address,
        `remove_wallet:${user.wallets[i].id}`
      )
    }

    inlineKeyboard.row().text("Cancel", "remove_wallet:cancel")

    await ctx.reply(`Select the wallet you want to remove: \n${walletList}`, {
      reply_markup: inlineKeyboard,
    })

    ctx = await conversation.waitFor("callback_query:data")

    const event = ctx.callbackQuery?.data

    if (!event) {
      throw new Error("No callback data")
    }

    if (!ctx.from?.id) {
      throw new Error("Telegram ID not found!")
    }

    if (event === "remove_wallet:cancel") {
      await ctx.reply("Operation cancelled.")
      return
    }

    const walletId = event.split(":")[1]

    await prisma.$transaction([
      prisma.tokenAccount.deleteMany({
        where: {
          walletId: walletId,
        },
      }),
      prisma.wallet.delete({
        where: {
          id: walletId,
        },
      }),
    ])

    await ctx.reply("Wallet removed successfully.")
  } catch (error) {
    console.error(error)
    await ctx.reply("An error occurred while processing your request.")
  }
}
