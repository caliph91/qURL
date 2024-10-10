const express = require("express");
const swaggerUi = require("swagger-ui-express");
const morgan = require("morgan");
const crypto = require("crypto");
const { join } = require("path");
const { PrismaClient } = require('@prisma/client');
const { Resolver } = require("dns");

const app = express();
const prisma = new PrismaClient();
const resolver = new Resolver();
resolver.setServers(["94.140.14.15", "94.140.15.16"]);

const PORT = process.env.PORT || 8877;

// Function to generate a random hex string
function generateRandomHex(length) {
  const buffer = crypto.randomBytes(length);
  return buffer.toString("hex").slice(0, length);
}

// Function to validate URL format
function validateUrl(url) {
  const urlPattern = /(http(s)?:\/\/.)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g;
  return urlPattern.test(url);
}

// Middleware setup
app.set("json spaces", 2);
app.use(morgan("dev"));
app.set("trust proxy", true);
app.set("view engine", "ejs");
app.set("views", join(__dirname, "views"));
app.use(express.static(join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(require("./swagger.json")));

// Main route
app.all("/", (req, res) => res.render("index", { req }));

// Blocked route
app.all("/blocked", (req, res) => res.render("blocked"));

// Redirect or block based on path
app.all("/:path", async (req, res, next) => {
  const { path } = req.params;
  try {
    const url = await prisma.url.findFirst({
      where: {
        OR: [
          { path: path },
          { alias: path }
        ]
      }
    });

    if (!url) return next();

    let { hostname } = new URL(url.url);
    if (url.url.includes("www.google.com/url")) {
      const sparam = (new URL(url.url)).searchParams;
      if (sparam.has("url")) hostname = (new URL(sparam.get("url"))).hostname;
    }

    resolver.resolve4(hostname, (err, resp) => {
      if ((err && (err.code === "ENODATA" || err.code === "ENOTFOUND")) || resp.includes("94.140.14.35")) {
        return res.redirect("/blocked");
      }
      if (req.headers.accept) {
        return res.render("redirect", { url: url.url });
      }
      res.redirect(url.url);
    });

  } catch (e) {
    next();
  }
});

// API to create shortened URL
app.get("/api/create", async (req, res) => {
  const { alias, url } = req.query;

  if (!url)
    return res.json({
      success: false,
      error: "'url' parameter is required",
      response: null
    });

  if (!validateUrl(url))
    return res.json({ success: false, error: "Invalid URL", response: null });

  const { hostname } = new URL(url);
  if (hostname === req.get("host"))
    return res.json({ success: false, error: "Can't shorten this URL.", response: null });

  let existingUrl = await prisma.url.findFirst({
    where: { url, alias: null }
  });

  if (existingUrl && !alias)
    return res.json({
      success: true,
      error: null,
      response: {
        url,
        short: `${req.protocol}://${req.get("host")}/${existingUrl.path}`
      }
    });

  let existingAlias = await prisma.url.findFirst({
    where: { alias }
  });

  if (existingAlias && alias)
    return res.json({ success: false, error: "Alias is already in use", response: null });

  let path = alias || generateRandomHex(8);

  await prisma.url.create({
    data: {
      url,
      path: alias ? null : path,
      alias: alias || null
    }
  });

  res.json({
    success: true,
    error: null,
    response: {
      url,
      short: `${req.protocol}://${req.get("host")}/${path}`
    }
  });
});

// API to get status
app.get("/api/status", async (req, res) => {
  const count = await prisma.url.count();
  res.json({ shorten: count });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).render("404", { req });
});

// Start the server
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});
