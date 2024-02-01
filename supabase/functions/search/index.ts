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
interface Music {
	music_id: string;
	artist_ids: string[];
	artist_names: string[];
	name: string;
	type: string;
	tracks: string[] | null;
	album_id: string;
	genres: string[] | null;
	preview: string;
	album_img: string;
	release_date: string;
	avg_rating?: number;
}
interface MusicQueries {
	music_id?: string;
	artist_ids?: string;
	genres?: string;
	order?: "ASC" | "DESC";
	p?: string;
	avg_rating?: "true" | "false";
}

//* models
const selectAllMusic = async (
	queries?: MusicQueries,
	all?: boolean
): Promise<Music | Music[]> => {
	const whereMusic_id = queries?.music_id
		? `WHERE music.music_id = '${queries?.music_id}'`
		: ``;

	const whereArtist_ids = queries?.artist_ids
		? `WHERE '${queries?.artist_ids}' = ANY(artist_ids)`
		: ``;

	const whereGenres = queries?.genres
		? `WHERE '${
				queries?.genres.charAt(0).toUpperCase() +
				queries?.genres.slice(1)
		  }' = ANY(genres)`
		: ``;

	const orderBy = queries?.order
		? `release_date ${queries?.order}`
		: `release_date DESC`;

	const pagination =
		queries?.p && !all ? `OFFSET ${parseInt(queries?.p) * 30 - 30}` : ``;

	const limit = !all ? `LIMIT  30` : ``;

	const aggAvgRating =
		queries?.avg_rating === "true"
			? `,  ROUND(AVG(reviews.rating),1) AS avg_rating `
			: ``;

	const groupAvgRating =
		queries?.avg_rating === "true" ? `GROUP BY music.music_id` : ``;

	const joinAvgRating =
		queries?.avg_rating === "true"
			? `FULL JOIN reviews ON music.music_id = reviews.music_id`
			: ``;

	const formattedMusicQuery = format(
		`SELECT music.music_id, artist_ids, artist_names, name, type, tracks, album_id, genres, preview, album_img, release_date %s FROM music
    %s
    %s
    %s
    %s
    %s
    ORDER BY %s
    %s
    %s
    ;`,
		aggAvgRating,
		joinAvgRating,
		whereMusic_id,
		whereArtist_ids,
		whereGenres,
		groupAvgRating,
		orderBy,
		limit,
		pagination
	);

	return db
		.queryObject(formattedMusicQuery)
		.then(({ rows }: { rows: Music[] }) => {
			if (!rows.length) {
				return Promise.reject({ status: 404, msg: "not found" });
			} else if (rows.length === 1) {
				return rows[0];
			}
			return rows;
		});
};

const handleDate = (date: string) => {
	if (date.length > 4) return date;
	if (date.length === 4) return `${date}-01-01`;
};

const insertMusic = async (music: Music | Music[]) => {
	const formattedMusic = Array.isArray(music)
		? music.map((item) => [
				item.music_id,
				`{${item.artist_ids.map((artist_id) => `'${artist_id}'`)}}`,
				`{${item.artist_names.map((artist_name) => `${artist_name}`)}}`,
				item.name,
				item.type,
				item.tracks && `{${item.tracks.map((track) => `${track}`)}}`,
				item.album_id,
				item.preview,
				item.album_img,
				handleDate(item.release_date),
		  ])
		: [
				[
					music.music_id,
					`{${music.artist_ids.map(
						(artist_id) => `'${artist_id}'`
					)}}`,
					`{${music.artist_names.map(
						(artist_name) => `${artist_name}`
					)}}`,
					music.name,
					music.type,
					music.tracks &&
						`{${music.tracks.map((track) => `${track}`)}}`,
					music.album_id,
					music.preview,
					music.album_img,
					handleDate(music.release_date),
				],
		  ];

	const formattedMusicQuery = format(
		`INSERT INTO music
    (music_id, artist_ids, artist_names, name, type, tracks, album_id, preview, album_img, release_date)
    VALUES
    %L
    RETURNING *
    ;`,
		formattedMusic
	);

	const { rows } = await db.queryObject(formattedMusicQuery);

	return rows as Music | Music[];
};

//* controllers
const getSearchedMusic = async (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	const { matchedMusic } = req.body;
	try {
		await db.connect();
		if (matchedMusic) {
			const storedMusic = (await selectAllMusic(
				undefined,
				true
			)) as Music[];
			const storedMusicIds = storedMusic.map((music) => music.music_id);
			const musicOverlap = storedMusic.filter((music) =>
				matchedMusic.some(
					(matched: Music) => matched.music_id === music.music_id
				)
			);
			const musicDifference = matchedMusic.filter(
				(music: Music) => !storedMusicIds.includes(music.music_id)
			);
			if (!musicDifference.length) {
				await db.end();
				res.status(200).send({ music: musicOverlap });
			} else {
				const insertedMusic = await insertMusic(musicDifference);
				await db.end();
				const mergedMusic = Array.isArray(insertedMusic)
					? [...musicOverlap, ...insertedMusic!]
					: [...musicOverlap, insertedMusic!];
				res.status(200).send({ music: mergedMusic });
			}
		}
	} catch (err) {
		next(err);
	}
};

//* router
const searchRouter = Router();

searchRouter.route("/").post(getSearchedMusic);

//* error handlers
const handleCustomError: ErrorRequestHandler = (err, _req, res, next) => {
	if (err.status) {
		res.status(err.status).send({ msg: err.msg });
	} else next(err);
};

const handlePsqlErrors: ErrorRequestHandler = (err, _req, res, next) => {
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

const handleServerErrors: ErrorRequestHandler = (err, _req, res, next) => {
	console.log(err);
	res.status(500).send({ msg: "internal server error" });
};

//* listener
const app = express();
app.use(express.json());

app.use("/api/search", searchRouter);

app.all("*", handle404);

app.use(handlePsqlErrors);
app.use(handleCustomError);
app.use(handleServerErrors);

app.listen(3030);
