import { TOKEN_PROGRAM_ID, unpackAccount } from "@solana/spl-token"
import { Connection, PublicKey } from "@solana/web3.js"
import { configDotenv } from "dotenv"
import { Api } from "grammy"
import WebSocket from "ws"

import { rpc } from "./lib/constants"
import { prisma } from "./lib/db"

configDotenv()

if (!process.env.HELIUS_API_KEY) {
  throw new Error("HELIUS_API_KEY env var is required")
}

const token = process.env.BOT_TOKEN
if (!token) throw new Error("BOT_TOKEN is unset")

const tgApi = new Api(token)

const atlasWS = `wss://atlas-mainnet.helius-rpc.com?api-key=${process.env.HELIUS_API_KEY}`

;(async () => {
  try {
    const tokenListRes = await fetch("https://cache.jup.ag/tokens")
    const tokenList = await tokenListRes.json()

    const conn = new Connection(rpc, "confirmed")

    const tokenAccountsToSubscribe = await prisma.tokenAccount.findMany({
      where: {
        wallet: {
          user: {
            subscriptionEndDate: {
              gt: new Date(),
            },
          },
        },
      },
    })

    const socket = new WebSocket(atlasWS)

    socket.onopen = () => {
      console.log("socket open")

      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 420,
          method: "transactionSubscribe",
          params: [
            {
              vote: false,
              failed: false,
              accountInclude: tokenAccountsToSubscribe.map((ta) => ta.address),
              accountRequired: [TOKEN_PROGRAM_ID],
              accountExclude: ["SAGE2HAwep459SNq61LHvjxPk4pLPEJLoMETef7f7EE"],
            },
            {
              commitment: "processed",
              encoding: "jsonParsed",
              transaction_details: "full",
              showRewards: true,
              maxSupportedTransactionVersion: 0,
            },
          ],
        })
      )

      console.log(`subscribed to `)
    }

    socket.onmessage = async (event) => {
      // console.log(event.data)
      try {
        const parsedEvent = JSON.parse(event.data.toString())

        if (
          parsedEvent.method === "transactionNotification" &&
          !parsedEvent.params.result.transaction.meta.err
        ) {
          const logs = parsedEvent.params.result.transaction.meta.logMessages
          let run = false

          let initIxsNumber = 0
          let closeIxsNumber = 0
          let approveIxsNumber = 0
          let revokeIxsNumber = 0

          for (const log of logs) {
            const ixLogs = logs.filter((l: string) =>
              l.startsWith("Program log: Instruction: ")
            )

            // if there is no revoke instructions and a least one approve ix, but if there are revoke ixs as well, then dont

            initIxsNumber = ixLogs.filter((l: string) =>
              l.includes("InitializeAccount")
            ).length
            closeIxsNumber = ixLogs.filter((l: string) =>
              l.includes("CloseAccount")
            ).length

            approveIxsNumber = ixLogs.filter((l: string) =>
              l.includes("Approve")
            ).length
            revokeIxsNumber = ixLogs.filter((l: string) =>
              l.includes("Revoke")
            ).length

            if (
              approveIxsNumber > 0 &&
              revokeIxsNumber === 0 &&
              initIxsNumber === 0
            ) {
              run = true
            }
          }

          const ixsWithInner =
            parsedEvent.params.result.transaction.meta.innerInstructions

          const ixsFlat = ixsWithInner.flatMap((ix: any) => ix.instructions)

          const approveIxs = ixsFlat.filter(
            (ix: any) =>
              ix.programId === TOKEN_PROGRAM_ID.toBase58() &&
              ix.parsed.type === "approve" &&
              Number(ix.parsed.info.amount) > 0
          )

          if (run) {
            console.log({
              approveIxsNumber,
              sig: parsedEvent.params.result.signature,
              ixs: approveIxs.map((i: any) => i.parsed.info),
            })

            for (const ix of approveIxs) {
              const ixParsed = ix.parsed.info
              const tokenAccountInfo = await conn.getAccountInfo(
                new PublicKey(ixParsed.source)
              )

              if (tokenAccountsToSubscribe.includes(ixParsed.source)) {
                console.log("In tokenAccountsToSubscribe")
              } else {
                console.log("Not in tokenAccountsToSubscribe")
              }

              if (!tokenAccountInfo) {
                return
              }

              const tokenAccount = unpackAccount(
                new PublicKey(ixParsed.source),
                tokenAccountInfo
              )

              const token = tokenList.find(
                (t: any) => t.address === tokenAccount.mint.toBase58()
              )

              console.log(
                `${token?.symbol || tokenAccount.mint.toBase58()}: ${
                  token
                    ? ixParsed.amount / 10 ** token?.decimals
                    : `${ixParsed.amount} (ignoring decimals)`
                } delegated to ${tokenAccount.delegate?.toBase58()}`,
                tokenAccount
              )

              const user = await prisma.user.findFirst({
                where: {
                  wallets: {
                    some: {
                      tokenAccount: {
                        some: {
                          address: tokenAccount.address.toBase58(),
                        },
                      },
                    },
                  },
                },
                include: {
                  wallets: {
                    where: {
                      tokenAccount: {
                        some: {
                          address: tokenAccount.address.toBase58(),
                        },
                      },
                    },
                  },
                },
              })

              if (!user) {
                console.log("User not found")
                continue
              }

              if (!user.telegramId) {
                console.log("User has no telegram id")
                continue
              }

              const message = `Delegated ${
                token?.symbol || tokenAccount.mint.toBase58()
              }: ${
                token
                  ? ixParsed.amount / 10 ** token?.decimals
                  : `${ixParsed.amount} (ignoring decimals)`
              } to ${tokenAccount.delegate?.toBase58()}\nAccount: ${
                user.wallets[0].address
                // tokenAccount.address.toBase58()
              }\n\nTx: [${
                parsedEvent.params.result.signature
              }](https://solana.fm/tx/${
                parsedEvent.params.result.signature
              }) (Solana FM)`

              await tgApi.sendMessage(user.telegramId, message, {
                parse_mode: "Markdown",
              })

              // await tgApi.sendMessage(Number(process.env.TG_ID), message, {
              //   parse_mode: "Markdown",
              // })

              await prisma.notificationLog.create({
                data: {
                  message,
                  wasSuccessful: true,
                  user: {
                    connect: {
                      id: user.id,
                    },
                  },
                },
              })

              await prisma.tokenAccount.update({
                where: {
                  address: tokenAccount.address.toBase58(),
                },
                data: {
                  isDelegated: true,
                },
              })
            }
          }
        }
      } catch (e) {
        console.error(e)
      }
    }
  } catch (e) {
    console.error(e)
  }
})()
