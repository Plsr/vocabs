import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function triggerDeployment({ webhook, token }) {
  if (!webhook || !token) {
    throw new Error("Set COOLIFY_WEBHOOK and COOLIFY_TOKEN in the production environment secrets.");
  }

  let response;
  try {
    response = await fetch(webhook, {
      method: "GET",
      redirect: "manual",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error("Coolify request failed or timed out. Check the webhook URL and connectivity.");
  }

  if (!response.ok) {
    throw new Error(
      `Coolify returned HTTP ${response.status}. Check the deployment webhook URL and API token; redirects are not deployment success.`,
    );
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error(
      "Coolify did not return JSON. Check that the webhook targets the API, not the dashboard login page.",
    );
  }
  try {
    const body = await response.json();
    if (!body || typeof body !== "object" || body.error || body.errors) {
      throw new Error("Invalid response");
    }
  } catch {
    throw new Error("Coolify returned invalid JSON or an API error; deployment was not confirmed.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  triggerDeployment({
    webhook: process.env.COOLIFY_WEBHOOK,
    token: process.env.COOLIFY_TOKEN,
  })
    .then(() => console.log("Coolify accepted the deployment request."))
    .catch((error) => {
      // Do not log the URL, token, redirect location, or response body.
      console.error(error.message);
      process.exitCode = 1;
    });
}
