import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Config
const { JWT_SECRET, JWT_EXPIRES_IN, REFRESH_TOKEN_EXPIRES_IN, NODE_ENV } =
  process.env;

// Helper functions
const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN, // Now properly formatted as "15m"
  });
};

const generateRefreshToken = (userId) => {
  // Add current timestamp and random string to ensure uniqueness
  const uniqueData = {
    userId,
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(2, 15),
  };
  return jwt.sign(uniqueData, JWT_SECRET, { expiresIn: "7d" });
};

// Helper function to convert timespan strings to milliseconds
const parseTimespanToMs = (timespan) => {
  const match = timespan.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000; // default fallback: 15 minutes

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
};

const setCookies = (res, accessToken, refreshToken) => {
  const isProduction = NODE_ENV === "production";

  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: parseTimespanToMs(JWT_EXPIRES_IN), // Convert "15m" to milliseconds
    path: "/", // Ensure cookie is available across all paths
  });

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: parseTimespanToMs(REFRESH_TOKEN_EXPIRES_IN), // Convert "7d" to milliseconds
    path: "/api/auth/refresh", // Restrict refresh token to refresh endpoint only
  });
};

// Signup
const signup = async (req, res) => {
  try {
    const { userName, email, password } = req.body;

    // Validate input
    if (!userName || !email || !password) {
      return res
        .status(400)
        .json({ error: "userName, email, and password are required" });
    }

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ userName }, { email }] },
    });

    if (existingUser) {
      return res
        .status(409)
        .json({ error: "User with this userName or email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        userName,
        email,
        password: hashedPassword,
        isActive: true,
      },
      select: {
        id: true,
        userName: true,
        email: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      },
    });

    // Set cookies
    setCookies(res, accessToken, refreshToken);

    res.status(201).json({
      user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { userName, password } = req.body;

    // Validate input
    if (!userName || !password) {
      return res
        .status(400)
        .json({ error: "userName and password are required" });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { userName },
      select: {
        id: true,
        userName: true,
        email: true,
        password: true,
        isActive: true,
        communities: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
    });

    // Check user exists and is active
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    // Store refresh token and update last login
    await prisma.$transaction([
      prisma.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      }),
    ]);

    // Set cookies
    setCookies(res, accessToken, refreshToken);

    // Remove sensitive data
    delete user.password;

    res.json({
      user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Logout
const logout = async (req, res) => {
  const isProduction = NODE_ENV === "production";

  try {
    const { refreshToken } = req.cookies;

    // CLear cookies with same options they were set with in setCookies-
    res.clearCookie("accessTokne", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      path: "/",
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      path: "/api/auth/refresh",
    });

    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: {
          token: refreshToken,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("logout error: ", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Refresh Token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: oldRefreshToken } = req.cookies;

    if (!oldRefreshToken) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    // Verify token
    let payload;
    try {
      payload = jwt.verify(oldRefreshToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Find token in database
    const tokenRecord = await prisma.refreshToken.findFirst({
      where: {
        token: oldRefreshToken,
        userId: payload.userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!tokenRecord) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // Check if user is still active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        userName: true,
        email: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(payload.userId);

    // Modified part: Handle refresh token creation with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    let newRefreshToken;
    let success = false;

    while (attempts < maxAttempts && !success) {
      try {
        // Generate token with additional uniqueness factors
        newRefreshToken = jwt.sign(
          {
            userId: payload.userId,
            timestamp: Date.now(),
            random: Math.random().toString(36).substring(2, 15),
          },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        // Try to execute the transaction
        await prisma.$transaction([
          prisma.refreshToken.update({
            where: { id: tokenRecord.id },
            data: { revokedAt: new Date() },
          }),
          prisma.refreshToken.create({
            data: {
              token: newRefreshToken,
              userId: payload.userId,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          }),
        ]);

        success = true;
      } catch (error) {
        if (error.code === "P2002" && error.meta?.target?.includes("token")) {
          attempts++;
          console.log(
            `Token collision detected, retrying (${attempts}/${maxAttempts})...`
          );
        } else {
          throw error;
        }
      }
    }

    if (!success) {
      return res.status(500).json({ error: "Failed to generate unique token" });
    }

    // Set new cookies
    setCookies(res, newAccessToken, newRefreshToken);

    // Return user data
    delete user.isActive;

    res.json({
      user,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
// Get current user
const getCurrentUser = async (req, res) => {
  try {
    // The auth middleware will have already verified the token and added the user ID
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userName: true,
        email: true,
        createdAt: true,
        lastLogin: true,
        isActive: true,
        communities: {
          select: {
            id: true,
            name: true,
            logo: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export { signup, login, logout, refreshToken, getCurrentUser };
