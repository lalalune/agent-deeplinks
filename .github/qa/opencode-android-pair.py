import base64
import json
import os
import pathlib
import re
import shlex
import subprocess
import sys
import time
from urllib.parse import quote, urlencode, urlsplit
from xml.etree import ElementTree

root = pathlib.Path(sys.argv[1])
adb, serial, package = sys.argv[2:]
activity = f'{package}/ai.opencode.app.MainActivity'
args = '-a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d '
fixtures = {
    name: json.loads((root / name / 'session-fixture.json').read_text())
    for name in ('A', 'B')
}
codes = {}
for name, fixture in fixtures.items():
    issued = (root / name / 'issuer.private').read_text()
    matches = re.findall(r"(?m)^\s*" + re.escape(fixture['address']) + r"/auth/connect/([A-Za-z0-9_-]+)\s*$", issued)
    assert len(matches) == 1, 'Pairing issuer did not return one matching sandbox code'
    codes[name] = matches[0]
pair_payloads = {}
assert fixtures['A']['key'] != fixtures['B']['key']
proof = {
    'certificate': os.environ['DEEPLINKS_QA_CERT'],
    'client': 'Anomaly OpenCode 0.8.13 upstream release AAB with disposable test signing',
    'server': 'Two isolated OpenCode 2.4.2 servers',
    'pairs': {},
    'routes': {},
    'libraryVersion': '0.1.68',
    'observations': {},
}


def persist():
    (root / 'proof.json').write_text(json.dumps(proof, indent=2) + '\n')


