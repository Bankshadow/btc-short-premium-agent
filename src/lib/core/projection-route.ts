import {
  projectionApiFail,
  projectionApiOk,
  PROJECTION_FALLBACK_ERROR,
} from "./projection-api-response";

export async function runProjectionRoute<T>(
  section: string,
  fallback: T,
  build: () => Promise<T> | T,
) {
  try {
    const data = await build();
    return projectionApiOk(data);
  } catch (err) {
    return projectionApiFail(
      fallback,
      err instanceof Error ? err.message : `${section} projection failed`,
      PROJECTION_FALLBACK_ERROR.code,
    );
  }
}
