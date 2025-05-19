import express from "express";
import {
  signup,
  login,
  logout,
  refreshToken,
  getCurrentUser,
} from "../controller/authController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh", refreshToken);

// Protected route example
router.get("/me", protect, getCurrentUser);

export default router;
