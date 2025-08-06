import {type Generated, Kysely, PostgresDialect} from "kysely";
import * as pg from "pg";

export interface ProxyTable {
    id: Generated<number>;
    name: string;
    url: string;
    domain: string;
    login: string;
    password: string;
}

export interface Database {
    proxy: ProxyTable;
}

export let pool: pg.Pool, dialect: PostgresDialect, db: Kysely<Database>;

export function connect(host: string, port: number, user: string, password: string, database: string) {
    pool = new pg.Pool({host, port, user, password, database});
    dialect = new PostgresDialect({pool});
    db = new Kysely<Database>({dialect});
}

export async function setupDB() {
    try {
        await db.schema.createTable("proxy")
            .addColumn("id", "serial", cb => cb.primaryKey().unique())
            .addColumn("name", "text", cb => cb.notNull())
            .addColumn("url", "text", cb => cb.notNull())
            .addColumn("domain", "text", cb => cb.notNull())
            .addColumn("login", "text", cb => cb.notNull())
            .addColumn("password", "text", cb => cb.notNull()).execute();
    } catch (error) {}
}

export async function setup(host: string, port: number, user: string, password: string, database: string) {
    connect(host, port, user, password, database);
    await setupDB();
}

export async function setupEnv() {
    await setup(process.env.DB_HOST ?? "localhost", Number(process.env.DB_PORT ?? 5432), process.env.DB_USER ?? "postgres", process.env.DB_PASSWORD ?? "", process.env.DB_NAME ?? "postgres");
}