def library_link(options, platform='android', allow_missing=False):
    build = """
      import { pathToFileURL } from 'node:url';
      const { getAgentLink } = await import(pathToFileURL(process.argv[1]));
      const link = getAgentLink('opencode', process.argv[3], JSON.parse(process.argv[2]));
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
    for code in codes.values():
        value = value.replace(code, '[redacted]')
    for payload in pair_payloads.values():
        value = value.replace(payload, '[redacted]')
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


def pair(name):
    fixture = fixtures[name]
    address, code = fixture['address'], codes[name]
    scoped = name == 'B'
    if scoped:
        bridge = json.dumps({'code': code, 'urls': [address]}, separators=(',', ':')).encode()
        payload = base64.urlsafe_b64encode(bridge).decode().rstrip('=')
        pair_payloads[name] = payload
        uri = 'https://opencode.ai/pair#' + payload
        redacted = 'https://opencode.ai/pair#[redacted]'
    else:
        uri = 'opencode-ios://pair?' + urlencode([('code', code), ('url', address)], quote_via=quote)
        redacted = uri.replace(code, '[redacted]')
    assert library_link({'action': 'server-pair', 'target': uri}, allow_missing=True) is None
    command = args + shlex.quote(uri)
    default_resolution = save(f'pair-{name}-default-resolution.txt',
        android('shell', f'cmd package resolve-activity --brief {command}'))
    defaults_to_open_code = activity in default_resolution
    assert defaults_to_open_code != scoped, 'OpenCode did not produce the expected stock Android default resolution'
    if scoped:
        possible_activities = save('vendor-pair-page-possible-activities.txt',
            android('shell', f'cmd package query-activities --brief {command} -p {shlex.quote(package)}'))
        assert activity in possible_activities
    deliver(f'pair-{name}', uri, scope_app=scoped)
    endpoint = urlsplit(address).netloc
    proof['pairs'][name] = {'endpoint': endpoint, 'confirmed': False, 'uri': redacted,
        'defaultsToOpenCode': defaults_to_open_code, 'restrictedPackageForParsingOnly': scoped,
        'currentSdkAcceptsInput': False}
    persist()
    for _ in range(18):
        time.sleep(1)
        nodes = view(f'review-{name}')
        labels = {node.get('text', '') for node in nodes}
        buttons = [node for node in nodes if node.get('text') == 'Pair']
        if f'Pair with {endpoint}?' in labels and len(buttons) == 1 and 'Cancel' in labels:
            image(f'review-{name}')
            tap(buttons[0])
            proof['pairs'][name]['confirmed'] = True
            persist()
            return
        wait = [node for node in nodes if node.get('resource-id') == 'android:id/aerr_wait']
        if "System UI isn't responding" in labels and len(wait) == 1:
            tap(wait[0])
    image(f'review-{name}-missing')
    raise RuntimeError('Expected exact loopback pairing confirmation')


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


def verify(name, uri, predicate, cold=False):
    proof['routes'][name] = {'url': uri, 'destinationVisible': False}
    persist()
    if cold:
        android('shell', 'am', 'force-stop', package)
        assert not android('shell', 'pidof ' + shlex.quote(package) + ' || true').strip()
        proof['routes'][name]['processAbsentBeforeDispatch'] = True
    dispatch = deliver(name, uri)
    if cold:
        assert 'LaunchState: COLD' in dispatch, 'Android did not report a cold OpenCode launch'
        proof['routes'][name]['cold'] = True
    proof['routes'][name]['destinationVisible'] = observe(name, predicate)
    persist()
    assert proof['routes'][name]['destinationVisible'], f'Expected native destination for {name}'


def idle(title, project):
    return lambda labels: (
        {title, f'{title}, {project}'} & labels and
        {'No messages yet', 'Message'} <= labels
    )


def draft(project):
    return lambda labels: {f'New Session, {project}', 'Message', 'Open sessions'} <= labels


pair('A')
assert observe('initial-A', lambda labels: { 'OpenCode A Default', 'OpenCode A Target' } <= labels), (
    'First pair did not load both server A projects'
)
pair('B')
fixture_b = fixtures['B']['default']
assert observe('initial-B', lambda labels: {
    'Close session list', fixture_b['title']
} <= labels), 'Second pair did not open the sessions for server B'
rows = [
    node for node in view('session-list-B')
    if node.get('package') == package and node.get('clickable') == 'true'
    and (node.get('text') or node.get('content-desc')) == fixture_b['title']
]
assert len(rows) == 1, 'Expected the exact sandbox session in server B Recents'
tap(rows[0])
assert observe('existing-B', idle(fixture_b['title'], 'OpenCode B Default')), (
    'Selecting server B Recents did not reveal the expected empty session'
)

fixture_a = fixtures['A']
source_uri = f"opencode://session/{fixture_a['default']['id']}?server={fixture_a['key']}"
scoped_a = library_link({'session': source_uri})
assert scoped_a == source_uri
verify('scoped-A', scoped_a, idle(fixture_a['default']['title'], 'OpenCode A Default'), cold=True)

browser = library_link({'server': fixture_a['address'], 'session': fixture_a['default']['id']}, 'web')
origin_key = base64.urlsafe_b64encode(fixture_a['address'].encode()).decode().rstrip('=')
assert browser == fixture_a['address'] + '/server/' + origin_key + '/session/' + fixture_a['default']['id']
assert browser == library_link({'server': fixture_a['address'], 'session': browser}, 'ios')
web_resolvers = save('browser-resolved.txt', android('shell',
    f'cmd package query-activities --brief {args}{shlex.quote(browser)}'))
assert activity not in web_resolvers
assert package not in web_resolvers
proof['browserRoute'] = {
    'url': browser, 'sameSavedSessionId': True, 'openCodeAbsentFromResolver': True,
    'resolverOutput': web_resolvers.strip().splitlines(),
}
persist()

project = fixture_a['target']['project']
project_uri = library_link({'mode': 'new', 'project': project})
assert project_uri == 'opencode://new-session?project=' + quote(project, safe="-_.!~*'()")
verify('project-draft-A', project_uri, draft('OpenCode A Target'))
print('Opened server B, cold-started OpenCode into the exact scoped server A session, and opened its non-default project draft. Stock Android did not route the corresponding browser URL to OpenCode.')
