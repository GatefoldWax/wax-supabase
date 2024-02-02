import express, { NextFunction, Request, Response, Router } from 'npm:express@4.18.2'

//* controller
const healthCheck =  (_req: Request, res: Response, _next: NextFunction): void => {
res.status(200).send({msg: "ok"})
}

//* router
const apiRouter = Router();
apiRouter.route("/").get(healthCheck);

//* listener
const app = express();
app.use(express.json());
app.use("/api", apiRouter);

app.listen(3030)