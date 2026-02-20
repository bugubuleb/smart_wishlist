import { Router } from "express";
import { z } from "zod";

import { convertCurrency, isSupportedCurrency } from "../services/currency.js";
import { previewProductByUrl } from "../services/product-preview.js";

const previewSchema = z.object({
  url: z.string().url(),
  targetCurrency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
});

export const productRouter = Router();

productRouter.post("/products/preview", async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid URL" });

  try {
    const data = await previewProductByUrl(parsed.data.url);
    const targetCurrency = parsed.data.targetCurrency;
    if (!targetCurrency || !isSupportedCurrency(targetCurrency)) {
      return res.json(data);
    }

    if (data.targetPrice == null || !data.sourceCurrency) {
      return res.json({
        ...data,
        convertedCurrency: targetCurrency,
        convertedPrice: data.targetPrice,
      });
    }

    const converted = await convertCurrency(data.targetPrice, data.sourceCurrency, targetCurrency);
    return res.json({
      ...data,
      convertedCurrency: targetCurrency,
      convertedPrice: converted ?? data.targetPrice,
    });
  } catch {
    res.status(422).json({ message: "Failed to parse product page" });
  }
});
