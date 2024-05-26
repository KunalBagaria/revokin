import { TOKEN_PROGRAM_ID } from "@solana/spl-token"
import type { Connection, GetProgramAccountsFilter } from "@solana/web3.js"

export const isSubActive = (endDate: Date) => {
  const now = new Date()
  return now < endDate
}

export const getTokenAccounts = async (
  conn: Connection,
  address: string,
  tokenList: any
) => {
  const filters: GetProgramAccountsFilter[] = [
    {
      dataSize: 165,
    },
    {
      memcmp: {
        offset: 32,
        bytes: address,
      },
    },
  ]

  const accounts = await conn.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    filters: filters,
  })

  const tokensParsedInfo = accounts.map((account) => {
    const parsedAccountInfo: any = account.account.data

    const mintAddress: string = parsedAccountInfo.parsed.info.mint
    const delegate = parsedAccountInfo.parsed.info.delegate

    return {
      mintAddress,
      ata: account.pubkey.toBase58(),
      delegate,
    }
  })

  const tokenListMintAddresses = tokenList.map((token: any) => token.address)

  const tokensFiltered = tokensParsedInfo.filter((token) => {
    return tokenListMintAddresses.includes(token.mintAddress)
  })

  return tokensFiltered
}
