import os
import re
import subprocess
import tempfile
from html.parser import HTMLParser
from typing import TypedDict
from urllib.request import urlopen
from urllib.error import URLError, HTTPError
from langgraph.graph import StateGraph, START, END

OPENCODE_CLI = "/home/juan-fe/.opencode/bin/opencode"
MODEL = "opencode/deepseek-v4.1-flash-free"
MAX_RETRIES = 2
TIMEOUT_SECONDS = 240


class _CleanHtml(HTMLParser):
    """Strip CSS/JS and keep only the markup that carries meaning."""

    keep_tags = {"title", "meta", "h1", "h2", "h3", "h4", "p", "a", "li",
                 "article", "section", "main", "header", "footer", "nav"}
    skip_tags = {"script", "style", "noscript"}

    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.skip_tags:
            self.skip += 1
        elif tag in self.keep_tags:
            attrs_str = " ".join(f'{k}="{v}"' for k, v in attrs)
            self.parts.append(f"<{tag}{' ' + attrs_str if attrs_str else ''}>")

    def handle_endtag(self, tag):
        if tag in self.skip_tags:
            self.skip -= 1
        elif tag in self.keep_tags:
            self.parts.append(f"</{tag}>")

    def handle_data(self, data):
        if self.skip == 0:
            self.parts.append(data)


def clean_html(html: str) -> str:
    parser = _CleanHtml()
    parser.feed(html)
    return re.sub(r"\s+", " ", "".join(parser.parts)).strip()

PROMPTS = {
    "analyze": """You are a senior web developer reviewing a portfolio page.

Look at the HTML below and identify the 3 most important concrete improvements.
Focus on: accessibility, clarity of messaging, and calls to action.

Output ONLY a numbered list. Be specific and brief.

HTML:
{html}
""",
    "evaluate": """You are a strict reviewer. Read the following output and decide if it is high-quality, specific, and actionable.

Output exactly one line starting with either YES or NO, followed by a short reason.

Output:
{output}
""",
    "rewrite": """You are a senior copywriter and front-end developer.

Based on the analysis below, rewrite the page title, meta description, and main heading (h1) of the page.
Keep the same tone and language. Output ONLY the new title, meta description, and h1, each on its own line, prefixed with TITLE:, META:, H1:.

Analysis:
{analysis}

Original HTML:
{html}
""",
}


class State(TypedDict):
    base_url: str
    pages: list[str]
    page_index: int
    current_page: str | None
    html: str
    step: str
    retries: dict[str, int]
    analysis: str
    rewrite: str
    report: dict[str, dict]


def call_opencode(prompt: str, message: str = "Follow the instructions in the attached file.") -> str:
    """Send a prompt to DeepSeek through the OpenCode CLI and return the text."""
    prompt_file = ""
    try:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write(prompt)
            prompt_file = f.name

        result = subprocess.run(
            [OPENCODE_CLI, "run", "--model", MODEL, "--file", prompt_file, message],
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )

        if result.returncode != 0:
            error = (result.stderr or result.stdout or "Unknown opencode error").strip()
            return f"[OPENCODE ERROR] {error}"

        stdout = result.stdout
        lines = stdout.splitlines()

        # Skip ANSI header lines until the model response starts.
        for i, line in enumerate(lines):
            if line.startswith("> "):
                return "\n".join(lines[i + 1 :]).strip()

        return stdout.strip()
    finally:
        if prompt_file and os.path.exists(prompt_file):
            os.unlink(prompt_file)


def evaluate_output(output: str) -> tuple[bool, str]:
    """Ask the model to evaluate its own output. Returns (passed, reason)."""
    prompt = PROMPTS["evaluate"].format(output=output)
    response = call_opencode(prompt)
    first_line = response.splitlines()[0] if response else "NO"
    passed = first_line.strip().upper().startswith("YES")
    reason = first_line.strip()
    return passed, reason


def fetch_page(state: State) -> State:
    page = state["pages"][state["page_index"]]
    base_url = state["base_url"].rstrip("/")
    url = f"{base_url}{page}"

    try:
        with urlopen(url, timeout=10) as response:
            raw = response.read().decode("utf-8", errors="replace")
            html = clean_html(raw)
    except (HTTPError, URLError) as error:
        html = f"<!-- Error fetching {url}: {error} -->"

    return {
        "current_page": page,
        "html": html,
        "step": "analyze",
        "analysis": "",
        "rewrite": "",
    }


