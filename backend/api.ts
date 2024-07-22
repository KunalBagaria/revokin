import Elysia from "elysia"
import Stripe from "stripe"

import { prisma } from "./lib/db"

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required")
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
  throw new Error("STRIPE_WEBHOOK_SECRET is required")
}

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY)
const whsec = process.env.STRIPE_WEBHOOK_SECRET

new Elysia()
  .post(
    "/webhooks/stripe",
    async ({
      headers,
      request,
      // body,
    }: {
      body: any
      headers: Record<string, string>
      request: any
    }) => {
      const sig = headers["stripe-signature"]

      let event

      try {
        event = stripeClient.webhooks.constructEvent(
          Buffer.from(await Bun.readableStreamToArrayBuffer(request.body)),
          sig,
          whsec
        )

        if (!event) {
          return new Response(
            JSON.stringify({
              received: false,
              message: "No event",
            }),
            { status: 400 }
          )
        }

        switch (event.type) {
          case "invoice.paid":
            console.log("Invoice paid")

            const data = event.data.object

            const email = data.customer_email
            const subId = data.subscription

            if (!email || !subId) {
              return new Response(
                JSON.stringify({
                  received: false,
                  message: "No email or sub ID",
                }),
                { status: 400 }
              )
            }

            const user = await prisma.user.findUnique({
              where: {
                email: email,
              },
            })

            const sub = await stripeClient.subscriptions.retrieve(
              subId.toString()
            )

            if (!sub) {
              return new Response(
                JSON.stringify({
                  received: false,
                }),
                { status: 400 }
              )
            }

            const subEnd = sub.current_period_end
            const plan = (sub as any).plan
            const product = await stripeClient.products.retrieve(plan.product)
            const productName = product.name

            let maxWallets = 10

            // if (productName === "Revokin Subscription") {
            //   maxWallets = 3
            // }

            if (!user) {
              return new Response(
                JSON.stringify({
                  received: false,
                  message: "User not found",
                }),
                { status: 400 }
              )
            }

            await prisma.user.update({
              where: {
                email: email,
              },
              data: {
                subscriptionEndDate: new Date(subEnd * 1000),
                maxActiveWallets: maxWallets,
              },
            })

            break
        }

        return new Response(
          JSON.stringify({
            received: true,
          }),
          { status: 200 }
        )
      } catch (err: any) {
        console.error(err)
        new Response(`Webhook Error: ${err.message}`, { status: 400 })
      }
    }
  )
  .listen(process.env.PORT || 6000)

console.log("Webhook server running on port 6000")
