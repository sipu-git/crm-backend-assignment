import { Router } from "express";
import * as users from "../controllers/user.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validateRequest } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import { adminCreateUserSchema, updateUserSchema, userStatusSchema, usersQuerySchema } from "../validators/user.validator.js";

const userRouter = Router();
userRouter.use(authenticate);

userRouter.get("/", authorize("users:read"), validateRequest({ query: usersQuerySchema }), users.list);
userRouter.get("/:id", authorize("users:read"), validateRequest({ params: idParamsSchema }), users.getById);
userRouter.post("/", authorize("users:create"), validateRequest({ body: adminCreateUserSchema }), users.create);
userRouter.patch("/:id", authorize("users:update"), validateRequest({ params: idParamsSchema, body: updateUserSchema }), users.update);
userRouter.patch("/:id/status", authorize("users:update"), validateRequest({ params: idParamsSchema, body: userStatusSchema }), users.update);
userRouter.delete("/:id", authorize("users:deactivate"), validateRequest({ params: idParamsSchema }), users.deactivate);

export default userRouter;
