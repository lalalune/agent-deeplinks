import json
import os
import pathlib
import re
import shlex
import subprocess
import sys
import time
from urllib.parse import parse_qsl, quote, urlencode, urlsplit
from xml.etree import ElementTree

root = pathlib.Path(sys.argv[1])
adb, serial, package = sys.argv[2:]
activity = f'{package}/ai.opencode.app.MainActivity'
args = '-a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d '
fixture = json.loads((root / 'A/session-fixture.json').read_text())
issued = (root / 'A/issuer.private').read_text()
matches = re.findall(r"(?m)^\s*" + re.escape(fixture['address']) + r"/auth/connect/([A-Za-z0-9_-]+)\s*$", issued)
assert len(matches) == 1, 'Pairing issuer did not return one matching sandbox code'
code = matches[0]
proof = {
    'certificate': os.environ['DEEPLINKS_QA_CERT'],
    'client': 'Anomaly OpenCode 0.8.13 upstream release AAB with disposable test signing',
    'server': 'One isolated OpenCode 2.4.2 server reachable at two runner loopback ports',
    'pair': {},
    'libraryVersion': '0.1.69',
    'libraryGitCommit': (root / 'evidence/sdk-git-commit.txt').read_text().strip(),
    'observations': {},
}


def persist():
    (root / 'proof.json').write_text(json.dumps(proof, indent=2) + '\n')


def library_link(options, platform='android', allow_missing=False):
    build = """
      import { pathToFileURL } from 'node:url';
      const { getAgentLink, getOpenCodeAndroidPairingLink } = await import(pathToFileURL(process.argv[1]));
      const options = JSON.parse(process.argv[2]);
      const link = getAgentLink('opencode', process.argv[3], options);
      if (options.action === 'server-pair' && link !== getOpenCodeAndroidPairingLink(options.target)) {
        throw new Error('OpenCode pairing entry points disagree');
      }
      process.stdout.write(JSON.stringify(link));
    """
    try:
        result = json.loads(subprocess.check_output([
            os.environ['DEEPLINKS_QA_NODE'], '--input-type=module', '-e', build, os.environ['DEEPLINKS_QA_LIBRARY'],
            json.dumps(options), platform,
        ], text=True, timeout=16, stderr=subprocess.STDOUT))
        assert result or allow_missing
        return result
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise RuntimeError('Library did not create the expected sandbox route') from None


def android(*command):
    try:
        return subprocess.check_output([adb, '-s', serial, *command], timeout=20, stderr=subprocess.STDOUT)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        raise RuntimeError('Targeted Android command failed before evidence capture') from None


def save(name, data):
    value = data.decode(errors='replace')
    value = value.replace(code, '[redacted]')
    (root / name).write_text(value)
    return value


def view(name):
    path = '/sdcard/opencode-loopback-qa.xml'
    android('shell', 'uiautomator', 'dump', path)
    raw = android('exec-out', 'cat', path)
    save(f'{name}.xml', raw)
    return list(ElementTree.fromstring(raw).iter('node'))


def image(name):
    (root / f'{name}.png').write_bytes(android('exec-out', 'screencap', '-p'))


