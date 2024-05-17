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
const checkFollows = async (username: string) => {
	const formattedQuery = format(
		`SELECT following FROM users
		WHERE username = '%s'
		;`,
		username
	);
	const { rows } = await db.queryObject(formattedQuery);
	return rows[0] as { following: string[] };
};

const updateFollows = async (username: string, newFollows: string[]) => {
	const formattedQuery = format(
		`UPDATE users
		SET following = '{%s}'
		WHERE username = '%s'
		;`,
		newFollows,
		username
	);
	const { rows } = await db.queryObject(formattedQuery);
	return rows;
};

const selectMatchedUsers = async (username: string) => {
	const formattedQuery = format(
		`SELECT username FROM users
		WHERE username ILIKE '%%%s%%'
		;`,
		username
	);
	const { rows } = await db.queryObject(formattedQuery);
	return rows[0] as { following: string[] };
};

//* controllers
const getFollows = async (req: Request, res: Response, next: NextFunction) => {
	const { username } = req.params;
	try {
		const following = await checkFollows(username);
		res.status(200).send(following);
	} catch (err) {
		next(err);
	}
};

const addOrRemoveFriend = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { new_follow, follow_request } = req.body;
	const { username } = req.params;
	try {
		const { following } = await checkFollows(username);
		if (!following.includes(new_follow) && follow_request) {
			const newFollows = [...following, new_follow];
			await updateFollows(username, newFollows);
			res.status(200).send({
				msg: `${username} is now following ${new_follow}`,
			});
		} else if (following.includes(new_follow) && !follow_request) {
			const newFollows = following.filter((user: string) => {
				return user !== new_follow;
			});

			await updateFollows(username, newFollows);
			res.status(200).send({
				msg: `${username} is no longer following ${new_follow}`,
			});
		} else res.status(400).send({ msg: "User already followed" });
	} catch (err) {
		next(err);
	}
};

const getMatchedUsers = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { username } = req.params;
	try {
		const users = await selectMatchedUsers(username);
		res.status(200).send(users);
	} catch (err) {
		next(err);
	}
};

//* router
const reviewRouter = Router();

reviewRouter.route("/:username").get(getMatchedUsers);

reviewRouter
	.route("/:username/followers")
	.get(getFollows)
	.patch(addOrRemoveFriend);

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

app.use("/users", reviewRouter);

app.all("*", handle404);

app.use(handlePsqlErrors);
app.use(handleCustomError);
app.use(handleServerErrors);

app.listen(3030);
