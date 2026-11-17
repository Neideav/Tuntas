import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const OUTPUT_DIR = 'C:\\Users\\Pongo\\.gemini\\antigravity\\brain\\6c88418c-57d1-4dda-b8bb-68847c6d7f5d';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Launching Chrome in headless mode with remote debugging...');
  const profileDir = path.join(OUTPUT_DIR, 'chrome_profile');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profileDir}`,
    '--window-size=1440,900',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ], { detached: false });

  chromeProc.stdout.on('data', d => console.log('[Chrome stdout]', d.toString()));
  chromeProc.stderr.on('data', d => console.log('[Chrome stderr]', d.toString()));

  await sleep(1500);

  try {
    const versionRes = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    const versionData = await versionRes.json();
    console.log('Chrome connected. Browser:', versionData.Browser);

    const listRes = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const tabs = await listRes.json();
    const wsUrl = tabs[0]?.webSocketDebuggerUrl || versionData.webSocketDebuggerUrl;
    console.log('WebSocket Debugger URL:', wsUrl);

    const ws = new WebSocket(wsUrl);
    let id = 1;
    const callbacks = new Map();

    let loadFired = false;
    let resolveLoad;
    const loadPromise = new Promise(resolve => resolveLoad = resolve);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'Page.loadEventFired') {
        loadFired = true;
        resolveLoad();
      }
      if (msg.id && callbacks.has(msg.id)) {
        callbacks.get(msg.id)(msg.result);
        callbacks.delete(msg.id);
      }
    };

    await new Promise((resolve) => ws.onopen = resolve);

    function send(method, params = {}) {
      return new Promise((resolve) => {
        const reqId = id++;
        callbacks.set(reqId, resolve);
        ws.send(JSON.stringify({ id: reqId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Network.enable');

    console.log('Navigating to http://localhost:3000/login...');
    await send('Page.navigate', { url: 'http://localhost:3000/login' });

    console.log('Waiting for page load event...');
    await loadPromise;
    console.log('Page loaded! Starting exact timestamp capture sequence...');

    const startTime = Date.now();

    async function takeScreenshot(label, filename) {
      console.log(`[${((Date.now() - startTime) / 1000).toFixed(2)}s] Taking screenshot for ${label}...`);
      const res = await send('Page.captureScreenshot', { format: 'png' });
      if (res && res.data) {
        const outPath = path.join(OUTPUT_DIR, filename);
        fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
        console.log(`Saved: ${outPath}`);
      }
    }

    // Capture sequence relative to load event:
    // 0s, 1.5s, 2.5s, 3.5s, 4.5s, 5.0s
    await takeScreenshot('0.0s (initial render)', 'screenshot_0.0s.png');

    await sleep(1500 - (Date.now() - startTime));
    await takeScreenshot('1.5s (opening transition)', 'screenshot_1.5s.png');

    await sleep(2500 - (Date.now() - startTime));
    await takeScreenshot('2.5s (characters entering)', 'screenshot_2.5s.png');

    await sleep(3500 - (Date.now() - startTime));
    await takeScreenshot('3.5s (characters assembling)', 'screenshot_3.5s.png');

    await sleep(4500 - (Date.now() - startTime));
    await takeScreenshot('4.5s (characters complete and settled)', 'screenshot_4.5s.png');

    await sleep(5000 - (Date.now() - startTime));
    await takeScreenshot('5.0s (interactive mode active)', 'screenshot_5.0s.png');

    console.log('All 6 timestamps captured successfully!');
    ws.close();
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

main();
