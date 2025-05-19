import express from "express";
import {
  castVote,
  getUserVote,
  deleteVote,
} from "../controller/voteController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication middleware to all vote routes
router.use(protect);

// Vote routes
router.post("/", castVote);
router.get("/:postId", getUserVote);
router.delete("/:postId", deleteVote);

export default router;
