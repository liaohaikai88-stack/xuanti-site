import { ensureBootstrapped } from "../src/lib/bootstrap.ts";

await ensureBootstrapped();
console.log("数据库已就绪");
