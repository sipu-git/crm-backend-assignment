import { Router } from "express";
import * as customers from "../controllers/customer.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validateRequest } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import { createCustomerSchema, customersQuerySchema, updateCustomerSchema } from "../validators/customer.validator.js";

const customerRouter = Router();
customerRouter.use(authenticate);

customerRouter.get("/", authorize("customers:read"), validateRequest({ query: customersQuerySchema }), customers.list);
customerRouter.post("/", authorize("customers:create"), validateRequest({ body: createCustomerSchema }), customers.create);
customerRouter.get("/:id", authorize("customers:read"), validateRequest({ params: idParamsSchema }), customers.getById);
customerRouter.patch("/:id", authorize("customers:update"), validateRequest({ params: idParamsSchema, body: updateCustomerSchema }), customers.update);
customerRouter.delete("/:id", authorize("customers:delete"), validateRequest({ params: idParamsSchema }), customers.remove);

export default customerRouter;
