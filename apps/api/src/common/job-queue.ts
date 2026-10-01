import { JobsOptions, Queue } from "bullmq";
import { redisApiOptions } from "@buzon-sol/domain";

/**
 * Frontera con BullMQ/Redis: el resto de la API no conoce conexiones ni colas. Se llama siempre DESPUÉS de confirmar
 * en MySQL (nunca dentro de una transacción); MySQL y Redis no son atómicos entre sí, de modo que cada llamador
 * decide qué hacer si esto falla (dejar `pending` para la recuperación del worker o marcar el estado como fallido).
 */
export async function addJob<T>(queueName: string, jobName: string, data: T, options: JobsOptions): Promise<void> {
  const queue = new Queue<T>(queueName, { connection: redisApiOptions() });
  try {
    await queue.add(jobName as never, data as never, options);
  } finally {
    await queue.close();
  }
}

/** Comprobación de alcance para readiness: responde o falla pronto (`redisApiOptions` no reintenta ni encola offline). */
export async function pingRedis(): Promise<void> {
  const queue = new Queue("readiness", { connection: redisApiOptions() });
  try {
    await ((await queue.client) as unknown as { ping(): Promise<string> }).ping();
  } finally {
    await queue.close();
  }
}
