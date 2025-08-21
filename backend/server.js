const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");
require("dotenv").config();

const authRoutes = require("./routes/auth");
const kbRoutes = require("./routes/KB");
const ticketRoutes = require("./routes/tickets");
const agentRoutes = require("./routes/agent");
const configRoutes = require("./routes/config");
const { auditRouter } = require("./routes/audit");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: "Too many authentication attempts",
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

// Logging middleware
app.use(
  morgan("combined", {
    stream: {
      write: (message) => {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "info",
            message: message.trim(),
            service: "helpdesk-api",
          })
        );
      },
    },
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const traceId = req.headers["x-trace-id"] || require("crypto").randomUUID();
  req.traceId = traceId;

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        traceId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get("User-Agent"),
      })
    );
  });

  next();
});

// Health checks
app.get("/healthz", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/readyz", async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({
      status: "ready",
      mongodb: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "not ready",
      mongodb: "disconnected",
      error: error.message,
    });
  }
});

// Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/kb", generalLimiter, kbRoutes);
app.use("/api/tickets", generalLimiter, ticketRoutes);
app.use("/api/agent", generalLimiter, agentRoutes);
app.use("/api/config", generalLimiter, configRoutes);
app.use("/api/audit", generalLimiter, auditRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      traceId: req.traceId,
      error: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    })
  );

  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
    traceId: req.traceId,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Database connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://localhost:27017/helpdesk", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "info",
        message: "Connected to MongoDB",
        service: "helpdesk-api",
      })
    );
  })
  .catch((err) => {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "MongoDB connection failed",
        error: err.message,
        service: "helpdesk-api",
      })
    );
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  await mongoose.connection.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      message: `Server running on port ${PORT}`,
      service: "helpdesk-api",
    })
  );
});

module.exports = app;
