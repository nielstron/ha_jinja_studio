"""Local editor, snapshot preview, and explicitly requested read-only forecasts."""

import asyncio
import json
import math
import re
import statistics
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

from aiohttp import web
from jinja2 import StrictUndefined
from jinja2.sandbox import ImmutableSandboxedEnvironment

ROOT = Path(__file__).resolve().parents[1]


class States:
    unsafe_callable = False
    alters_data = False
    jinja_pass_arg = None

    def __init__(self, states):
        self.values = {
            s["entity_id"]: SimpleNamespace(
                **{**s, "name": s["attributes"].get("friendly_name", s["entity_id"])}
            )
            for s in states
        }

    def __call__(self, entity_id, rounded=False, with_unit=False):
        state = self.values.get(entity_id)
        if state is None:
            return "unknown"
        result = state.state
        if with_unit and state.attributes.get("unit_of_measurement"):
            result += " " + state.attributes["unit_of_measurement"]
        return result

    def __iter__(self):
        return iter(self.values.values())

    def __getattr__(self, domain):
        return DomainStates(self.values, domain)

    def __getitem__(self, entity_id):
        return self.values.get(entity_id)


class DomainStates:
    def __init__(self, states, domain):
        self.states = states
        self.domain = domain

    def __iter__(self):
        return (
            s for key, s in self.states.items() if key.startswith(self.domain + ".")
        )

    def __getattr__(self, name):
        return self.states.get(self.domain + "." + name)


def environment(snapshot):
    states = States(snapshot["states"])
    env = ImmutableSandboxedEnvironment(
        undefined=StrictUndefined, extensions=["jinja2.ext.loopcontrols"]
    )

    def state_attr(entity_id, attribute):
        entity = states.values.get(entity_id)
        return entity.attributes.get(attribute) if entity else None

    def expand(*entities):
        result = {}

        def visit(item):
            if isinstance(item, (list, tuple)):
                for value in item:
                    visit(value)
            elif isinstance(item, str):
                if item in result:
                    return
                state = states.values.get(item)
                if state:
                    result[item] = state
                    if item.startswith("group."):
                        for member in state.attributes.get("entity_id", []):
                            visit(member)
            else:
                result[item.entity_id] = item

        for entity in entities:
            visit(entity)
        return sorted(result.values(), key=lambda s: s.entity_id)

    def bounded_range(*args):
        result = range(*args)
        if len(result) > 10000:
            raise ValueError("Snapshot preview is limited to 10,000 range items.")
        return result

    env.globals.update(
        states=states,
        state_attr=state_attr,
        is_state=lambda entity, value: states(entity) == value,
        is_state_attr=lambda entity, attr, value: state_attr(entity, attr) == value,
        has_value=lambda entity: states(entity) not in ("unknown", "unavailable"),
        expand=expand,
        range=bounded_range,
        now=lambda: datetime.now().astimezone(),
        utcnow=lambda: datetime.now(UTC),
        pi=math.pi,
        e=math.e,
        as_timestamp=lambda value: datetime.fromisoformat(str(value)).timestamp(),
    )
    env.filters.update(
        log=math.log,
        sin=math.sin,
        cos=math.cos,
        tan=math.tan,
        asin=math.asin,
        acos=math.acos,
        atan=math.atan,
        average=lambda values: statistics.mean(float(v) for v in values),
        median=lambda values: statistics.median(float(v) for v in values),
        statistical_mode=statistics.mode,
        from_json=json.loads,
        to_json=json.dumps,
        regex_replace=lambda value, pattern, replacement="", ignorecase=False: re.sub(
            pattern, replacement, str(value), flags=re.IGNORECASE if ignorecase else 0
        ),
        regex_findall=lambda value, pattern, ignorecase=False: re.findall(
            pattern, str(value), flags=re.IGNORECASE if ignorecase else 0
        ),
        timestamp_custom=lambda value, format, local=True: datetime.fromtimestamp(
            float(value), tz=None if local else UTC
        ).strftime(format),
    )
    return env


async def index(request):
    return web.FileResponse(ROOT / "dev" / "index.html")


async def snapshot(request):
    return web.json_response(json.loads((ROOT / ".dev" / "states.json").read_text()))


async def demo(request):
    return web.json_response(json.loads((ROOT / "dev" / "demo.json").read_text()))


