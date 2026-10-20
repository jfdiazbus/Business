from typing import TypedDict
from urllib.request import urlopen
from urllib.error import URLError, HTTPError
from langgraph.graph import StateGraph, START, END


class State(TypedDict):
    base_url: str
    pages: list[str]
    index: int
    current_page: str | None
    results: list[dict]


def planner(state: State) -> State:
    """Pick the next page to visit, or signal that the loop is done."""
    pages = state["pages"]
    index = state["index"]

    if index < len(pages):
        return {
            "current_page": pages[index],
            "index": index + 1,
        }

    return {"current_page": None}


def should_continue(state: State) -> str:
    """Route to the worker while there are still pages left."""
    return "worker" if state["current_page"] is not None else END


def worker(state: State) -> State:
    """Fetch the current page and record the outcome."""
    page = state["current_page"]
    base_url = state["base_url"].rstrip("/")
    url = f"{base_url}{page}"

    try:
        with urlopen(url, timeout=10) as response:
            body = response.read()
            result = {
                "page": page,
                "url": url,
                "status": response.status,
                "bytes": len(body),
            }
    except HTTPError as error:
        result = {
            "page": page,
            "url": url,
            "status": error.code,
            "bytes": 0,
            "error": str(error.reason),
        }
    except URLError as error:
        result = {
            "page": page,
            "url": url,
            "status": None,
            "bytes": 0,
            "error": str(error.reason),
        }

    return {"results": state["results"] + [result]}


graph = StateGraph(State)
graph.add_node("planner", planner)
graph.add_node("worker", worker)
graph.add_edge(START, "planner")
graph.add_conditional_edges(
    "planner",
    should_continue,
    {"worker": "worker", END: END},
)
graph.add_edge("worker", "planner")

app = graph.compile()

if __name__ == "__main__":
    result = app.invoke({
        "base_url": "http://localhost:3000",
        "pages": ["/", "/home", "/school", "/services", "/thanks"],
        "index": 0,
        "current_page": None,
        "results": [],
    })

    for item in result["results"]:
        status = item.get("status")
        status_label = status if status is not None else "ERR"
        error = item.get("error")
        error_note = f" ({error})" if error else ""
        print(f'{status_label:4} {item["bytes"]:6} bytes  {item["page"]:12} {item["url"]}{error_note}')
