"""Capture the available HA actions without running them or storing credentials."""

import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

REMOTE = """
import json, urllib.request, urllib.parse
from pathlib import Path
auth=json.loads(Path('/home/niels/homeassistant/config/.storage/auth').read_text())['data']
owner=next(user['id'] for user in auth['users'] if user['is_owner'])
refresh=next(token for token in auth['refresh_tokens'] if token['user_id']==owner and token.get('client_id')=='http://homeassistant-64:8123/')
body=urllib.parse.urlencode({'grant_type':'refresh_token','refresh_token':refresh['token'],'client_id':refresh['client_id']}).encode()
base='http://127.0.0.1:8123'
with urllib.request.urlopen(urllib.request.Request(base+'/auth/token',data=body),timeout=30) as response:
    access=json.load(response)['access_token']
with urllib.request.urlopen(urllib.request.Request(base+'/api/services',headers={'Authorization':'Bearer '+access}),timeout=30) as response:
    print(response.read().decode())
"""

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
    input=REMOTE,
    capture_output=True,
    text=True,
    check=True,
    timeout=65,
)
services = {entry["domain"]: entry["services"] for entry in json.loads(result.stdout)}
destination = Path(__file__).resolve().parents[1] / ".dev" / "services.json"
destination.parent.mkdir(exist_ok=True)
destination.write_text(
    json.dumps(
        {"captured_at": datetime.now(UTC).isoformat(), "services": services}, indent=2
    )
)
destination.chmod(0o600)
print(
    f"Captured {sum(len(items) for items in services.values())} actions to {destination} (gitignored)."
)
