import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); });

it.each([false, true])('ignores a consent read arriving after a newer change (initial=%s)', async (initial) => {
  vi.resetModules();
  let finishRead!: (response: Response) => void;
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ enabled: initial }))
    .mockReturnValueOnce(new Promise<Response>((resolve) => { finishRead = resolve; }))
    .mockResolvedValueOnce(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  const telemetry = await import('../src/services/telemetry');
  await telemetry.getTelemetryPreference();
  const oldRead = telemetry.getTelemetryPreference();
  await telemetry.setTelemetryPreference(!initial);
  finishRead(Response.json({ enabled: initial }));
  expect(await oldRead).toBe(!initial);
});
