import express, {
	NextFunction,
	Request,
	Response,
	Router,
	ErrorRequestHandler,
} from "npm:express@4.18.2";
import format from "npm:pg-format";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

//* connection
const db = new Client(Deno.env.get("DB_CONN_STR"));

//* interfaces

//* models
const selectPrivacyPolicy = async () => {
	const formattedQuery = format(
		`SELECT body FROM privacy_policies
        ORDER BY id DESC
        LIMIT 1
        ;`
	);
	const { rows } = await db.queryObject(formattedQuery);
	return rows[0] as { body: string };
};

//* controllers
const getPrivacyPolicy = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	try {
		const policy = await selectPrivacyPolicy();
		res.status(200).send(policy);
	} catch (err) {
		next(err);
	}
};

//* router
const privacyRouter = Router();

privacyRouter.route("/").get(getPrivacyPolicy);

//* error handlers
const handleCustomError: ErrorRequestHandler = (
	err: ErrorRequestHandler,
	_req: Request,
	res: Response,
	next: NextFunction
) => {
	if (err.status) {
		res.status(err.status).send({ msg: err.msg });
	} else next(err);
};

const handlePsqlErrors: ErrorRequestHandler = (
	err: ErrorRequestHandler,
	_req: Request,
	res: Response,
	next: NextFunction
) => {
	switch (err.code) {
		case "22P02":
		case "23502":
			res.status(400).send({ msg: "bad request" });
			break;
		case "23503":
			res.status(404).send({ msg: "not found" });
			break;
		default:
			next(err);
			break;
	}
};

const handle404 = (_req: Request, res: Response) => {
	res.status(404).send({ msg: "incorrect path - path not found" });
};

const handleServerErrors: ErrorRequestHandler = (
	err: ErrorRequestHandler,
	_req: Request,
	res: Response,
	_next: NextFunction
) => {
	console.log(err);
	res.status(500).send({ msg: "internal server error" });
};

//* listener
const app = express();
app.use(express.json());

app.use("/privacy", privacyRouter);

app.all("*", handle404);

app.use(handlePsqlErrors);
app.use(handleCustomError);
app.use(handleServerErrors);

app.listen(3030);
