const writer = document.querySelector("#blog-writer");
const writerStatus = document.querySelector("#writer-status");
const postForm = document.querySelector("#post-form");
const blockList = document.querySelector("#block-list");
const draftList = document.querySelector("#draft-list");
const titleInput = document.querySelector("#post-title");
const slugInput = document.querySelector("#post-slug");
const templateInput = document.querySelector("#post-template");
const saveDraft = document.querySelector("#save-draft");
const publishPost = document.querySelector("#publish-post");
const previewLink = document.querySelector("#preview-post");

let post = null;
let slugWasEdited = false;

const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const templates = {
  article: [
    { type: "paragraph", text: "" },
    { type: "heading", level: 2, text: "" },
    { type: "paragraph", text: "" },
  ],
  project: [
    { type: "paragraph", text: "" },
    {
      type: "columns",
      columns: [
        { heading: "The challenge", text: "" },
        { heading: "The approach", text: "" },
      ],
    },
    { type: "heading", level: 2, text: "What changed" },
    { type: "paragraph", text: "" },
  ],
  "photo-story": [
    { type: "paragraph", text: "" },
    { type: "image", key: "", alt: "", caption: "" },
    { type: "paragraph", text: "" },
  ],
};

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/, "");
}

function setStatus(message, kind = "") {
  writerStatus.textContent = message;
  writerStatus.className = `blog-status${kind ? ` blog-status--${kind}` : ""}`;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body instanceof File ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function label(text, control) {
  const wrapper = node("label", "blog-field");
  wrapper.append(node("span", "blog-label", text), control);
  return wrapper;
}

function textInput(value, maxLength = 120) {
  const input = node("input");
  input.value = value || "";
  input.maxLength = maxLength;
  return input;
}

function textArea(value, rows = 5, maxLength = 12000) {
  const area = node("textarea");
  area.rows = rows;
  area.maxLength = maxLength;
  area.value = value || "";
  return area;
}

async function uploadFile(file, block, statusLine) {
  if (!file) return;
  statusLine.textContent = `Uploading ${file.name}…`;
  try {
    const response = await fetch("/api/blog/admin/media", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Upload failed");
    block.key = result.key;
    statusLine.textContent = `Uploaded ${file.name}`;
    renderBlocks();
  } catch (cause) {
    statusLine.textContent = cause.message;
  }
}

function renderMediaBlock(block, index) {
  const media = node("div", "blog-media-editor");
  media.append(
    label(
      "Choose an image or video",
      (() => {
        const input = node("input");
        input.type = "file";
        input.accept =
          block.type === "image"
            ? "image/jpeg,image/png,image/webp,image/gif"
            : "video/mp4,video/webm";
        input.addEventListener("change", () => uploadFile(input.files?.[0], block, uploadStatus));
        return input;
      })(),
    ),
  );

  if (block.key) {
    const preview =
      block.type === "image"
        ? node("img", "blog-upload-preview")
        : node("video", "blog-upload-preview");
    preview.src = `/blog/media/${block.key}`;
    if (block.type === "image") preview.alt = block.alt || "";
    else {
      preview.controls = true;
      preview.preload = "metadata";
    }
    media.append(preview);
  }

  if (block.type === "image") {
    const alt = textInput(block.alt, 300);
    alt.addEventListener("input", () => {
      block.alt = alt.value;
    });
    media.append(label("Alternative text", alt));
  }

  const caption = textInput(block.caption, 500);
  caption.addEventListener("input", () => {
    block.caption = caption.value;
  });
  media.append(label("Caption", caption));
  media.append(uploadStatus);
  return media;
}

function renderBlockEditor(block, index) {
  const card = node("article", "blog-block-card");
  const header = node("div", "blog-block-toolbar");
  const kind = node(
    "strong",
    "blog-block-kind",
    block.type === "columns" ? "Two columns" : block.type[0].toUpperCase() + block.type.slice(1),
  );
  const controls = node("div", "blog-block-actions");
  const up = node("button", "blog-icon-button", "Move up");
  up.type = "button";
  up.disabled = index === 0;
  up.setAttribute("aria-label", "Move section up");
  up.addEventListener("click", () => moveBlock(index, -1));
  const down = node("button", "blog-icon-button", "Move down");
  down.type = "button";
  down.disabled = index === post.blocks.length - 1;
  down.setAttribute("aria-label", "Move section down");
  down.addEventListener("click", () => moveBlock(index, 1));
  const remove = node("button", "blog-icon-button blog-icon-button--remove", "Remove");
  remove.type = "button";
  remove.addEventListener("click", () => {
    post.blocks.splice(index, 1);
    renderBlocks();
  });
  controls.append(up, down, remove);
  header.append(kind, controls);
  card.append(header);

  if (block.type === "paragraph" || block.type === "heading") {
    if (block.type === "heading") {
      const level = node("select");
      for (const [value, name] of [
        [2, "Section heading"],
        [3, "Small heading"],
      ]) {
        const option = node("option", "", name);
        option.value = String(value);
        option.selected = block.level === value;
        level.append(option);
      }
      level.addEventListener("change", () => {
        block.level = Number(level.value);
      });
      card.append(label("Heading size", level));
    }
    const area = textArea(
      block.text,
      block.type === "paragraph" ? 5 : 2,
      block.type === "paragraph" ? 20000 : 180,
    );
    area.addEventListener("input", () => {
      block.text = area.value;
    });
    card.append(label(block.type === "paragraph" ? "Paragraph text" : "Heading text", area));
  } else if (block.type === "image" || block.type === "video") {
    card.append(renderMediaBlock(block, index));
  } else if (block.type === "columns") {
    const columns = node("div", "blog-columns-editor");
    block.columns.forEach((column, columnIndex) => {
      const columnCard = node("section", "blog-column-editor");
      columnCard.append(node("h3", "blog-column-editor-title", `Column ${columnIndex + 1}`));
      const heading = textInput(column.heading, 120);
      heading.addEventListener("input", () => {
        column.heading = heading.value;
      });
      columnCard.append(label("Column heading", heading));
      const body = textArea(column.text, 5, 12000);
      body.addEventListener("input", () => {
        column.text = body.value;
      });
      columnCard.append(label("Column text", body));
      columns.append(columnCard);
    });
    card.append(columns);
    if (block.columns.length < 3) {
      const addColumn = node("button", "btn btn--ghost blog-add-column", "Add a third column");
      addColumn.type = "button";
      addColumn.addEventListener("click", () => {
        block.columns.push({ heading: "", text: "" });
        renderBlocks();
      });
      card.append(addColumn);
    }
  }
  return card;
}

let uploadStatus = node("p", "blog-upload-status");

function moveBlock(index, direction) {
  const destination = index + direction;
  if (destination < 0 || destination >= post.blocks.length) return;
  [post.blocks[index], post.blocks[destination]] = [post.blocks[destination], post.blocks[index]];
  renderBlocks();
}

function renderBlocks() {
  uploadStatus = node("p", "blog-upload-status");
  blockList.replaceChildren(...post.blocks.map(renderBlockEditor));
  if (post.blocks.length === 0) {
    const empty = node("p", "blog-empty-inline", "This post has no sections yet. Add one above.");
    blockList.append(empty);
  }
}

function newPost(template = "article") {
  post = {
    id: "",
    title: "",
    slug: "",
    excerpt: "",
    status: "draft",
    template,
    coverKey: null,
    blocks: structuredClone(templates[template]),
  };
  slugWasEdited = false;
  postForm.elements.id.value = "";
  titleInput.value = "";
  slugInput.value = "";
  postForm.elements.excerpt.value = "";
  templateInput.value = template;
  templateInput.disabled = false;
  previewLink.hidden = true;
  setStatus("New draft");
  renderBlocks();
  titleInput.focus();
}

function editPost(value) {
  post = {
    ...value,
    coverKey: value.cover_key || null,
    blocks: value.blocks || [],
  };
  slugWasEdited = true;
  postForm.elements.id.value = post.id;
  titleInput.value = post.title;
  slugInput.value = post.slug;
  postForm.elements.excerpt.value = post.excerpt || "";
  templateInput.value = post.template || "article";
  templateInput.disabled = true;
  previewLink.href = `/blog/${encodeURIComponent(post.slug)}`;
  previewLink.hidden = post.status !== "published";
  setStatus(
    `${post.status === "published" ? "Published" : "Draft"} · updated ${new Date(post.updated_at).toLocaleString()}`,
  );
  renderBlocks();
}

async function loadPosts() {
  const result = await api("/api/blog/admin/posts");
  draftList.replaceChildren();
  if (result.posts.length === 0) {
    draftList.append(node("p", "blog-muted", "No posts yet. Start with a template."));
    return;
  }
  for (const item of result.posts) {
    const button = node("button", "blog-draft-item");
    button.type = "button";
    button.append(node("strong", "", item.title));
    button.append(
      node("span", "blog-draft-meta", item.status === "published" ? "Published" : "Draft"),
    );
    button.addEventListener("click", () => editPost(item));
    draftList.append(button);
  }
}

async function openWriter() {
  await loadPosts();
  if (!post) newPost();
}

document.querySelector("#new-post").addEventListener("click", () => newPost(templateInput.value));

titleInput.addEventListener("input", () => {
  if (!slugWasEdited) slugInput.value = slugify(titleInput.value);
});
slugInput.addEventListener("input", () => {
  slugWasEdited = true;
  slugInput.value = slugify(slugInput.value);
});

templateInput.addEventListener("change", () => {
  if (post?.id) return;
  post.template = templateInput.value;
  post.blocks = structuredClone(templates[post.template]);
  renderBlocks();
});

document.querySelector("#add-block").addEventListener("click", () => {
  const type = document.querySelector("#new-block-type").value;
  const block = {
    paragraph: () => ({ type, text: "" }),
    heading: () => ({ type, level: 2, text: "" }),
    image: () => ({ type, key: "", alt: "", caption: "" }),
    video: () => ({ type, key: "", alt: "", caption: "" }),
    columns: () => ({
      type,
      columns: [
        { heading: "", text: "" },
        { heading: "", text: "" },
      ],
    }),
  }[type]();
  post.blocks.push(block);
  renderBlocks();
  blockList.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
});

async function save(status) {
  if (!post) return;
  post.title = titleInput.value.trim();
  post.slug = slugify(slugInput.value);
  post.excerpt = postForm.elements.excerpt.value.trim();
  post.template = templateInput.value;
  post.status = status;
  setStatus(status === "published" ? "Publishing…" : "Saving draft…");
  saveDraft.disabled = true;
  publishPost.disabled = true;
  try {
    const result = await api("/api/blog/admin/posts", {
      method: "POST",
      body: JSON.stringify(post),
    });
    editPost(result.post);
    await loadPosts();
    setStatus(status === "published" ? "Published." : "Draft saved.", "success");
  } catch (cause) {
    setStatus(cause.message, "error");
  } finally {
    saveDraft.disabled = false;
    publishPost.disabled = false;
  }
}

saveDraft.addEventListener("click", () => save("draft"));
publishPost.addEventListener("click", () => save("published"));
openWriter();
