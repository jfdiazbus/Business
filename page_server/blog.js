const status = document.querySelector("#blog-status");
const root = document.querySelector("#blog-content");
const slug = decodeURIComponent(location.pathname.replace(/^\/blog\/?/, "").split("/")[0] || "");

const element = (tag, className, value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
};

function mediaUrl(key) {
  return `/blog/media/${key}`;
}

function renderBlock(block) {
  if (block.type === "paragraph") return element("p", "blog-paragraph", block.text);
  if (block.type === "heading")
    return element(`h${block.level}`, "blog-section-heading", block.text);

  if (block.type === "image") {
    const figure = element("figure", "blog-figure");
    const image = element("img", "blog-image");
    image.src = mediaUrl(block.key);
    image.alt = block.alt || "";
    image.loading = "lazy";
    figure.append(image);
    if (block.caption) figure.append(element("figcaption", "blog-caption", block.caption));
    return figure;
  }

  if (block.type === "video") {
    const figure = element("figure", "blog-figure");
    const video = element("video", "blog-video");
    video.controls = true;
    video.preload = "metadata";
    video.playsInline = true;
    const source = element("source");
    source.src = mediaUrl(block.key);
    source.type = block.key.endsWith(".webm") ? "video/webm" : "video/mp4";
    video.append(source);
    figure.append(video);
    if (block.caption) figure.append(element("figcaption", "blog-caption", block.caption));
    return figure;
  }

  if (block.type === "columns") {
    const section = element("section", "blog-columns");
    section.setAttribute("aria-label", "Two column section");
    for (const column of block.columns) {
      const article = element("article", "blog-column");
      if (column.heading) article.append(element("h3", "blog-column-heading", column.heading));
      article.append(element("p", "blog-paragraph", column.text));
      section.append(article);
    }
    return section;
  }
  return null;
}

function dateLabel(date) {
  if (!date) return "";
  const value = new Date(date);
  return Number.isNaN(value.getTime())
    ? ""
    : new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(value);
}

function showEmpty() {
  status.textContent = "No posts yet. The first one will be here soon.";
  const empty = element("section", "blog-empty");
  empty.append(element("h2", "heading", "A blank page, for now"));
  empty.append(element("p", "blog-muted", "New notes will appear here when they are ready."));
  root.replaceChildren(empty);
}

function renderListing(posts) {
  if (posts.length === 0) return showEmpty();
  status.textContent = `${posts.length} ${posts.length === 1 ? "post" : "posts"}`;
  const list = element("div", "blog-list");

  for (const post of posts) {
    const card = element("article", "blog-card");
    if (post.cover_key) {
      const cover = element("img", "blog-card-cover");
      cover.src = mediaUrl(post.cover_key);
      cover.alt = "";
      cover.loading = "lazy";
      card.append(cover);
    }
    card.append(element("p", "blog-date", dateLabel(post.published_at)));
    const heading = element("h2", "blog-card-title");
    const link = element("a", "", post.title);
    link.href = `/blog/${encodeURIComponent(post.slug)}`;
    heading.append(link);
    card.append(heading);
    if (post.excerpt) card.append(element("p", "blog-excerpt", post.excerpt));
    card.append(element("a", "blog-read-link", "Read the post"));
    card.querySelector(".blog-read-link").href = `/blog/${encodeURIComponent(post.slug)}`;
    list.append(card);
  }
  root.replaceChildren(list);
}

function renderPost(post) {
  document.title = `${post.title} — Juan Felipe Diaz`;
  document.querySelector('meta[name="description"]').content = post.excerpt || post.title;
  document.querySelector('meta[property="og:title"]').content = document.title;
  document.querySelector('meta[property="og:description"]').content = post.excerpt || post.title;
  document.querySelector("h1.page-title").textContent = post.title;

  const article = element("article", "blog-article");
  const date = element("p", "blog-date", dateLabel(post.published_at));
  article.append(date);
  if (post.excerpt) article.append(element("p", "blog-post-excerpt", post.excerpt));
  if (post.cover_key) {
    const cover = element("img", "blog-cover");
    cover.src = mediaUrl(post.cover_key);
    cover.alt = "";
    cover.fetchPriority = "high";
    article.append(cover);
  }
  const content = element("div", "blog-article-content");
  for (const block of post.blocks || []) {
    const rendered = renderBlock(block);
    if (rendered) content.append(rendered);
  }
  article.append(content);
  root.replaceChildren(article);
  status.replaceChildren();
  const back = element("p", "more");
  const link = element("a", "", "Back to all posts");
  link.href = "/blog";
  back.append(link);
  root.append(back);
}

async function load() {
  try {
    const response = await fetch(
      slug ? `/api/blog/posts/${encodeURIComponent(slug)}` : "/api/blog/posts",
    );
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load posts");
    if (slug) renderPost(result.post);
    else renderListing(result.posts || []);
  } catch {
    status.textContent = "The blog could not load just now. Try again in a moment.";
    const retry = element("button", "btn btn--ghost", "Try again");
    retry.type = "button";
    retry.addEventListener("click", load);
    root.replaceChildren(retry);
  }
}

load();
