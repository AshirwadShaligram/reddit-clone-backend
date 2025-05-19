import express from "express";
import {
  createComment,
  getPostComments,
  updateComment,
  deleteComment,
  getUserComments,
} from "../controller/commentController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply authentication middleware to all comment routes
router.use(protect);

// Comment routes
router.post("/", createComment);
router.get("/post/:postId", getPostComments);
router.get("/user/:userId", getUserComments);
router.put("/:id", updateComment);
router.delete("/:id", deleteComment);

export default router;
