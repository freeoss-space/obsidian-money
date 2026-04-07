import initSqlJs from "sql.js";
import { Database } from "./database";

/**
 * Initialize a sql.js-backed Database with an explicit WASM binary.
 *
 * Passing `wasmBinary` avoids the default file-system / network lookup
 * that fails when the plugin is loaded by BRAT (which only downloads
 * main.js, manifest.json and styles.css).
 *
 * @param wasmBinary - The raw sql-wasm.wasm bytes.
 * @param existingData - Optional previously-exported database bytes to restore.
 */
export async function initSqlDatabase(
	wasmBinary: BufferSource,
	existingData?: ArrayLike<number>,
): Promise<Database> {
	const SQL = await initSqlJs({ wasmBinary });
	const sqlDb = existingData
		? new SQL.Database(existingData)
		: new SQL.Database();
	return new Database(sqlDb);
}