def analyze_page(state: State) -> State:
    prompt = PROMPTS["analyze"].format(html=state["html"])
    analysis = call_opencode(prompt)
    retries = state.get("retries", {})
    retries["analyze"] = retries.get("analyze", 0)
    return {"analysis": analysis, "retries": retries}


def check_analysis(state: State) -> State:
    passed, reason = evaluate_output(state["analysis"])
    retries = state["retries"]

    if not passed and retries["analyze"] < MAX_RETRIES:
        retries["analyze"] += 1
        return {"step": "analyze", "retries": retries}

    if not passed:
        return {
            "step": "finalize",
            "analysis": f"[FAILED AFTER {MAX_RETRIES} RETRIES] {reason}\n{state['analysis']}",
            "retries": retries,
        }

    return {"step": "rewrite", "retries": retries}


def rewrite_page(state: State) -> State:
    prompt = PROMPTS["rewrite"].format(
        analysis=state["analysis"], html=state["html"]
    )
    rewrite = call_opencode(prompt)
    retries = state.get("retries", {})
    retries["rewrite"] = retries.get("rewrite", 0)
    return {"rewrite": rewrite, "retries": retries}


def check_rewrite(state: State) -> State:
    passed, reason = evaluate_output(state["rewrite"])
    retries = state["retries"]

    if not passed and retries["rewrite"] < MAX_RETRIES:
        retries["rewrite"] += 1
        return {"step": "rewrite", "retries": retries}

    if not passed:
        return {
            "step": "finalize",
            "rewrite": f"[FAILED AFTER {MAX_RETRIES} RETRIES] {reason}\n{state['rewrite']}",
            "retries": retries,
        }

    return {"step": "finalize", "retries": retries}


def finalize_page(state: State) -> State:
    page = state["current_page"]
    report = dict(state.get("report", {}))
    report[page] = {
        "analysis": state["analysis"],
        "rewrite": state["rewrite"],
    }

    next_index = state["page_index"] + 1
    if next_index < len(state["pages"]):
        return {
            "page_index": next_index,
            "current_page": None,
            "html": "",
            "step": "fetch",
            "analysis": "",
            "rewrite": "",
            "retries": {},
            "report": report,
        }

    return {"step": "done", "report": report}


graph = StateGraph(State)
graph.add_node("fetch", fetch_page)
graph.add_node("analyze", analyze_page)
graph.add_node("check_analysis", check_analysis)
graph.add_node("rewrite", rewrite_page)
graph.add_node("check_rewrite", check_rewrite)
graph.add_node("finalize", finalize_page)

graph.add_edge(START, "fetch")
graph.add_edge("fetch", "analyze")
graph.add_edge("analyze", "check_analysis")
graph.add_edge("rewrite", "check_rewrite")

graph.add_conditional_edges(
    "check_analysis",
    lambda state: "rewrite" if state["step"] == "rewrite" else "analyze",
    {"rewrite": "rewrite", "analyze": "analyze"},
)
graph.add_conditional_edges(
    "check_rewrite",
    lambda state: "finalize" if state["step"] == "finalize" else "rewrite",
    {"finalize": "finalize", "rewrite": "rewrite"},
)
graph.add_conditional_edges(
    "finalize",
    lambda state: END if state["step"] == "done" else "fetch",
    {END: END, "fetch": "fetch"},
)

app = graph.compile()

if __name__ == "__main__":
    # Tip: start with ["/"] to test one page. The free model is slow,
    # so visiting every page can take a long time.
    result = app.invoke(
        {
            "base_url": "http://localhost:3000",
            "pages": ["/"],
            "page_index": 0,
            "current_page": None,
            "html": "",
            "step": "fetch",
            "retries": {},
            "analysis": "",
            "rewrite": "",
            "report": {},
        }
    )

    for page, data in result["report"].items():
        print(f"\n{'=' * 60}")
        print(f"PAGE: {page}")
        print(f"{'=' * 60}")
        print("\n--- ANALYSIS ---")
        print(data["analysis"])
        print("\n--- REWRITE ---")
        print(data["rewrite"])
