import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { createAppServer, errorPageHtml, escapeHtml } from "../index.js";

let server;
let base;
let port;

beforeAll(async () => {
  server = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

/** A request sent exactly as given, without the URL normalisation fetch adds. */
function rawRequest(rawPath) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      { host: "127.0.0.1", port, path: rawPath, method: "GET" },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () =>
          resolve({ status: response.statusCode, headers: response.headers, body }),
        );
      },
    );
    request.on("error", reject);
    request.end();
  });
}

describe("the development server", () => {
  it("serves the scroll world at /", async () => {
    const response = await fetch(`${base}/`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("The print shop");
    expect(html).toContain('src="/world/engine.js"');
    expect(html).toContain("Juan Felipe");
  });

  it("serves the portfolio page at /home", async () => {
    const response = await fetch(`${base}/home`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("Websites, presentations and small tools");
    expect(html).toContain('id="experience"');
    expect(html).toContain('src="/bar.js"');
  });

  it("serves the school work at /school", async () => {
    const response = await fetch(`${base}/school`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("EpyTodo");
    expect(html).toContain("Tardis");
  });

  it("serves the prices and the thank you page", async () => {
    const prices = await fetch(`${base}/services`);
    expect(prices.status).toBe(200);
    expect(await prices.text()).toContain("€500");

    const thanks = await fetch(`${base}/thanks`);
    expect(thanks.status).toBe(200);
    expect(await thanks.text()).toContain("Thank you");
  });

  it("serves the stylesheet with the right content type", async () => {
    const response = await fetch(`${base}/style.css`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/css");
    expect(await response.text()).toContain("--accent");
  });

  it("serves the client sites under /projects/, with and without the extension", async () => {
    for (const project of ["promptops-ai", "omniprompt-marketing"]) {
      for (const pathname of [`/projects/${project}/`, `/projects/${project}/index.html`]) {
        const response = await fetch(`${base}${pathname}`);
        expect(response.status, pathname).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/html");
      }

      for (const pathname of [`/projects/${project}/pitch`, `/projects/${project}/pitch.html`]) {
        const response = await fetch(`${base}${pathname}`);
        expect(response.status, pathname).toBe(200);
      }
    }
  });

  it("serves the business plans under /docs/", async () => {
    const response = await fetch(`${base}/docs/ai_business_plan.md`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
  });

  it("redirects a folder to the same address with a trailing slash", async () => {
    const response = await fetch(`${base}/projects/promptops-ai`, { redirect: "manual" });

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe("/projects/promptops-ai/");
  });

  it("ignores query strings", async () => {
    const response = await fetch(`${base}/?utm_source=email`);

    expect(response.status).toBe(200);
  });

  it("answers a missing page with a friendly 404", async () => {
    const response = await fetch(`${base}/no-such-page`);

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("isn&#39;t here");
    expect(html).toContain("[ back to the portfolio ]");
    expect(html).toContain("/no-such-page");
  });

  it("never lets a hostile path turn into script on the 404 page", async () => {
    const response = await rawRequest("/%3Cscript%3Ealert(1)%3C/script%3E");

    expect(response.status).toBe(404);
    expect(response.body).not.toContain("<script>");
    expect(response.body).toContain("[ back to the portfolio ]");
  });

  it("escapes every character that could start a tag", () => {
    expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
  });

  it("escapes the text it puts on an error page", () => {
    const page = errorPageHtml({ heading: 'a "b" & c', message: "<b>bold</b>", detail: "/<x>" });

    expect(page).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(page).toContain("a &quot;b&quot; &amp; c");
    expect(page).toContain("/&lt;x&gt;");
  });

  it("refuses request methods other than GET and HEAD", async () => {
    const response = await fetch(`${base}/`, { method: "POST" });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET, HEAD");
  });

  it("answers HEAD with headers but no body", async () => {
    const response = await fetch(`${base}/style.css`, { method: "HEAD" });

    expect(response.status).toBe(200);
    expect(Number(response.headers.get("content-length"))).toBeGreaterThan(0);
    expect(await response.text()).toBe("");
  });

  it("does not let a URL climb out of the folders it serves", async () => {
    const attempts = [
      "/%2e%2e/%2e%2e/%2e%2e/etc/passwd",
      "/%2e%2e/promptops-ai/README.md",
      "/projects/promptops-ai/%2e%2e/%2e%2e/%2e%2e/etc/passwd",
      "/docs/ai_business_plan.md/%2e%2e/%2e%2e/etc/passwd",
      "/../../../../etc/passwd",
    ];

    for (const attempt of attempts) {
      const response = await rawRequest(attempt);
      expect([403, 404], attempt).toContain(response.status);
      expect(response.body, attempt).not.toContain("root:x:");
      expect(response.body, attempt).not.toContain("# Business");
    }
  });

  it("refuses a climb hidden behind encoded separators", async () => {
    for (const attempt of [
      "/%2e%2e%2findex.js",
      "/projects/promptops-ai/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    ]) {
      const response = await rawRequest(attempt);
      expect(response.status, attempt).toBe(403);
      expect(response.body, attempt).not.toContain("root:x:");
    }
  });

  it("keeps serving after a bad request", async () => {
    await rawRequest("/%zz");
    const response = await fetch(`${base}/`);

    expect(response.status).toBe(200);
  });
});
