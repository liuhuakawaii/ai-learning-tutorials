import time
from fastapi import FastAPI, Request, Response

_metrics = {
    "requests_total": 0,
    "requests_by_path": {},
    "request_duration_seconds": [],
    "errors_total": 0,
}


def setup_metrics(app: FastAPI):
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        start = time.perf_counter()
        _metrics["requests_total"] += 1

        path = request.url.path
        path_key = path
        for prefix in [
            "/api/v1/chat/sessions/",
            "/api/v1/agents/",
            "/api/v1/knowledge/",
            "/api/v1/workflows/",
            "/api/v1/skills/",
        ]:
            if path.startswith(prefix) and len(path) > len(prefix):
                path_key = prefix + "{id}"
                break

        _metrics["requests_by_path"][path_key] = (
            _metrics["requests_by_path"].get(path_key, 0) + 1
        )

        try:
            response = await call_next(request)
            duration = time.perf_counter() - start
            _metrics["request_duration_seconds"].append(duration)
            if len(_metrics["request_duration_seconds"]) > 10000:
                _metrics["request_duration_seconds"] = _metrics[
                    "request_duration_seconds"
                ][-5000:]
            return response
        except Exception:
            _metrics["errors_total"] += 1
            raise

    @app.get("/metrics")
    async def metrics():
        durations = _metrics["request_duration_seconds"]
        avg_duration = sum(durations) / len(durations) if durations else 0
        p95_duration = (
            sorted(durations)[int(len(durations) * 0.95)]
            if len(durations) > 1
            else 0
        )

        lines = [
            "# HELP http_requests_total Total HTTP requests",
            "# TYPE http_requests_total counter",
            f"http_requests_total {_metrics['requests_total']}",
            "",
            "# HELP http_request_duration_seconds HTTP request duration",
            "# TYPE http_request_duration_seconds summary",
            f"http_request_duration_seconds_count {len(durations)}",
            f"http_request_duration_seconds_sum {sum(durations):.3f}",
            f"http_request_duration_seconds_avg {avg_duration:.3f}",
            f"http_request_duration_seconds_p95 {p95_duration:.3f}",
            "",
            "# HELP http_errors_total Total HTTP errors",
            "# TYPE http_errors_total counter",
            f"http_errors_total {_metrics['errors_total']}",
            "",
            "# HELP http_requests_by_path Total requests by path",
            "# TYPE http_requests_by_path counter",
        ]
        for p, count in sorted(_metrics["requests_by_path"].items()):
            lines.append(f'http_requests_by_path{{path="{p}"}} {count}')

        return Response(content="\n".join(lines), media_type="text/plain")
