"""A page audit graph: fetch each page, measure it, and report what is wrong.

Same shape as `graph_page_server.py` (planner -> worker, looped), with the
worker doing the reading a crawler needs before anyone can improve a page:
metadata, headings, links, images, and the weight of what the browser downloads.

    python graph_page_audit.py [base_url]

Standard library only, plus langgraph.
"""

from __future__ import annotations

import sys
import time
from html.parser import HTMLParser
from typing import TypedDict
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen

from langgraph.graph import END, START, StateGraph

PAGES = ["/", "/home", "/school", "/services", "/terms", "/thanks", "/login", "/register", "/blog"]


class State(TypedDict):
    base_url: str
    pages: list[str]
    index: int
    current_page: str | None
    results: list[dict]
    findings: list[dict]


class PageParser(HTMLParser):
    """Everything the audit needs, without a third-party parser."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.lang: str | None = None
        self.title = ""
        self.meta: dict[str, str] = {}
        self.headings: list[tuple[int, str]] = []
        self.ids: list[str] = []
        self.images: list[tuple[str, str | None]] = []
        self.links: list[str] = []
        self.stylesheets: list[str] = []
        self.preconnects: list[str] = []
        self.canonical: str | None = None
        self.inline_style_bytes = 0
        self.inline_script_bytes = 0
        self.script_sources: list[str] = []
        self.text: list[str] = []
        self._in_title = False
        self._heading_level = 0
        self._heading_text: list[str] = []
        self._in_script = False
        self._in_style = False
        self._skip_text = 0
        self._link_depth = 0
        self._link_text: list[str] = []
        self.empty_links: list[str] = []
        self.hash_links = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name: value or "" for name, value in attrs}

        if "id" in values:
            self.ids.append(values["id"])

        if tag == "html":
            self.lang = values.get("lang")
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = values.get("name") or values.get("property")
            if key:
                self.meta[key] = values.get("content", "")
        elif tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self._heading_level = int(tag[1])
            self._heading_text = []
        elif tag == "img":
            self.images.append((values.get("src", ""), values.get("alt")))
        elif tag == "a" and values.get("href"):
            self.links.append(values["href"])
            if values["href"] == "#":
                self.hash_links += 1
            self._link_depth += 1
            self._link_text = []
        elif tag == "link":
            rel = values.get("rel", "")
            if rel == "stylesheet" and values.get("href"):
                self.stylesheets.append(values["href"])
            elif rel == "preconnect" and values.get("href"):
                self.preconnects.append(values["href"])
            elif rel == "canonical" and values.get("href"):
                self.canonical = values["href"]
        elif tag == "script":
            if values.get("src"):
                self.script_sources.append(values["src"])
            else:
                self._in_script = True
        elif tag == "style":
            self._in_style = True
        elif tag in {"svg", "video", "canvas"}:
            self._skip_text += 1

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        elif tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            text = " ".join("".join(self._heading_text).split())
            self.headings.append((self._heading_level, text))
            self._heading_level = 0
        elif tag == "script":
            self._in_script = False
        elif tag == "style":
            self._in_style = False
        elif tag == "a" and self._link_depth:
            text = " ".join("".join(self._link_text).split())
            if not text:
                self.empty_links.append(self.links[-1])
            self._link_depth -= 1
        elif tag in {"svg", "video", "canvas"} and self._skip_text:
            self._skip_text -= 1

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        if self._in_script:
            self.inline_script_bytes += len(data.encode())
        if self._in_style:
            self.inline_style_bytes += len(data.encode())
        if not (self._in_script or self._in_style or self._skip_text):
            if self._heading_level:
                self._heading_text.append(data)
            if self._link_depth:
                self._link_text.append(data)
            self.text.append(data)


def measure(html: str, url: str, status: int, size: int, elapsed_ms: int) -> dict:
    parser = PageParser()
    parser.feed(html)

    text = " ".join(" ".join(parser.text).split())
    description = parser.meta.get("description", "")
    internal = sorted({href for href in parser.links if href.startswith("/")})
    missing_alt = [src for src, alt in parser.images if alt is None]

    return {
        "url": url,
        "status": status,
        "bytes": size,
        "ms": elapsed_ms,
        "title": parser.title.strip(),
        "description": description,
        "lang": parser.lang,
        "meta": parser.meta,
        "headings": parser.headings,
        "ids": parser.ids,
        "images": len(parser.images),
        "missing_alt": missing_alt,
        "empty_links": parser.empty_links,
        "hash_links": parser.hash_links,
        "internal_links": internal,
        "stylesheets": parser.stylesheets,
        "preconnects": parser.preconnects,
        "canonical": parser.canonical,
        "scripts": parser.script_sources,
        "inline_style_bytes": parser.inline_style_bytes,
        "inline_script_bytes": parser.inline_script_bytes,
        "assets_bytes": 0,
        "words": len(text.split()),
    }


def check(page: dict, base_url: str, dead_links: list[str]) -> list[dict]:
    issues: list[dict] = []
    path = urlparse(page["url"]).path or "/"

    def add(level: str, rule: str, detail: str) -> None:
        issues.append({"page": path, "level": level, "rule": rule, "detail": detail})

    if page["status"] != 200:
        add("error", "status", f"answered {page['status']}")
        return issues

    if not page["title"]:
        add("error", "title", "missing")
    elif len(page["title"]) > 65:
        add("warn", "title", f"{len(page['title'])} characters, search shows about 60")

    if not page["description"]:
        add("error", "description", "missing")
    elif len(page["description"]) < 50:
        add("warn", "description", f"only {len(page['description'])} characters")
    elif len(page["description"]) > 160:
        add("warn", "description", f"{len(page['description'])} characters, search shows about 160")

    if page["lang"] != "en":
        add("error", "lang", f"lang is {page['lang']!r}")

    if not page["meta"].get("viewport"):
        add("error", "viewport", "missing")

    h1s = [text for level, text in page["headings"] if level == 1]
    if len(h1s) != 1:
        add("error", "h1", f"{len(h1s)} level one headings")

    levels = [level for level, _ in page["headings"]]
    for previous, current in zip(levels, levels[1:]):
        if current - previous > 1:
            add("error", "heading-order", f"h{previous} followed by h{current}")
            break

    duplicates = sorted({name for name in page["ids"] if page["ids"].count(name) > 1})
    if duplicates:
        add("error", "duplicate-id", ", ".join(duplicates))

    if page["missing_alt"]:
        add("error", "image-alt", f"{len(page['missing_alt'])} images without alt")

    if page["empty_links"]:
        add("error", "link-text", f"{len(page['empty_links'])} links with no words")

    if page["hash_links"]:
        add("error", "hash-link", f"{page['hash_links']} links pointing at #")

    if dead_links:
        add("error", "dead-link", ", ".join(dead_links))

    if not page["meta"].get("og:title") or not page["meta"].get("og:description"):
        add("warn", "open-graph", "og:title or og:description missing")

    if not page["meta"].get("og:url") and not page.get("canonical"):
        # The origin depends on where this is deployed, so the source cannot
        # know it. Worth adding once there is a domain, not before.
        if not (page["meta"].get("robots") and "noindex" in page["meta"]["robots"]):
            add("info", "canonical", "no og:url or canonical: the deployed origin is not known here")

    if page["meta"].get("robots") and "noindex" in page["meta"]["robots"]:
        add("info", "noindex", "kept out of search on purpose")

    if page["preconnects"]:
        third_party = sorted({urlparse(url).netloc for url in page["preconnects"]})
        add("info", "third-party", f"preconnect to {', '.join(third_party)}")

    if page["bytes"] > 25_000:
        add("warn", "weight", f"{page['bytes']} bytes of HTML")

    if page.get("total_bytes", page["bytes"]) > 80_000:
        add("warn", "weight", f"{page['total_bytes']} bytes of HTML, CSS and JS")

    if page["inline_script_bytes"] > 2_000:
        add("warn", "inline-script", f"{page['inline_script_bytes']} bytes inline")

    return issues


def fetch(url: str) -> tuple[int, bytes, int]:
    started = time.monotonic()
    with urlopen(url, timeout=10) as response:
        body = response.read()
        return response.status, body, int((time.monotonic() - started) * 1000)


def link_status(url: str) -> int | None:
    try:
        with urlopen(url, timeout=8) as response:
            return response.status
    except HTTPError as error:
        return error.code
    except URLError:
        return None


def planner(state: State) -> State:
    pages = state["pages"]
    index = state["index"]

    if index < len(pages):
        return {"current_page": pages[index], "index": index + 1}

    return {"current_page": None}


def should_continue(state: State) -> str:
    return "worker" if state["current_page"] is not None else "reporter"


def worker(state: State) -> State:
    page = state["current_page"] or "/"
    base = state["base_url"].rstrip("/")
    url = f"{base}{page}"

    try:
        status, body, elapsed = fetch(url)
    except HTTPError as error:
        return {
            "results": state["results"]
            + [
                {
                    "url": url,
                    "status": error.code,
                    "bytes": 0,
                    "ms": 0,
                    "title": "",
                    "description": "",
                    "lang": None,
                    "meta": {},
                    "headings": [],
                    "ids": [],
                    "images": 0,
                    "missing_alt": [],
                    "internal_links": [],
                    "stylesheets": [],
                    "preconnects": [],
                    "scripts": [],
                    "inline_style_bytes": 0,
                    "inline_script_bytes": 0,
                    "words": 0,
                }
            ],
            "findings": state["findings"]
            + [{"page": page, "level": "error", "rule": "status", "detail": str(error.reason)}],
        }

    measured = measure(body.decode("utf-8", "replace"), url, status, len(body), elapsed)

    # What the page makes the browser fetch from this origin, so `bytes` is not
    # mistaken for the cost of the page.
    origin = urlparse(url).netloc
    for href in measured["stylesheets"] + measured["scripts"]:
        target = urljoin(base + "/", href.lstrip("/"))
        if urlparse(target).netloc != origin:
            continue
        try:
            _, asset, _ = fetch(target)
            measured["assets_bytes"] += len(asset)
        except (HTTPError, URLError):
            measured["assets_bytes"] += 0

    measured["total_bytes"] = measured["bytes"] + measured["assets_bytes"]

    dead: list[str] = []
    for href in measured["internal_links"]:
        target = urljoin(base + "/", href.lstrip("/"))
        code = link_status(target)
        if code != 200:
            dead.append(f"{href} ({code or 'ERR'})")

    return {
        "results": state["results"] + [measured],
        "findings": state["findings"] + check(measured, base, dead),
    }


def reporter(state: State) -> State:
    print(f"{'status':>6} {'html':>7} {'assets':>7} {'words':>6} {'h':>2}  page")
    for page in state["results"]:
        path = urlparse(page["url"]).path or "/"
        total = page.get("total_bytes", page["bytes"])
        print(
            f"{page['status']:>6} {page['bytes']:>7} {total - page['bytes']:>7} "
            f"{page['words']:>6} {len(page['headings']):>2}  {path}"
        )

    findings = list(state["findings"])

    # A title or a description repeated across pages makes search results
    # compete with themselves, which one page cannot see on its own.
    for field, rule in (("title", "duplicate-title"), ("description", "duplicate-description")):
        seen: dict[str, list[str]] = {}
        for page in state["results"]:
            value = page.get(field, "")
            if value:
                seen.setdefault(value, []).append(urlparse(page["url"]).path or "/")
        for value, paths in seen.items():
            if len(paths) > 1:
                findings.append(
                    {
                        "page": ", ".join(paths),
                        "level": "warn",
                        "rule": rule,
                        "detail": value[:70],
                    }
                )

    order = {"error": 0, "warn": 1, "info": 2}
    findings = sorted(findings, key=lambda item: (item["page"], order[item["level"]]))
    counts = {level: sum(1 for item in findings if item["level"] == level) for level in order}

    print(
        f"\n{counts['error']} errors, {counts['warn']} warnings, "
        f"{counts['info']} notes, across {len(state['results'])} pages"
    )

    verbose = "-v" in sys.argv or "--verbose" in sys.argv
    for item in findings:
        if item["level"] == "info" and not verbose:
            continue
        print(f"  {item['level']:5} {item['page']:10} {item['rule']:22} {item['detail']}")

    return {"findings": findings}


graph = StateGraph(State)
graph.add_node("planner", planner)
graph.add_node("worker", worker)
graph.add_node("reporter", reporter)
graph.add_edge(START, "planner")
graph.add_conditional_edges("planner", should_continue, {"worker": "worker", "reporter": "reporter"})
graph.add_edge("worker", "planner")
graph.add_edge("reporter", END)

app = graph.compile()


if __name__ == "__main__":
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
    app.invoke(
        {
            "base_url": base,
            "pages": PAGES,
            "index": 0,
            "current_page": None,
            "results": [],
            "findings": [],
        }
    )
