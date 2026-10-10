import { Router } from "express";
import * as deals from "../controllers/deal.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validateRequest } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import { changeDealStageSchema, createDealSchema, dealsQuerySchema, updateDealSchema } from "../validators/deal.validator.js";

const dealRouter = Router();
dealRouter.use(authenticate);

dealRouter.get("/", authorize("deals:read"), validateRequest({ query: dealsQuerySchema }), deals.list);
dealRouter.post("/", authorize("deals:create"), validateRequest({ body: createDealSchema }), deals.create);
dealRouter.get("/:id", authorize("deals:read"), validateRequest({ params: idParamsSchema }), deals.getById);
dealRouter.patch("/:id", authorize("deals:update"), validateRequest({ params: idParamsSchema, body: updateDealSchema }), deals.update);
dealRouter.patch("/:id/stage", authorize("deals:update_status"), validateRequest({ params: idParamsSchema, body: changeDealStageSchema }), deals.stage);
dealRouter.delete("/:id", authorize("deals:delete"), validateRequest({ params: idParamsSchema }), deals.remove);

export default dealRouter;
