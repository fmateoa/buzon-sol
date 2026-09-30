/** Worker process boundary. Jobs are added only after the SUNAT validation gates. */
export async function main(): Promise<void> {
  if (process.env.ENABLE_SUNAT_JOBS === "true") {
    throw new Error("SUNAT jobs are not implemented or validated");
  }
  process.stdout.write("Worker idle: SUNAT jobs disabled\n");
  await new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}

if (process.argv[1]?.endsWith("main.ts")) void main();
