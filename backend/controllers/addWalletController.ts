import { prisma } from "../lib/db";
import type { MyContext, MyConversation } from "../bot";
import { sendCatalogue } from "./startController";

export const addWalletConversation = async (ctx: MyContext) => {
  await ctx.conversation.enter("add_wallet");
}

export const addWallet = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  if (!ctx.chat?.id) {
    await ctx.reply("Chat not found!");
    return;
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        telegramId: ctx.chat.id,
      },
    });

    if (!user) {
      await ctx.reply("You need to start the bot first, using the /start command.");
      return;
    }

    if (!user.hasActiveSubscription) {
      await ctx.reply("You need to subscribe to Revokin first, before adding a wallet.");
      await sendCatalogue(ctx);
      return;
    }

    await ctx.reply(
      "Please enter your wallet address for subscribing to notifications: ",
      {
        reply_markup: {
          force_reply: true,
        },
      }
    );

    const walletCtx = await conversation.wait();

    const walletAddress = walletCtx.message?.text;

    if (!walletAddress) {
      await ctx.reply("Invalid wallet address provided.");
      return;
    }

    const wallet = await prisma.wallet.create({
      data: {
        address: walletAddress,
        userId: user.id,
      },
    });

    await ctx.reply("Wallet added successfully! 🎉");

  } catch (error) {
    console.error(error);
    await ctx.reply("An error occurred while processing your request.");
  }
}