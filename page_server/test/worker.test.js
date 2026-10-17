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
  it("requires a database for posts", async () => {
    const env = makeEnv({ DB: undefined });
    const response = await worker.fetch(request("/api/blog/admin/posts"), env);
    expect(response.status).toBe(503);
  });

  it("checks the request origin before saving or deleting", async () => {
    const env = makeEnv();
    const post = {
      title: "A private draft",
      status: "draft",
      blocks: [{ type: "paragraph", text: "Notes." }],
    };

    const crossOrigin = await worker.fetch(
      request("/api/blog/admin/posts", "POST", post, { Origin: "https://attacker.example" }),
      env,
    );
    expect(crossOrigin.status).toBe(403);
    expect(env.DB.posts).toHaveLength(0);

    const saved = await worker.fetch(
      request("/api/blog/admin/posts", "POST", post, { Origin: "https://portfolio.test" }),
      env,
    );
    expect(saved.status).toBe(201);
    expect((await responseJson(saved)).post.status).toBe("draft");

    const deleted = await worker.fetch(
      request("/api/blog/admin/posts/a-private-draft", "DELETE", undefined, {
        Origin: "https://attacker.example",
      }),
      env,
    );
    expect(deleted.status).toBe(403);
    expect(env.DB.posts).toHaveLength(1);
  });

  it("requires R2 before accepting media", async () => {
    const env = makeEnv();
    const body = new Uint8Array([1, 2, 3, 4]);
    const noBucket = await worker.fetch(
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
    expect(noBucket.status).toBe(503);
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
