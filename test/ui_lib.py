import subprocess, tempfile, time, os, re, json, signal, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.environ.get('SHOTS', '/tmp/kv-shots')
os.makedirs(SHOTS, exist_ok=True)
CODE = 'TEST-CODE-1234-ABCD'

class Server:
    def __init__(self, port):
        self.port = port
        self.dir = tempfile.mkdtemp(prefix='kv-ui-')
        env = dict(os.environ, PORT=str(port))
        self.p = subprocess.Popen(['node', os.path.join(ROOT, 'test', 'server.mjs')], env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        line = self.p.stdout.readline()
        m = re.search(r'listening (\S+) data in (\S+)', line)
        assert m, line
        self.url, self.dir = m.group(1), m.group(2)
    def stop(self):
        self.p.send_signal(signal.SIGTERM); self.p.wait(5)
    def api(self, path):
        return json.load(urllib.request.urlopen(self.url + path))

def watch(page, log):
    page.on('console', lambda m: log.append(('console.' + m.type, m.text)) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: log.append(('pageerror', str(e))))
    page.on('requestfailed', lambda r: log.append(('requestfailed', r.url + ' ' + str(r.failure))) if 'fonts.g' not in r.url else None)

class Checks:
    def __init__(self): self.n = 0; self.bad = []
    def ok(self, cond, msg):
        self.n += 1
        print(('  ok   ' if cond else '  FAIL ') + msg)
        if not cond: self.bad.append(msg)
    def done(self):
        print('\n%d checks, %d failed' % (self.n, len(self.bad)))
        for b in self.bad: print('   -', b)
        return not self.bad
