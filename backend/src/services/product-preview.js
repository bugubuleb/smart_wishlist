function decodeHtml(raw) {
  return String(raw || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseAttributes(tag) {
  const attrs = {};
  const attrRegex = /([a-zA-Z_:][\w:.-]*)\s*=\s*["']([^"']*)["']/g;
  let match;
  while ((match = attrRegex.exec(tag)) !== null) {
    attrs[match[1].toLowerCase()] = decodeHtml(match[2]);
  }
  return attrs;
}

function getMetaContents(content, names) {
  const wanted = new Set(names.map((name) => String(name).toLowerCase()));
  const values = [];
  const metaRegex = /<meta\b[^>]*>/gi;
  let match;
  while ((match = metaRegex.exec(content)) !== null) {
    const attrs = parseAttributes(match[0]);
    const key = (attrs.property || attrs.name || "").toLowerCase();
    if (!wanted.has(key)) continue;
    if (attrs.content) values.push(attrs.content.trim());
  }
  return values;
}

function pickMeta(content, name) {
  return getMetaContents(content, [name])[0] || null;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function inferCurrencyFromText(raw) {
  const text = String(raw || "");
  if (/€/.test(text)) return "EUR";
  if (/[₽]/.test(text)) return "RUB";
  if (/[₸]/.test(text)) return "KZT";
  if (/£/.test(text)) return "GBP";
  if (/¥/.test(text)) return "JPY";
  if (/\$/.test(text)) return "USD";
  const code = text.match(/\b(USD|EUR|RUB|KZT|GBP|JPY|CNY|TRY|INR|AED|BYN|UAH|PLN|CZK|CHF|SEK|NOK|CAD|AUD|BRL|HKD|SGD)\b/i)?.[1];
  return code ? code.toUpperCase() : null;
}

function toNumber(raw) {
  if (raw == null) return null;
  let str = String(raw).trim();
  if (!str) return null;

  str = str.replace(/[^\d.,-]/g, "");
  if (!str) return null;

  const commaCount = (str.match(/,/g) || []).length;
  const dotCount = (str.match(/\./g) || []).length;

  if (commaCount > 0 && dotCount > 0) {
    if (str.lastIndexOf(",") > str.lastIndexOf(".")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      str = str.replace(/,/g, "");
    }
  } else if (commaCount > 1 && dotCount === 0) {
    const parts = str.split(",");
    const last = parts.pop();
    str = `${parts.join("")}.${last}`;
  } else if (dotCount > 1 && commaCount === 0) {
    const parts = str.split(".");
    const last = parts.pop();
    str = `${parts.join("")}.${last}`;
  } else if (commaCount === 1 && dotCount === 0) {
    str = str.replace(",", ".");
  }

  const numeric = Number(str);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeUrl(url, baseUrl) {
  try {
    const parsed = baseUrl ? new URL(url, baseUrl) : new URL(url);
    return parsed.href;
  } catch {
    return null;
  }
}

function isLikelyBadImage(url) {
  const value = String(url || "").toLowerCase();
  if (value.startsWith("data:")) return true;
  return /(logo|icon|favicon|sprite|placeholder|spacer|pixel|avatar|blank|default-avatar|ico\.|apple-touch-icon|\/icons?\/|\/favicons?\/|\/sprites?\/|\/globalnav\/)/.test(value);
}

function normalizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, " ")
    .trim();
}

function buildTitleTokens(title) {
  const tokens = normalizeToken(title)
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  return tokens.slice(0, 8);
}

function pickBestImage(candidates, pageUrl, title) {
  let host = "";
  try {
    host = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    host = "";
  }
  const titleTokens = buildTitleTokens(title);

  const prepared = candidates
    .map((candidate) => {
      if (typeof candidate === "string") {
        const normalized = normalizeUrl(decodeHtml(candidate.trim()), pageUrl);
        return normalized ? { url: normalized, context: "" } : null;
      }

      const rawUrl = decodeHtml(String(candidate?.url || "").trim());
      const normalized = normalizeUrl(rawUrl, pageUrl);
      if (!normalized) return null;

      return {
        url: normalized,
        context: normalizeToken(candidate?.context || ""),
      };
    })
    .filter(Boolean);

  const dedup = new Map();
  for (const item of prepared) {
    const prev = dedup.get(item.url);
    if (!prev) {
      dedup.set(item.url, item);
    } else if ((item.context || "").length > (prev.context || "").length) {
      dedup.set(item.url, item);
    }
  }

  const cleaned = Array.from(dedup.values());

  if (!cleaned.length) return null;

  const scored = cleaned.map(({ url, context }) => {
    let score = 0;
    let parsedUrl = null;
    try {
      parsedUrl = new URL(url);
    } catch {
      parsedUrl = null;
    }

    if (!isLikelyBadImage(url)) score += 30;
    if (/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(url)) score += 20;
    if (/(product|goods|item|catalog|main|hero|gallery)/i.test(url)) score += 15;
    if (/(_sl\d+_|_ac_|_ul\d+_|_sx\d+_|_sy\d+)/i.test(url)) score += 10;
    if (/(\?|&)w=\d{3,}/i.test(url) || /(\?|&)h=\d{3,}/i.test(url)) score += 10;
    if (/(\?|&)size=\d{3,}/i.test(url) || /\/(c\d{3,4}|wc\d{3,4}|x\d{2,4})\//i.test(url)) score += 8;
    if (/(ozone\.ru|wbstatic\.net|wbbasket\.ru)/i.test(url)) score += 12;
    if (host.includes("ozon") && /ir\.ozone\.ru\/s3\/multimedia-/i.test(url)) score += 40;
    if (host.includes("ozon") && /\/wc\d+\//i.test(url)) {
      const wc = Number(url.match(/\/wc(\d+)\//i)?.[1] || 0);
      if (wc > 0) score += Math.min(35, Math.round(wc / 40));
    }
    if (host.includes("ozon") && /\/(wc1000|wc2000)\//i.test(url)) score += 20;
    if (host.includes("ozon") && /(\/product\/|\/main\/|\/preview\/)/i.test(url)) score += 10;
    if (/\/(logo|icon|favicon)\b/i.test(url)) score -= 40;
    if (host.includes("apple.com") && /(globalnav|social-icons|apple_logo|appleid|favicon|touch-icon)/i.test(url)) score -= 80;
    if (host.includes("apple.com") && /\/images\//i.test(url)) score += 25;
    if (host.includes("apple.com") && /(iphone|ipad|macbook|imac|watch|airpods|vision|hero)/i.test(url)) score += 18;
    if (host.includes("apple.com") && /(apple-card|apple-pay|services|global|share|social)/i.test(url)) score -= 35;
    if (host.includes("apple.com") && /as-images\.apple\.com\/is\//i.test(url)) score += 60;
    if (host.includes("apple.com") && /finish-select/i.test(url)) score += 45;
    if (host.includes("apple.com") && /storeimages\.cdn-apple\.com/i.test(url)) score += 25;
    if (host.includes("apple.com") && parsedUrl) {
      const wid = Number(parsedUrl.searchParams.get("wid") || 0);
      const hei = Number(parsedUrl.searchParams.get("hei") || 0);
      const area = wid * hei;
      if (wid >= 2000) score += 15;
      if (hei >= 1200) score += 10;
      if (area >= 2_000_000) score += 10;
      if (/webp|avif/i.test(parsedUrl.searchParams.get("fmt") || "")) score += 6;
    }
    if (/(\s|^)(logo|icon|placeholder|thumb)(\s|$)/i.test(context)) score -= 20;
    for (const token of titleTokens) {
      if (token && url.toLowerCase().includes(token)) score += 6;
      if (token && context.includes(token)) score += 8;
    }
    if (url.length > 80) score += 5;
    return { url, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.url || null;
}

function pickLargestDynamicImage(html) {
  const dynamicAttr = html.match(/data-a-dynamic-image=["']([^"']+)["']/i)?.[1];
  if (!dynamicAttr) return null;

  try {
    const decoded = dynamicAttr
      .replace(/&quot;/g, "\"")
      .replace(/&amp;/g, "&");
    const parsed = JSON.parse(decoded);
    const entries = Object.entries(parsed || {});
    if (!entries.length) return null;

    entries.sort((a, b) => {
      const aSize = Array.isArray(a[1]) ? (Number(a[1][0] || 0) * Number(a[1][1] || 0)) : 0;
      const bSize = Array.isArray(b[1]) ? (Number(b[1][0] || 0) * Number(b[1][1] || 0)) : 0;
      return bSize - aSize;
    });

    return entries[0][0];
  } catch {
    return null;
  }
}

function pickLargestFromSrcset(raw) {
  const srcset = String(raw || "").trim();
  if (!srcset) return null;
  const candidates = srcset
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const match = part.match(/^(\S+)\s+(\d+)(w|x)$/i);
      if (!match) return { url: part.split(/\s+/)[0], weight: 0 };
      const multiplier = match[3].toLowerCase() === "w" ? 1 : 1000;
      return { url: match[1], weight: Number(match[2] || 0) * multiplier };
    })
    .filter((item) => item.url);
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0]?.url || null;
}

function normalizeCurrency(raw) {
  const value = String(raw || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(value)) return value;
  const symbolMap = {
    "€": "EUR",
    "$": "USD",
    "₸": "KZT",
    "₽": "RUB",
    "£": "GBP",
    "¥": "JPY",
  };
  return symbolMap[value] || null;
}

function normalizePriceValue(raw) {
  if (raw == null) return null;
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return toNumber(raw);
  if (numeric <= 0) return null;
  if (numeric > 1_000_000) return roundMoney(numeric / 100);
  return roundMoney(numeric);
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function walkObject(root, visit, depth = 0) {
  if (depth > 8 || root == null) return;
  visit(root);
  if (Array.isArray(root)) {
    for (const item of root) walkObject(item, visit, depth + 1);
    return;
  }
  if (typeof root === "object") {
    for (const value of Object.values(root)) {
      walkObject(value, visit, depth + 1);
    }
  }
}

function extractUrlCandidatesFromObject(root, domains = []) {
  const found = [];
  walkObject(root, (node) => {
    if (typeof node !== "string") return;
    if (!/^https?:\/\//i.test(node)) return;
    if (!domains.length || domains.some((domain) => node.toLowerCase().includes(domain))) {
      found.push(node);
    }
  });
  return found;
}

function extractFirstTextByKeys(root, keys) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  let result = null;
  walkObject(root, (node) => {
    if (result || !node || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (!wanted.has(key.toLowerCase())) continue;
      const text = String(value || "").trim();
      if (text) {
        result = text;
        return;
      }
    }
  });
  return result;
}

function extractFirstNumberByKeys(root, keys) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  let result = null;
  walkObject(root, (node) => {
    if (result != null || !node || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (!wanted.has(key.toLowerCase())) continue;
      const numeric = normalizePriceValue(value);
      if (numeric != null) {
        result = numeric;
        return;
      }
    }
  });
  return result;
}

function pickTitle(html) {
  const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, rawJson] of jsonLdMatches) {
    try {
      const parsed = JSON.parse(rawJson.trim());
      const objects = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [])];
      for (const obj of objects) {
        const type = String(obj?.["@type"] || "").toLowerCase();
        const name = String(obj?.name || "").trim();
        if ((type.includes("product") || type.includes("productgroup")) && name) {
          return name;
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  const og = pickMeta(html, "og:title");
  if (og) return og;

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1]?.trim() || null;
}

function normalizeAppleTitle(title) {
  let value = String(title || "").trim();
  if (!value) return value;

  // Remove typical storefront verbs/prefixes from localized Apple buy pages.
  value = value
    .replace(/^\s*(koop|buy|kaufen|acheter|compra|comprar|acquista|купить)\s+/i, "")
    .replace(/\s*-\s*apple\s*$/i, "")
    .trim();

  return value;
}

function getJsonLdImageCandidates(html) {
  const images = [];
  const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, rawJson] of jsonLdMatches) {
    try {
      const parsed = JSON.parse(rawJson.trim());
      const objects = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [])];
      for (const obj of objects) {
        const possible = [
          obj?.image,
          obj?.primaryImageOfPage,
          obj?.thumbnailUrl,
          obj?.offers?.image,
          obj?.offers?.[0]?.image,
        ];
        for (const value of possible) {
          if (!value) continue;
          if (typeof value === "string") images.push(value);
          if (Array.isArray(value)) {
            for (const nested of value) {
              if (typeof nested === "string") images.push(nested);
              if (nested?.url) images.push(nested.url);
            }
          } else if (value?.url) {
            images.push(value.url);
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return images;
}

function extractUrlsByRegex(source, regex) {
  const found = [];
  let match;
  while ((match = regex.exec(source)) !== null) {
    if (match[1]) found.push(match[1]);
  }
  return found;
}

function decodeEscapedUrl(url) {
  return String(url || "")
    .replace(/\\\//g, "/")
    .replace(/\\u002F/gi, "/")
    .replace(/\\u003A/gi, ":")
    .replace(/\\u0026/gi, "&");
}

function getScriptContents(html) {
  return [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1] || "");
}

function getOzonImageCandidates(html) {
  const scripts = getScriptContents(html);
  const candidates = [];

  candidates.push(...extractUrlsByRegex(html, /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/gi));
  candidates.push(...extractUrlsByRegex(html, /"coverImage"\s*:\s*"([^"]+)"/gi));
  candidates.push(...extractUrlsByRegex(html, /"preview(?:Image|Img)?"\s*:\s*"([^"]+)"/gi));
  candidates.push(...extractUrlsByRegex(html, /"mainImage(?:Link|Url)?"\s*:\s*"([^"]+)"/gi));
  candidates.push(...extractUrlsByRegex(html, /"image"\s*:\s*"((?:https?:)?\/\/[^"]*ozone\.ru[^"]+)"/gi));
  candidates.push(...extractUrlsByRegex(html, /"(https?:\/\/[^"]*(?:ozone\.ru|cdn\d+\.ozone\.ru|ir\.ozone\.ru|ozonusercontent\.com)[^"]+)"/gi));

  for (const script of scripts) {
    if (!/ozon|ozone/i.test(script)) continue;
    candidates.push(...extractUrlsByRegex(script, /"(https?:\\\/\\\/[^"]*(?:ozone\.ru|cdn\d+\.ozone\.ru|ir\.ozone\.ru|ozonusercontent\.com)[^"]+)"/gi));
    candidates.push(...extractUrlsByRegex(script, /"(https?:\/\/[^"]*(?:ozone\.ru|cdn\d+\.ozone\.ru|ir\.ozone\.ru|ozonusercontent\.com)[^"]+)"/gi));
  }

  return candidates
    .map(decodeEscapedUrl)
    .filter((url) => !/\.(js|css)(\?|$)/i.test(url))
    .filter((url) => !/\/(logo|icon|favicon|sprite)\b/i.test(url));
}

function getWildberriesImageCandidates(html) {
  const scripts = getScriptContents(html);
  const candidates = [];

  candidates.push(...extractUrlsByRegex(html, /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["']/gi));
  candidates.push(...extractUrlsByRegex(html, /"image"\s*:\s*"((?:https?:)?\/\/[^"]*(?:wbstatic\.net|wbbasket\.ru|wildberries\.ru)[^"]+)"/gi));
  candidates.push(...extractUrlsByRegex(html, /"(https?:\/\/[^"]*(?:wbstatic\.net|wbbasket\.ru|wildberries\.ru)[^"]+)"/gi));

  for (const script of scripts) {
    if (!/wildberries|wbstatic|wbbasket/i.test(script)) continue;
    candidates.push(...extractUrlsByRegex(script, /"(https?:\\\/\\\/[^"]*(?:wbstatic\.net|wbbasket\.ru|wildberries\.ru)[^"]+)"/gi));
    candidates.push(...extractUrlsByRegex(script, /"(https?:\/\/[^"]*(?:wbstatic\.net|wbbasket\.ru|wildberries\.ru)[^"]+)"/gi));
  }

  return candidates
    .map(decodeEscapedUrl)
    .filter((url) => !/\.(js|css)(\?|$)/i.test(url));
}

function getDomainSpecificImageCandidates(html, pageUrl) {
  try {
    const host = new URL(pageUrl).hostname.toLowerCase();
    if (host.includes("ozon")) return getOzonImageCandidates(html);
    if (host.includes("wildberries") || host.includes("wb.ru")) return getWildberriesImageCandidates(html);
    if (host.includes("apple.com")) {
      const fromApplePath = extractUrlsByRegex(
        html,
        /"(https?:\/\/[^"]*apple\.com[^"]*\/images\/[^"]+(?:\?[^"]*)?)"/gi,
      );
      const fromAsImages = extractUrlsByRegex(
        html,
        /"(https?:\/\/[^"]*as-images\.apple\.com\/is\/[^"]+)"/gi,
      );
      const fromAsImagesEscaped = extractUrlsByRegex(
        html,
        /"(https?:\\\/\\\/[^"]*as-images\.apple\.com\\\/is\\\/[^"]+)"/gi,
      );
      const fromSrcset = extractUrlsByRegex(
        html,
        /(?:srcset|data-srcset)=["']([^"']+)["']/gi,
      )
        .map((value) => pickLargestFromSrcset(value))
        .filter(Boolean);

      return [
        ...fromApplePath,
        ...fromAsImages,
        ...fromAsImagesEscaped.map(decodeEscapedUrl),
        ...fromSrcset,
      ];
    }
    return [];
  } catch {
    return [];
  }
}

function extractOzonProductPath(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + (parsed.search || "");
    if (!/\/product\//i.test(path)) return null;
    return path;
  } catch {
    return null;
  }
}

function extractWbNmId(url) {
  try {
    const parsed = new URL(url);
    const nmFromQuery = parsed.searchParams.get("nm");
    if (nmFromQuery && /^\d{5,12}$/.test(nmFromQuery)) return nmFromQuery;

    const path = parsed.pathname;
    const wbCatalog = path.match(/\/catalog\/(\d{5,12})\/detail\.aspx/i)?.[1];
    if (wbCatalog) return wbCatalog;

    const genericId = path.match(/(\d{5,12})(?!.*\d)/)?.[1];
    if (genericId) return genericId;
  } catch {
    return null;
  }
  return null;
}

async function fetchOzonApiPreview(url, headers) {
  const productPath = extractOzonProductPath(url);
  if (!productPath) return null;

  const endpoint = `https://www.ozon.ru/api/composer-api.bx/page/json/v2?url=${encodeURIComponent(productPath)}`;
  const response = await fetch(endpoint, { headers });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  if (!payload) return null;

  let title = null;
  let imageUrl = null;
  let targetPrice = null;

  const schemaRaw = payload?.seo?.script?.find?.((item) => String(item?.type || "").includes("ld+json"))?.innerHTML;
  const schema = safeJsonParse(schemaRaw);
  if (schema) {
    const schemaOffers = Array.isArray(schema.offers) ? schema.offers[0] : schema.offers;
    title = String(schema.name || "").trim() || null;
    imageUrl = pickBestImage([...asArray(schema.image), ...(schemaOffers?.image ? asArray(schemaOffers.image) : [])], url, title);
    targetPrice = normalizePriceValue(schemaOffers?.price || schema.price);
  }

  if (!title) {
    title = String(payload?.seo?.title || "").trim() || null;
  }

  if (!title || !imageUrl || targetPrice == null) {
    const widgetStates = payload?.widgetStates || {};
    for (const rawWidget of Object.values(widgetStates)) {
      const widget = typeof rawWidget === "string" ? safeJsonParse(rawWidget) : rawWidget;
      if (!widget) continue;

      if (!title) title = extractFirstTextByKeys(widget, ["title", "name"]);
      if (targetPrice == null) targetPrice = extractFirstNumberByKeys(widget, ["finalPrice", "price", "discountPrice", "cardPrice"]);
      if (!imageUrl) {
        const imageCandidates = extractUrlCandidatesFromObject(widget, ["ozone.ru", "ozonusercontent.com"]);
        imageUrl = pickBestImage(imageCandidates, url, title);
      }
      if (title && imageUrl && targetPrice != null) break;
    }
  }

  return {
    title: title || null,
    imageUrl: imageUrl || null,
    targetPrice: targetPrice ?? null,
    sourceCurrency: "RUB",
  };
}

async function fetchWbApiPreview(url, headers) {
  const nmId = extractWbNmId(url);
  if (!nmId) return null;

  const endpoint = `https://card.wb.ru/cards/detail?appType=1&curr=rub&dest=-1257786&spp=30&nm=${encodeURIComponent(nmId)}`;
  const response = await fetch(endpoint, { headers });
  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  const product = payload?.data?.products?.[0];
  if (!product) return null;

  const title = String(product.name || product.title || "").trim() || null;
  const minorPrice = product.salePriceU ?? product.priceU ?? product.salePrice ?? product.price;
  const targetPrice = normalizePriceValue(minorPrice != null ? Number(minorPrice) / 100 : null);
  const candidates = extractUrlCandidatesFromObject(product, ["wbstatic.net", "wbbasket.ru", "wildberries.ru"]);

  return {
    title,
    imageUrl: pickBestImage(candidates, url, title),
    targetPrice: targetPrice ?? null,
    sourceCurrency: "RUB",
  };
}

function pickImage(html, pageUrl, title) {
  let host = "";
  try {
    host = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    host = "";
  }

  const ogImages = getMetaContents(html, ["og:image", "og:image:url", "og:image:secure_url"]);
  const twitterImages = getMetaContents(html, ["twitter:image", "twitter:image:src"]);
  const productImages = getMetaContents(html, ["product:image", "vk:image"]);

  const landingImageMatch = html.match(/id=["']landingImage["'][^>]+src=["']([^"']+)["']/i);
  const hiResMatch = html.match(/["']data-old-hires["']\s*:\s*["']([^"']+)["']/i);
  const dynamicImage = pickLargestDynamicImage(html);
  const linkImage = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i)?.[1];
  const jsonLdImages = getJsonLdImageCandidates(html);
  const domainSpecific = getDomainSpecificImageCandidates(html, pageUrl);

  const imgCandidates = [];
  const imgRegex = /<img\b[^>]*>/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const attrs = parseAttributes(imgMatch[0]);
    const direct = attrs.src || attrs["data-src"] || attrs["data-original"] || attrs["data-lazy-src"] || attrs["data-image"] || attrs["data-zoom-image"];
    const fromSrcset = pickLargestFromSrcset(attrs.srcset || attrs["data-srcset"]);
    const context = `${attrs.alt || ""} ${attrs.title || ""} ${attrs.class || ""} ${attrs.id || ""}`;
    if (direct) imgCandidates.push({ url: direct, context });
    if (fromSrcset) imgCandidates.push({ url: fromSrcset, context });
  }

  const sourceCandidates = [];
  const sourceRegex = /<source\b[^>]*>/gi;
  let sourceMatch;
  while ((sourceMatch = sourceRegex.exec(html)) !== null) {
    const attrs = parseAttributes(sourceMatch[0]);
    const fromSrcset = pickLargestFromSrcset(attrs.srcset || attrs["data-srcset"]);
    const direct = attrs.src || attrs["data-src"];
    const context = `${attrs.media || ""} ${attrs.class || ""} ${attrs.id || ""}`;
    if (fromSrcset) sourceCandidates.push({ url: fromSrcset, context });
    if (direct) sourceCandidates.push({ url: direct, context });
  }

  const allCandidates = [
    dynamicImage,
    ...ogImages,
    ...twitterImages,
    ...productImages,
    linkImage,
    landingImageMatch?.[1],
    hiResMatch?.[1],
    ...domainSpecific,
    ...jsonLdImages,
    ...imgCandidates,
    ...sourceCandidates,
  ];

  if (host.includes("apple.com")) {
    const applePreferred = allCandidates.filter((candidate) => {
      const raw = typeof candidate === "string" ? candidate : candidate?.url;
      const value = String(raw || "").toLowerCase();
      return (
        /(as-images\.apple\.com\/is\/|storeimages\.cdn-apple\.com|\/shop\/images\/|www\.apple\.com\/.*\/images\/)/i.test(value) &&
        !/(icon|favicon|touch-icon|logo|globalnav|social)/i.test(value)
      );
    });
    if (applePreferred.length > 0) {
      return pickBestImage(applePreferred, pageUrl, title);
    }
  }

  return pickBestImage(
    allCandidates,
    pageUrl,
    title,
  );
}

function pickPrice(html) {
  const directCurrency =
    pickMeta(html, "product:price:currency") ||
    pickMeta(html, "og:price:currency") ||
    pickMeta(html, "price:currency");

  const direct =
    pickMeta(html, "product:price:amount") ||
    pickMeta(html, "og:price:amount") ||
    pickMeta(html, "price");

  const directNumeric = toNumber(direct);
  if (directNumeric != null) {
    return { amount: directNumeric, currency: normalizeCurrency(directCurrency) || inferCurrencyFromText(direct) };
  }

  // Amazon and similar storefronts often keep price in dedicated DOM nodes.
  const amazonIdPatterns = [
    /id=["']priceblock_ourprice["'][^>]*>\s*([^<]+)\s*</i,
    /id=["']priceblock_dealprice["'][^>]*>\s*([^<]+)\s*</i,
    /id=["']priceblock_saleprice["'][^>]*>\s*([^<]+)\s*</i,
    /id=["']price_inside_buybox["'][^>]*>\s*([^<]+)\s*</i,
    /class=["'][^"']*a-offscreen[^"']*["'][^>]*>\s*([^<]+)\s*</i,
  ];
  for (const pattern of amazonIdPatterns) {
    const match = html.match(pattern);
    const numeric = toNumber(match?.[1]);
    if (numeric != null) {
      return { amount: numeric, currency: normalizeCurrency(directCurrency) || inferCurrencyFromText(match?.[1]) };
    }
  }

  const whole = html.match(/class=["'][^"']*a-price-whole[^"']*["'][^>]*>\s*([\d.,\s]+)\s*</i)?.[1];
  const fraction = html.match(/class=["'][^"']*a-price-fraction[^"']*["'][^>]*>\s*([\d.,\s]+)\s*</i)?.[1];
  if (whole) {
    const composed = `${String(whole).replace(/[^\d]/g, "")}.${String(fraction || "00").replace(/[^\d]/g, "").slice(0, 2) || "00"}`;
    const numeric = toNumber(composed);
    if (numeric != null) {
      return { amount: numeric, currency: normalizeCurrency(directCurrency) || inferCurrencyFromText(whole) };
    }
  }

  const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, rawJson] of jsonLdMatches) {
    try {
      const parsed = JSON.parse(rawJson.trim());
      const objects = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [])];
      for (const obj of objects) {
        const offers = Array.isArray(obj?.offers) ? obj.offers[0] : obj?.offers;
        const price = offers?.price || obj?.price;
        const priceCurrency = offers?.priceCurrency || obj?.priceCurrency;
        if (price != null) {
          const numeric = toNumber(price);
          if (numeric != null) {
            return { amount: numeric, currency: normalizeCurrency(priceCurrency) || inferCurrencyFromText(price) };
          }
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return { amount: null, currency: normalizeCurrency(directCurrency) };
}

function inferCurrencyFromUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith(".ru")) return "RUB";
    if (host.endsWith(".kz")) return "KZT";
    if (host.endsWith(".de") || host.endsWith(".fr") || host.endsWith(".it") || host.endsWith(".es") || host.endsWith(".nl")) return "EUR";
    if (host.endsWith(".co.uk")) return "GBP";
    if (host.endsWith(".pl")) return "PLN";
    if (host.endsWith(".ua")) return "UAH";
    if (host.endsWith(".jp")) return "JPY";
    if (host.endsWith(".cn")) return "CNY";
    return "USD";
  } catch {
    return "USD";
  }
}

export async function previewProductByUrl(url) {
  const requestOptions = {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  };

  let response = await fetch(url, requestOptions);

  // Some storefronts return bot-check pages for desktop UA; mobile UA is often less restricted.
  if (response.ok) {
    const probeHtml = await response.text();
    if (/captcha|robot|access denied|verify you are human/i.test(probeHtml)) {
      response = await fetch(url, {
        ...requestOptions,
        headers: {
          ...requestOptions.headers,
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        },
      });
    } else {
  const title = normalizeAppleTitle(pickTitle(probeHtml));
  return {
    title,
    imageUrl: pickImage(probeHtml, url, title),
    ...(() => {
      const price = pickPrice(probeHtml);
      return {
            targetPrice: price.amount,
            sourceCurrency: price.currency || inferCurrencyFromUrl(url),
          };
        })(),
      };
    }
  }

  const fallbackHeaders = requestOptions.headers;
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();

  let apiFallback = null;
  if (host.includes("ozon")) {
    apiFallback = await fetchOzonApiPreview(url, fallbackHeaders).catch(() => null);
  } else if (host.includes("wildberries") || host.includes("wb.ru")) {
    apiFallback = await fetchWbApiPreview(url, fallbackHeaders).catch(() => null);
  }

  if (!response.ok) {
    if (apiFallback?.title || apiFallback?.imageUrl || apiFallback?.targetPrice != null) {
      return {
        title: apiFallback.title,
        imageUrl: apiFallback.imageUrl,
        targetPrice: apiFallback.targetPrice,
        sourceCurrency: apiFallback.sourceCurrency || inferCurrencyFromUrl(url),
      };
    }
    throw new Error("Cannot fetch product page");
  }

  const html = await response.text();
  const title = normalizeAppleTitle(pickTitle(html));
  const genericPrice = pickPrice(html);
  const genericImage = pickImage(html, url, title);

  return {
    title: apiFallback?.title || title,
    imageUrl: apiFallback?.imageUrl || genericImage,
    targetPrice: apiFallback?.targetPrice ?? genericPrice.amount,
    sourceCurrency: apiFallback?.sourceCurrency || genericPrice.currency || inferCurrencyFromUrl(url),
  };
}
