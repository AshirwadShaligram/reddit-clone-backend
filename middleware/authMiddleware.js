import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
  try {
    // Skip protection for refresh endpoint
    if (req.path === "/api/auth/refresh") {
      return next();
    }

    // Token extraction
    let token;
    if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token || token === "loggedout") {
      return res.status(401).json({
        status: "fail",
        message: "Please log in to access this resource",
      });
    }

    // Token verification
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fresh user data fetch
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        userName: true,
        email: true,
        createdAt: true,
        isActive: true,
      },
    });

    if (!currentUser || !currentUser.isActive) {
      return res.status(401).json({
        status: "fail",
        message: "User account is inactive or deleted",
      });
    }

    // Attach fresh user data to request
    req.user = currentUser;
    req.userId = currentUser.id;
    next();
  } catch (err) {
    // Handle refresh token flow
    if (err.name === "TokenExpiredError" && req.path !== "/api/auth/refresh") {
      return res.status(401).json({
        status: "fail",
        message: "Session expired. Attempting to refresh...",
        shouldRefresh: true,
      });
    }

    console.error(`Authentication error [${req.path}]:`, err);
    res.status(401).json({
      status: "fail",
      message: "Authentication failed",
    });
  }
};

export default protect;
