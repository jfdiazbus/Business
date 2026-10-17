import { describe, expect, it } from "vitest";
import worker, { slugify, validatePost } from "../worker.js";

function makeDb() {
  const posts = [];
  const attempts = [];
  return {
    posts,
    attempts,
    prepare(query) {
      let values = [];
      return {
        bind(...bound) {
          values = bound;
          return this;
        },
        async all() {
          if (query.includes("WHERE status = 'published'")) {
            return { results: posts.filter((post) => post.status === "published") };
          }
          return { results: [...posts] };
        },
        async first() {
          if (query.includes("COUNT(*) AS attempts")) {
            return {
              attempts: attempts.filter(
                ([address, time]) => address === values[0] && time >= values[1],
              ).length,
            };
          }
          if (query.includes("created_at, published_at")) {
            const post = posts.find((item) => item.id === values[0]);
            return post ? { created_at: post.created_at, published_at: post.published_at } : null;
          }
          if (query.includes("status = 'published'")) {
            return (
              posts.find((post) => post.slug === values[0] && post.status === "published") || null
            );
          }
          return posts.find((post) => post.id === values[0]) || null;
        },
        async run() {
          if (query.startsWith("DELETE FROM blog_login_attempts")) {
            for (let i = attempts.length - 1; i >= 0; i -= 1) {
              if (attempts[i][1] < values[0]) attempts.splice(i, 1);
            }
            return { meta: { changes: 0 } };
          }
          if (query.startsWith("INSERT INTO blog_login_attempts")) {
            attempts.push(values);
            return { meta: { changes: 1 } };
          }
          if (query.trimStart().startsWith("INSERT INTO blog_posts")) {
            const [
              id,
              slug,
              title,
              excerpt,
              status,
              template,
              cover_key,
              blocks_json,
              created_at,
              updated_at,
              published_at,
            ] = values;
            const previous = posts.findIndex((post) => post.id === id);
            const record = {
              id,
              slug,
              title,
              excerpt,
              status,
              template,
              cover_key,
              blocks_json,
              created_at,
              updated_at,
              published_at,
            };
            if (previous >= 0) posts[previous] = record;
            else posts.push(record);
            return { meta: { changes: 1 } };
          }
          if (query.trimStart().startsWith("DELETE FROM blog_posts")) {
            const index = posts.findIndex((post) => post.slug === values[0]);
            if (index >= 0) posts.splice(index, 1);
            return { meta: { changes: index >= 0 ? 1 : 0 } };
          }
          return { meta: { changes: 0 } };
        },
      };
    },
  };
}

const responseJson = (response) => response.json();
const request = (url, method = "GET", body, headers = {}) =>
  new Request(`https://portfolio.test${url}`, {
    method,
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });

async function signedIn(env) {
  const response = await worker.fetch(
    request(
      "/api/blog/admin/login",
      "POST",
      { password: env.BLOG_ADMIN_PASSWORD },
      { Origin: "https://portfolio.test" },
    ),
    env,
  );
  const cookie = response.headers.get("Set-Cookie").split(";")[0];
  return cookie;
}

function makeEnv(extra = {}) {
  return {
    DB: makeDb(),
    ASSETS: { fetch: async (request) => new Response(new URL(request.url).pathname) },
    BLOG_ADMIN_PASSWORD: "correct horse battery staple, kept outside source",
    BLOG_SESSION_SECRET: "a different signing secret kept outside source and longer than 32 bytes",
    ...extra,
  };
}

