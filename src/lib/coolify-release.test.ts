import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, expect, test } from "vitest";
import { triggerDeployment } from "../../scripts/coolify-release.mjs";

let server: Server;
afterEach(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function endpoint(status: number, body: string, contentType = "application/json") {
  server = createServer((request, response) => {
    expect(request.headers.authorization).toBe("Bearer test-token");
    expect(request.headers.accept).toBe("application/json");
    response.writeHead(status, { "Content-Type": contentType, Location: "/login" });
    response.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    webhook: `http://127.0.0.1:${(server.address() as AddressInfo).port}/deploy`,
    token: "test-token",
  };
}

test("rejects the login redirect that curl --fail previously accepted", async () => {
  const config = await endpoint(302, "<html>Redirecting to login</html>", "text/html");
  await expect(triggerDeployment(config)).rejects.toThrow("HTTP 302");
});

test("rejects an HTML login page even with HTTP 200", async () => {
  const config = await endpoint(200, "<html>Login</html>", "text/html");
  await expect(triggerDeployment(config)).rejects.toThrow("JSON");
});

test.each([401, 403, 500])("rejects HTTP %s", async (status) => {
  const config = await endpoint(status, '{"message":"Rejected"}');
  await expect(triggerDeployment(config)).rejects.toThrow(`HTTP ${status}`);
});

test("accepts a successful API response", async () => {
  const config = await endpoint(200, '{"deployments":[{"deployment_uuid":"example"}]}');
  await expect(triggerDeployment(config)).resolves.toBeUndefined();
});

test("rejects invalid JSON", async () => {
  const config = await endpoint(200, "not json");
  await expect(triggerDeployment(config)).rejects.toThrow("JSON");
});

test("rejects missing secrets before sending a request", async () => {
  await expect(triggerDeployment({ webhook: "", token: "" })).rejects.toThrow("COOLIFY_WEBHOOK");
});
