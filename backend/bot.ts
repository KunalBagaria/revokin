import { autoRetry } from "@grammyjs/auto-retry"
import {
  conversations,
  createConversation,
  type Conversation,
  type ConversationFlavor,
} from "@grammyjs/conversations"
import { limit } from "@grammyjs/ratelimiter"
import { run, sequentialize } from "@grammyjs/runner"
import { apiThrottler } from "@grammyjs/transformer-throttler"
import { configDotenv } from "dotenv"
import {
  Bot,
  Context,
  MemorySessionStorage,
  session,
  type SessionFlavor,
} from "grammy"

import {
  startController,
  startConversation,
} from "./controllers/startController"
import { addWallet, addWalletConversation } from "./controllers/addWalletController"

configDotenv()

export type MyContext = Context & SessionFlavor<any> & ConversationFlavor

export type MyConversation = Conversation<MyContext>

const token = Bun.env.BOT_TOKEN
if (!token) throw new Error("BOT_TOKEN is unset")
;(async () => {
  const bot = new Bot<MyContext>(token)

  const initialSession = () => ({})
  const sessionStorage = new MemorySessionStorage()

  bot.api.config.use(autoRetry())
  const throttler = apiThrottler()
  bot.api.config.use(throttler)

  bot.use(
    session({
      initial: initialSession,
      storage: sessionStorage,
    })
  )

  bot.use(
    sequentialize((ctx) => {
      const chat = ctx.chat?.id.toString()
      const user = ctx.from?.id.toString()
      return [chat, user].filter((con) => con !== undefined) as any
    })
  )

  bot.use(
    limit({
      timeFrame: 2000,
      limit: 1,
      onLimitExceeded: async (ctx) => {
        await ctx.reply("Please refrain from sending too many requests!")
      },
      keyGenerator: (ctx) => {
        return ctx.from?.id.toString()
      },
    })
  )

  bot.use(conversations())

  bot.use(createConversation(startConversation, "start"))
  bot.use(createConversation(addWallet, "add_wallet"))

  bot.command("start", startController)
  bot.command("add_wallet", addWalletConversation)

  process.on("SIGINT", () => bot.stop())
  process.on("SIGTERM", () => bot.stop())

  const handle = run(bot)

  handle.task()?.then(() => {
    console.log("Bot done processing!")
  })
})().catch(console.error)
