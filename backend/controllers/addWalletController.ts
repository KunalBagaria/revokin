import { Connection } from "@solana/web3.js"

import type { MyContext, MyConversation } from "../bot"
import { rpc } from "../lib/constants"
import { prisma } from "../lib/db"
import { getTokenAccounts, isSubActive } from "../lib/utils"
import { sendCatalogue } from "./startController"

export const addWalletController = async (ctx: MyContext) => {
  await ctx.conversation.enter("add_wallet")
}

export const addWalletConversation = async (
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

    if (!user) {
      await ctx.reply(
        "You need to start the bot first, using the /start command."
      )
      return
    }
    if (
      user &&
      (!user.subscriptionEndDate || !isSubActive(user.subscriptionEndDate))
    ) {
      await sendCatalogue(ctx)
      return
    }

    await ctx.reply(
      "Please enter your wallet address for subscribing to notifications: ",
      {
        reply_markup: {
          force_reply: true,
        },
      }
    )

    const walletCtx = await conversation.wait()

    const walletAddress = walletCtx.message?.text

    if (!walletAddress) {
      await ctx.reply("Invalid wallet address provided.")
      return
    }

    const wallet = await prisma.wallet.create({
      data: {
        address: walletAddress,
        userId: user.id,
      },
    })

    const conn = new Connection(rpc)

    const tokenListRes = await fetch("https://cache.jup.ag/tokens")
    const tokenList = await tokenListRes.json()

    const tokensFiltered = await getTokenAccounts(
      conn,
      walletAddress,
      tokenList
    )

    await prisma.tokenAccount.createMany({
      data: tokensFiltered.map((token) => {
        return {
          walletId: wallet.id,
          address: token.ata,
          isDelegated: !!token.delegate,
        }
      }),
      skipDuplicates: true,
    })

    await ctx.reply("Wallet added successfully! 🎉")
  } catch (error) {
    console.error(error)
    await ctx.reply("An error occurred while processing your request.")
  }
}
