import { z } from "zod";

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

export const env = envSchema.parse({
  MONGODB_URI: process.env.MONGODB_URI,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});
