import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import unitsRouter from "./units";
import suppliersRouter from "./suppliers";
import customersRouter from "./customers";
import rawMaterialsRouter from "./raw-materials";
import rmReceiptsRouter from "./rm-receipts";
import productsRouter from "./products";
import productionsRouter from "./productions";
import deliveriesRouter from "./deliveries";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import adjustmentsRouter from "./adjustments";
import forecastRouter from "./forecast";
import kassaRouter from "./kassa";
import weeklyPlanRouter from "./weekly-plan";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(unitsRouter);
router.use(suppliersRouter);
router.use(customersRouter);
router.use(rawMaterialsRouter);
router.use(rmReceiptsRouter);
router.use(productsRouter);
router.use(productionsRouter);
router.use(deliveriesRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(adjustmentsRouter);
router.use(forecastRouter);
router.use(kassaRouter);
router.use(weeklyPlanRouter);

export default router;
