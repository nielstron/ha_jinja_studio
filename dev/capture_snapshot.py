"""Capture entity states over SSH without persisting or printing auth tokens."""

import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

REMOTE = """
import json, urllib.request, urllib.parse
from pathlib import Path
a=json.loads(Path('/home/niels/homeassistant/config/.storage/auth').read_text())['data']
owner=next(u['id'] for u in a['users'] if u['is_owner'])
refresh=next(t for t in a['refresh_tokens'] if t['user_id']==owner and t.get('client_id')=='http://homeassistant-64:8123/')
body=urllib.parse.urlencode({'grant_type':'refresh_token','refresh_token':refresh['token'],'client_id':refresh['client_id']}).encode()
base='http://127.0.0.1:8123'
with urllib.request.urlopen(urllib.request.Request(base+'/auth/token',data=body),timeout=30) as response:
    access=json.load(response)['access_token']
with urllib.request.urlopen(urllib.request.Request(base+'/api/states',headers={'Authorization':'Bearer '+access}),timeout=30) as response:
    print(response.read().decode())
"""

result = subprocess.run(
    ["ssh", "-o", "ConnectTimeout=10", "niels@homeassistant-64", "sudo -n python3 -"],
    input=REMOTE,
    capture_output=True,
    text=True,
    check=True,
)
states = json.loads(result.stdout)
snapshot = {"captured_at": datetime.now(UTC).isoformat(), "states": states}
destination = Path(__file__).resolve().parents[1] / ".dev" / "states.json"
destination.parent.mkdir(exist_ok=True)
destination.write_text(json.dumps(snapshot, indent=2))
destination.chmod(0o600)
print(f"Captured {len(states)} entities to {destination} (gitignored).")