def tap(node):
    bounds = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', node.get('bounds', ''))
    assert bounds
    left, top, right, bottom = map(int, bounds.groups())
    assert right > left and bottom > top
    android('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))


def deliver(name, uri, scope_app=False):
    command = args + shlex.quote(uri)
    if scope_app:
        command += ' -p ' + shlex.quote(package)
    resolved = save(f'{name}-resolved.txt', android('shell', f'cmd package resolve-activity --brief {command}'))
    assert activity in resolved, 'Stock resolver did not select OpenCode'
    started = save(f'{name}-dispatch.txt', android('shell', f'am start -W {command}'))
    assert 'Status: ok' in started and activity in started, 'Android did not dispatch the URI to OpenCode'
    return started


def pair(display_name):
    address = fixture['address']
    alternate_port = int((root / 'alternate-port.txt').read_text())
    alternate = f'http://10.0.2.2:{alternate_port}'
    endpoints = [urlsplit(origin).netloc for origin in (address, alternate)]
    assert len(set(endpoints)) == 2
    probes = {}
    for origin in (address, alternate):
        port = urlsplit(origin).port
        probe = android('shell', fr"printf 'GET /api/info HTTP/1.1\r\nHost: 10.0.2.2:{port}\r\nConnection: close\r\n\r\n' | toybox nc -w 4 10.0.2.2 {port}")
        status_line = probe.decode(errors='replace').splitlines()[0]
        assert re.fullmatch(r'HTTP/1\.[01] [0-9]{3} .+', status_line), 'Expected HTTP from each loopback listener'
        probes[origin] = status_line
    assert len(set(probes.values())) == 1, 'Both aliases should reach the same OpenCode HTTP endpoint'
    items = [('code', code), ('url', address), ('url', alternate), ('name', display_name)]
    # The tagged Copy/Share producer leaves the origin's colon and slashes visible.
    source = 'opencode-ios://pair?' + urlencode(items, quote_via=quote, safe=':/')
    uri = library_link({'action': 'server-pair', 'target': source})
    assert uri == 'opencode://pair?' + urlencode(items, quote_via=quote)
    assert parse_qsl(urlsplit(uri).query) == items
    android('shell', 'am', 'force-stop', package)
    assert not android('shell', 'pidof ' + shlex.quote(package) + ' || true').strip()
    proof['pair'] = {
        'source': source.replace(code, '[redacted]'),
        'dispatched': uri.replace(code, '[redacted]'),
        'decodedOriginsInOrder': [address, alternate],
        'displayName': display_name,
        'originProbes': probes,
        'processAbsentBeforeDispatch': True,
        'packageScoped': False,
        'confirmed': False,
    }
    persist()
    started = deliver('pair-A', uri)
    assert 'LaunchState: COLD' in started
    proof['pair'].update(defaultsToOpenCode=True, cold=True)
    persist()
    expected_message = f'OpenCode will try {endpoints[0]} and {endpoints[1]} and switch to the first that answers.'
    for _ in range(18):
        time.sleep(1)
        nodes = view('review-A')
        labels = {node.get('text', '') for node in nodes}
        buttons = [node for node in nodes if node.get('text') == 'Pair']
        if f'Pair with {endpoints[0]}?' in labels and expected_message in labels and len(buttons) == 1 and 'Cancel' in labels:
            image('review-A')
            proof['pair']['reviewText'] = expected_message
            tap(buttons[0])
            proof['pair']['confirmed'] = True
            persist()
            return
        wait = [node for node in nodes if node.get('resource-id') == 'android:id/aerr_wait']
        if "System UI isn't responding" in labels and len(wait) == 1:
            tap(wait[0])
    image('review-A-missing')
    raise RuntimeError('Expected pairing confirmation showing both exact endpoints')

def observe(name, predicate):
    for _ in range(12):
        time.sleep(1)
        labels = {node.get('text') or node.get('content-desc') or '' for node in view(name)
                  if node.get('package') == package} - {''}
        proof['observations'][name] = sorted(labels)
        persist()
        if predicate(labels):
            image(name)
            return True
    image(name)
    return False


display_name = 'OpenCode QA + Café'
pair(display_name)
assert observe('initial-A', lambda labels: { 'OpenCode A Default', 'OpenCode A Target' } <= labels), (
    'Pairing did not load both scratch projects'
)
drawer_buttons = [
    node for node in view('drawer-closed')
    if node.get('package') == package and node.get('content-desc') == 'Open sessions'
]
assert len(drawer_buttons) == 1, 'Expected the native session drawer button'
tap(drawer_buttons[0])
assert observe('paired-label-A', lambda labels: display_name in labels and 'Close session list' in labels), (
    'The paired server drawer did not display the exact SDK label'
)
proof['pair']['savedLabelVisible'] = True
persist()

print('Cold-opened the exact feature SDK link, reviewed both addresses, and paired the isolated server. The exact provided name is visible in the Android drawer.')
