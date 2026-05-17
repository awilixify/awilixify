import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import dotenv from "dotenv";

const RawEnvConfigSchema = Type.Object({
	HOST: Type.String({ minLength: 1 }),
	PORT: Type.Integer({ minimum: 1, maximum: 65535 }),
	CATS_HEARTBEAT_CRON_SECONDS: Type.Integer({ minimum: 1 }),
	REDIS_HOST: Type.String(),
	REDIS_PORT: Type.Integer(),
});

type AppConfig = {
	host: string;
	port: number;
	heartbeatCron: number;
	redisHost: string;
	redisPort: number;
};

type RawEnvConfig = Static<typeof RawEnvConfigSchema>;

export class ConfigService {
	private config?: AppConfig;

	get(): AppConfig;
	get<TKey extends keyof AppConfig>(key: TKey): AppConfig[TKey];
	get<TKey extends keyof AppConfig>(key?: TKey) {
		if (!this.config) {
			throw new Error("ConfigService was used before initialization");
		}

		return key === undefined ? this.config : this.config[key];
	}

	init() {
		const { parsed } = dotenv.config();

		this.config = this.mapRawEnvToAppConfig(
			this.validateRawEnvConfig(Value.Convert(RawEnvConfigSchema, parsed)),
		);
	}

	private validateRawEnvConfig(raw: unknown): RawEnvConfig {
		if (Value.Check(RawEnvConfigSchema, raw)) return raw;

		const errors = [...Value.Errors(RawEnvConfigSchema, raw)]
			.map((error) => `${error.path}: ${error.message}`)
			.join("\n");

		throw new Error(`Invalid environment config:\n${errors}`);
	}

	private mapRawEnvToAppConfig(raw: RawEnvConfig): AppConfig {
		return {
			host: raw.HOST,
			port: raw.PORT,
			heartbeatCron: raw.CATS_HEARTBEAT_CRON_SECONDS,
			redisHost: raw.REDIS_HOST,
			redisPort: raw.REDIS_PORT,
		};
	}
}
