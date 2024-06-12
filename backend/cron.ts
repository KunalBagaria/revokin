import { Connection } from "@solana/web3.js"
import { configDotenv } from "dotenv"
import cron from "node-cron"

import { rpc } from "./lib/constants"
import { prisma } from "./lib/db"
import { getTokenAccounts } from "./lib/utils"

configDotenv()

if (!process.env.HELIUS_API_KEY) {
  throw new Error("HELIUS_API_KEY env var is required")
}

cron.schedule("0 */6 * * *", async () => {
  console.log("Running Cron")

  await prisma.tokenAccount.deleteMany({
    where: {
      wallet: {
        user: {
          subscriptionEndDate: {
            lte: new Date(),
          },
        },
      },
    },
  })

  const wallets = await prisma.wallet.findMany({
    where: {
      user: {
        subscriptionEndDate: {
          gt: new Date(),
        },
      },
    },
  })

  console.log(wallets)

  const conn = new Connection(rpc)

  const tokenListRes = await fetch("https://cache.jup.ag/tokens")
  const tokenList = await tokenListRes.json()

  for (const wallet of wallets) {
    const tokensFiltered = await getTokenAccounts(
      conn,
      wallet.address,
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
  }
})