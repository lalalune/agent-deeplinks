import base64
import hashlib
import json
import pathlib
import sys
import urllib.request
from urllib.parse import urlsplit

qa, port, fixture = pathlib.Path(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
registration = json.loads((qa / 'state/opencode/service.json').read_text())
base = f'http://127.0.0.1:{port}'
address = f'http://10.0.2.2:{port}'
assert registration['url'].rstrip('/') == base
auth = base64.b64encode(f"opencode:{registration['password']}".encode()).decode()
headers = {'Authorization': f'Basic {auth}', 'Content-Type': 'application/json'}


def request(path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(urllib.request.Request(base + path, headers=headers, data=data), timeout=18) as response:
        result = json.load(response)
    return result.get('data', result) if isinstance(result, dict) else result


reported = request('/api/info').get('urls', [])
origins = {address}
for url in reported:
    parsed = urlsplit(url)
    if parsed.scheme in {'https', 'http'} and parsed.hostname not in {'localhost', '127.0.0.1', '::1'}:
        origins.add(url.rstrip('/'))
key = hashlib.sha256('|'.join(['opencode', *sorted(origins)]).encode()).hexdigest()[:12]
fixtures = {'address': address, 'key': key}


def seed(name):
    project = str((qa / f'OpenCode {fixture} {name}').resolve())
    label = f'OpenCode {fixture} {name} idle session'
    session = request('/api/session', {'location': {'directory': project}, 'title': label})
    assert session['title'] == label
    return {'title': label, 'id': session['id'], 'project': session['projectID']}


fixtures['default'] = seed('Default')
if fixture == 'A':
    fixtures['target'] = seed('Target')
    assert fixtures['default']['project'] != fixtures['target']['project']
    assert fixtures['target']['project'] in {item['id'] for item in request('/api/project')}
(qa / 'session-fixture.json').write_text(json.dumps(fixtures) + '\n')
