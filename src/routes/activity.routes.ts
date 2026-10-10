import { Router } from "express";
import * as activities from "../controllers/activity.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validateRequest } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import { activitiesQuerySchema, createActivitySchema, updateActivitySchema } from "../validators/activity.validator.js";

const activityRouter = Router();
activityRouter.use(authenticate);

activityRouter.get("/", authorize("activities:read"), validateRequest({ query: activitiesQuerySchema }), activities.list);
activityRouter.post("/", authorize("activities:create"), validateRequest({ body: createActivitySchema }), activities.create);
activityRouter.get("/:id", authorize("activities:read"), validateRequest({ params: idParamsSchema }), activities.getById);
activityRouter.patch("/:id", authorize("activities:update"), validateRequest({ params: idParamsSchema, body: updateActivitySchema }), activities.update);
activityRouter.patch("/:id/complete", authorize("activities:complete"), validateRequest({ params: idParamsSchema }), activities.complete);
activityRouter.delete("/:id", authorize("activities:delete"), validateRequest({ params: idParamsSchema }), activities.remove);

export default activityRouter;
