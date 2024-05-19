import crypto from "crypto";
import { prisma } from "../lib/db";
import type { Message } from "grammy/types";
import type { MyContext, MyConversation } from "../bot";

export const startController = async (ctx: MyContext) => {
  await ctx.conversation.enter("start");
};

export const startConversation = async (
  conversation: MyConversation,
  ctx: MyContext
) => {
  if (!ctx.chat?.id) {
    await ctx.reply("Chat not found!");
    return;
  }

  async function sendCatalogue() {
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
    );
  }

  try {
    const user = await prisma.user.findFirst({
      where: {
        telegramId: ctx.chat.id,
      },
    });

    if (user && user.hasActiveSubscription) {
      await ctx.reply("You are already subscribed to Revokin! 🎉");
      return;
    }

    if (user && !user.hasActiveSubscription) {
      await sendCatalogue();
      return;
    }

    if (!user) {
      await ctx.reply(
        "Welcome to the Revokin bot! Please enter your email to continue: ",
        {
          reply_markup: {
            force_reply: true,
          },
        }
      );

      const emailCtx = await conversation.wait();

      if (!emailCtx?.message?.text) {
        throw new Error("Message not found!");
      }

      const email = (emailCtx.message as Message).text;

      if (!email) {
        await ctx.reply("Email not found!");
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await ctx.reply("Invalid email! Please try again.");
        return;
      }

      const randomCode = crypto.randomBytes(16).toString("hex");

      await prisma.user.create({
        data: {
          name: ctx.chat.first_name && ctx.chat.last_name ? `${ctx.chat.first_name} ${ctx.chat.last_name}` : "Unknown",
          email: email,
          tgConnectCode: randomCode,
        },
      });

      // todo: send email with code
      // sendEmail(email, randomCode);

      await ctx.reply(
        `We have sent a verification code to your email. Please enter the code here: `,
        {
          reply_markup: {
            force_reply: true,
          },
        }
      );

      const codeCtx = await conversation.wait();

      if (!codeCtx?.message?.text) {
        throw new Error("Message not found!");
      }

      const code = (codeCtx.message as Message).text;

      if (!code) {
        await ctx.reply("Code not found!");
        return;
      }

      const verifiedUser = await prisma.user.findFirst({
        where: {
          tgConnectCode: code,
        },
      });

      if (!verifiedUser) {
        await ctx.reply(
          `Oops, we couldn't find a code matching ${code}. Please try again!`
        );
        return;
      }

      await prisma.user.update({
        where: {
          id: verifiedUser.id,
        },
        data: {
          telegramId: ctx.chat.id,
          tgConnectCode: null, // Clear the code after successful verification
        },
      });

      // send email confirmation message
      await ctx.reply(
        `Your email has been successfully connected to your Telegram account on Revokin! 🎉`
      );

      await sendCatalogue();
    }

  } catch (error) {
    console.error("Error in startConversation: ", error);
  }
};