describe("blog data", () => {
  it("makes readable addresses from titles", () => {
    expect(slugify("A Note from the Print Shop")).toBe("a-note-from-the-print-shop");
    expect(slugify("Été à Paris")).toBe("ete-a-paris");
    expect(slugify("  Lots   of spaces! ")).toBe("lots-of-spaces");
  });

  it("validates the editable blocks, including written two column sections", () => {
    const post = validatePost({
      title: "How the page came together",
      status: "published",
      blocks: [
        { type: "paragraph", text: "The introduction." },
        {
          type: "columns",
          columns: [
            { heading: "The brief", text: "A clear, small job." },
            { heading: "The result", text: "A page that loads quickly." },
          ],
        },
      ],
    });

    expect(post.slug).toBe("how-the-page-came-together");
    expect(post.blocks[1].columns).toHaveLength(2);
  });

  it("rejects unsafe slugs, external media URLs, and unknown block types", () => {
    expect(() => validatePost({ title: "A title", slug: "../admin", blocks: [] })).toThrow();
    expect(() =>
      validatePost({ title: "A title", blocks: [{ type: "embed", html: "<script>" }] }),
    ).toThrow();
    expect(() =>
      validatePost({
        title: "A title",
        blocks: [{ type: "image", key: "https://other.site/x.svg", alt: "x" }],
      }),
    ).toThrow();
    expect(() =>
      validatePost({
        title: "A title",
        blocks: [{ type: "columns", columns: [{ text: "only one" }] }],
      }),
    ).toThrow();
  });
});

describe("the public blog API", () => {
  it("lists published posts without draft content", async () => {
    const env = makeEnv();
    env.DB.posts.push(
      {
        id: "p1",
        slug: "ready",
        title: "Ready",
        excerpt: "Public",
        status: "published",
        published_at: "2026-10-17",
      },
      {
        id: "p2",
        slug: "not-ready",
        title: "Not ready",
        excerpt: "Private",
        status: "draft",
        published_at: null,
      },
    );

    const response = await worker.fetch(request("/api/blog/posts"), env);
    const result = await responseJson(response);

    expect(response.status).toBe(200);
    expect(result.posts.map((post) => post.slug)).toEqual(["ready"]);
    expect(response.headers.get("Cache-Control")).toContain("max-age=60");
  });

  it("does not expose an unpublished post by its address", async () => {
    const env = makeEnv();
    env.DB.posts.push({ id: "p1", slug: "draft", title: "Draft", status: "draft" });

    const response = await worker.fetch(request("/api/blog/posts/draft"), env);
    expect(response.status).toBe(404);
  });
});