async def services(request):
    location = ROOT / ".dev" / "services.json"
    if not location.exists():
        return web.json_response(
            {
                "error": "Run uv run python dev/capture_services.py to capture your available actions."
            },
            status=503,
        )
    return web.json_response(json.loads(location.read_text())["services"])


async def render(request):
    body = await request.json()
    source = (
        ROOT / "dev" / "demo.json"
        if body.get("demo")
        else ROOT / ".dev" / "states.json"
    )
    data = json.loads(source.read_text())
    try:
        env = environment(data)
        result = await asyncio.to_thread(
            env.from_string(body["template"]).render, **body.get("variables", {})
        )
        return web.json_response({"result": result})
    except Exception as error:  # noqa: BLE001 - surface user-authored template errors
        # User-authored templates can legitimately be invalid; surface the error.
        return web.json_response(
            {"error": f"{type(error).__name__}: {error}"}, status=400
        )


async def projects(request):
    body = await request.json()
    location = ROOT / ".dev" / "projects.json"
    data = json.loads(location.read_text()) if location.exists() else {}
    if body["action"] == "save":
        data[body["project_id"]] = body["project"]
        location.write_text(json.dumps(data, indent=2))
        location.chmod(0o600)
    elif body["action"] == "delete":
        del data[body["project_id"]]
        location.write_text(json.dumps(data, indent=2))
    return web.json_response(data)


def fetch_forecast(message):
    """Only allow read-only weather forecasts through the local SSH bridge."""
    if message["domain"] != "weather" or message["service"] != "get_forecasts":
        raise ValueError(
            "Local fetching only supports weather.get_forecasts. Paste a sample for other actions."
        )
    entity = message["target"]["entity_id"]
    forecast_type = message["service_data"]["type"]
    if not isinstance(entity, str) or not re.fullmatch(r"weather\.[a-z0-9_]+", entity):
        raise ValueError("Select a weather entity.")
    if forecast_type not in ("hourly", "daily", "twice_daily"):
        raise ValueError("Forecast type must be hourly, daily, or twice_daily.")
    payload = {"entity_id": entity, "type": forecast_type}
    remote = """
import json, urllib.request, urllib.parse
from pathlib import Path
auth = json.loads(Path('/home/niels/homeassistant/config/.storage/auth').read_text())['data']
owner = next(user['id'] for user in auth['users'] if user['is_owner'])
refresh = next(token for token in auth['refresh_tokens'] if token['user_id'] == owner and token.get('client_id') == 'http://homeassistant-64:8123/')
body = urllib.parse.urlencode({'grant_type':'refresh_token','refresh_token':refresh['token'],'client_id':refresh['client_id']}).encode()
base = 'http://127.0.0.1:8123'
with urllib.request.urlopen(urllib.request.Request(base+'/auth/token', data=body), timeout=30) as response:
    access = json.load(response)['access_token']
payload = json.loads(PAYLOAD)
request = urllib.request.Request(base+'/api/services/weather/get_forecasts?return_response', data=json.dumps(payload).encode(), headers={'Authorization':'Bearer '+access,'Content-Type':'application/json'})
with urllib.request.urlopen(request, timeout=45) as response:
    print(response.read().decode())
""".replace("PAYLOAD", repr(json.dumps(payload)))
    result = subprocess.run(
        [
            "ssh",
            "-o",
            "BatchMode=yes",
            "-o",
            "ConnectTimeout=10",
            "niels@homeassistant-64",
            "sudo -n python3 -",
        ],
        input=remote,
        capture_output=True,
        text=True,
        timeout=65,
        check=True,
    )
    return {"response": json.loads(result.stdout)["service_response"]}


async def action_sample(request):
    try:
        return web.json_response(
            await asyncio.to_thread(fetch_forecast, await request.json())
        )
    except Exception as error:  # noqa: BLE001 - show explicit fetch failures in the editor
        return web.json_response({"error": str(error)}, status=400)


app = web.Application(client_max_size=2 * 1024 * 1024)
app.router.add_get("/", index)
app.router.add_get("/api/states", snapshot)
app.router.add_get("/api/demo", demo)
app.router.add_get("/api/services", services)
app.router.add_post("/api/render", render)
app.router.add_post("/api/projects", projects)
app.router.add_post("/api/action-sample", action_sample)
app.router.add_static(
    "/jinja_studio_static",
    ROOT / "custom_components" / "jinja_studio" / "frontend",
)

if __name__ == "__main__":
    web.run_app(app, host="127.0.0.1", port=8766)
