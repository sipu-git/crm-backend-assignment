import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as auth from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateRequest } from "../middleware/validate.js";
import { authorize } from "../middleware/authorize.js";
import { registerSchema, loginSchema } from "../validators/auth.validator.js";

const authRouter = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Try again later." },
});

authRouter.post("/register", authLimiter, validateRequest({ body: registerSchema }), auth.register);
authRouter.post("/login", authLimiter, validateRequest({ body: loginSchema }), auth.login);
authRouter.post("/refresh", authLimiter, auth.refresh);
authRouter.post("/logout", authenticate, authorize("auth:logout"), auth.logout);
authRouter.get("/me", authenticate, authorize("auth:read"), auth.currentUser);

export default authRouter;
