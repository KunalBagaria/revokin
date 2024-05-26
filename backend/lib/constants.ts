import { configDotenv } from "dotenv"

configDotenv()

export const rpc = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
