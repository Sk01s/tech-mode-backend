import express, { json } from "express";
import Stripe from "stripe";
import cors from "cors";
import { getProductPrice, addOrder } from "../firebase-config.js";

const stripe = Stripe(process.env.REACT_APP_STRIPE_API_KEY);
const router = express.Router();

router.use(
  cors({
    origin: ["https://rebar-shop.vercel.app", "http://127.0.0.1:5173"],
  })
);

router.use(
  json({
    verify: (req, res, buffer) => (req["rawBody"] = buffer),
  })
);

router.post("/", async (req, res) => {
  const products = await getProductPrice();
  const { userId, address, items } = req.body;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: items.map(({ id, quantity, options }) => {
      const { name, priceInCents, images } = products[id];
      if (quantity < 1) return;
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${name} ${[...Object.keys(options)].map(
              (key) => `${key}: ${options[key]}`
            )}`,
            images: images,
          },
          unit_amount: priceInCents,
        },
        quantity,
      };
    }),
    customer: userId,
    success_url: `https://${process.env.YOUR_DOMAIN}?success=true`,
    cancel_url: `https://${process.env.YOUR_DOMAIN}?canceled=true`,
  });
  const priceTotal = session.amount_total;
  const sessionId = session.id;
  await addOrder(sessionId, address, items, priceTotal, userId);
  await stripe.customers.update(userId, {
    metadata: {
      sessionId,
    },
  });

  res.json({ url: session.url });
});

export default router;