describe("blog authoring", () => {
  it("does not sign in when secrets are missing or the password is wrong", async () => {
    const missing = await worker.fetch(
      request(
        "/api/blog/admin/login",
        "POST",
        { password: "anything" },
        { Origin: "https://portfolio.test" },
      ),
      { DB: makeDb() },
    );
    expect(missing.status).toBe(503);

    const env = makeEnv();
    const wrong = await worker.fetch(
      request(
        "/api/blog/admin/login",
        "POST",
        { password: "wrong" },
        { Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(wrong.status).toBe(401);
    expect(wrong.headers.has("Set-Cookie")).toBe(false);
  });

  it("limits password guesses for the same network address", async () => {
    const env = makeEnv();
    let last;
    for (let i = 0; i < 9; i += 1) {
      last = await worker.fetch(
        request(
          "/api/blog/admin/login",
          "POST",
          { password: "wrong" },
          { Origin: "https://portfolio.test", "CF-Connecting-IP": "192.0.2.44" },
        ),
        env,
      );
    }
    expect(last.status).toBe(429);
    expect(env.DB.attempts[0][0]).not.toContain("192.0.2.44");
  });

  it("requires the signed admin cookie and a same origin for writes", async () => {
    const env = makeEnv();
    const post = {
      title: "A private draft",
      status: "draft",
      blocks: [{ type: "paragraph", text: "Notes." }],
    };

    const anonymous = await worker.fetch(request("/api/blog/admin/posts", "POST", post), env);
    expect(anonymous.status).toBe(401);

    const cookie = await signedIn(env);
    const crossOrigin = await worker.fetch(
      request("/api/blog/admin/posts", "POST", post, {
        Cookie: cookie,
        Origin: "https://attacker.example",
      }),
      env,
    );
    expect(crossOrigin.status).toBe(403);
    expect(env.DB.posts).toHaveLength(0);

    const saved = await worker.fetch(
      request(
        "/api/blog/admin/posts",
        "POST",
        { ...post, status: "published" },
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(saved.status).toBe(201);
    expect((await responseJson(saved)).post.status).toBe("published");

    const publicPost = await worker.fetch(request("/api/blog/posts/a-private-draft"), env);
    expect(publicPost.status).toBe(200);
    expect((await responseJson(publicPost)).post.blocks[0].text).toBe("Notes.");
  });

  it("sets a secure, HTTP only, same site session and can sign out", async () => {
    const env = makeEnv();
    const cookie = await signedIn(env);
    const response = await worker.fetch(
      request("/api/blog/admin/session", "GET", undefined, { Cookie: cookie }),
      env,
    );
    const result = await responseJson(response);

    expect(result.authenticated).toBe(true);
    const login = await worker.fetch(
      request(
        "/api/blog/admin/login",
        "POST",
        { password: env.BLOG_ADMIN_PASSWORD },
        { Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(login.headers.get("Set-Cookie")).toMatch(/HttpOnly; Secure; SameSite=Strict/);

    const logout = await worker.fetch(
      request(
        "/api/blog/admin/logout",
        "POST",
        {},
        { Cookie: cookie, Origin: "https://portfolio.test" },
      ),
      env,
    );
    expect(logout.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });

  it("requires sign in for uploads and reports when R2 is not enabled", async () => {
    const env = makeEnv();
    const body = new Uint8Array([1, 2, 3, 4]);
    const anonymous = await worker.fetch(
      new Request("https://portfolio.test/api/blog/admin/media", {
        method: "POST",
        headers: {
          Origin: "https://portfolio.test",
          "Content-Type": "image/png",
          "Content-Length": "4",
        },
        body,
      }),
      env,
    );
    expect(anonymous.status).toBe(401);

    const cookie = await signedIn(env);
    const noBucket = await worker.fetch(
      new Request("https://portfolio.test/api/blog/admin/media", {
        method: "POST",
        headers: {
          Origin: "https://portfolio.test",
          Cookie: cookie,
          "Content-Type": "image/png",
          "Content-Length": "4",
        },
        body,
      }),
      env,
    );
    expect(noBucket.status).toBe(503);
  });

  it("serves uploaded video byte ranges so players can seek", async () => {
    const env = makeEnv({
      MEDIA: {
        async get(_key, options) {
          const range = options.range.get("Range");
          expect(range).toBe("bytes=10-29");
          return {
            size: 100,
            range: { offset: 10, length: 20 },
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(20));
                controller.close();
              },
            }),
            httpEtag: '"video-etag"',
            writeHttpMetadata(headers) {
              headers.set("Content-Type", "video/mp4");
            },
          };
        },
      },
    });
    const key = "blog-media/12345678-1234-4234-8234-123456789abc.mp4";
    const response = await worker.fetch(
      request(`/blog/media/${key}`, "GET", undefined, { Range: "bytes=10-29" }),
      env,
    );

    expect(response.status).toBe(206);
    expect(response.headers.get("Accept-Ranges")).toBe("bytes");
    expect(response.headers.get("Content-Range")).toBe("bytes 10-29/100");
    expect(response.headers.get("Content-Type")).toBe("video/mp4");
  });

  it("returns a complete media object as 200, not a partial response", async () => {
    const env = makeEnv({
      MEDIA: {
        async get(_key, options) {
          expect(options.range.has("Range")).toBe(false);
          return {
            size: 100,
            range: { offset: 0, length: 100 },
            body: new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(100));
                controller.close();
              },
            }),
            httpEtag: '"video-etag"',
            writeHttpMetadata(headers) {
              headers.set("Content-Type", "video/mp4");
            },
          };
        },
      },
    });
    const key = "blog-media/12345678-1234-4234-8234-123456789abc.mp4";
    const response = await worker.fetch(request(`/blog/media/${key}`), env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Range")).toBeNull();
    expect(response.headers.get("Content-Length")).toBe("100");
  });
});

describe("static blog routes", () => {
  it.each([
    ["/blog", "/blog-shell"],
    ["/blog/write", "/blog-editor"],
    ["/blog/a-post-title", "/blog-shell"],
  ])("serves %s from %s", async (route, asset) => {
    const env = makeEnv();
    const response = await worker.fetch(request(route), env);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(asset);
  });
});
