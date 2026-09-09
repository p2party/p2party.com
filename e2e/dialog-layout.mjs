import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { chromium, firefox, webkit, expect } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = new URL("../logs/dialog-layout/", import.meta.url);
const baseline = process.argv.includes("--baseline");
const specificOnly = process.env.DIALOG_SPECIFIC_ONLY === "1";
const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Alert,AlertTitle,AlertBody,AlertActions} from './src/components/alert';
import {Dialog,DialogTitle,DialogBody,DialogActions} from './src/components/dialog';
import {Button} from './src/components/button';
import {Input} from './src/components/input';
import {Dropdown,DropdownButton,DropdownMenu,DropdownItem} from './src/components/dropdown';
import SettingsAlert from './src/components/alerts/SettingsAlert';
import ConnectAlert from './src/components/alerts/ConnectAlert';
import QRCodeAlert from './src/components/alerts/QRCodeAlert';
import RoomSetupAlert from './src/components/RoomSetupAlert';
import IdentityBackupAlert from './src/components/alerts/IdentityBackupAlert';
import RestoreIdentityAlert from './src/components/alerts/RestoreIdentityAlert';
import AddressBookAlert from './src/components/alerts/AddressBookAlert';
import BlacklistAlert from './src/components/alerts/BlacklistAlert';
import DiagnosticsAlert from './src/components/alerts/DiagnosticsAlert';
import {MemoryRouter} from 'react-router';
import {useVisualViewport} from './src/hooks/useVisualViewport';
const extraDialogs={'Room setup':RoomSetupAlert,'Identity backup':IdentityBackupAlert,'Identity restore':RestoreIdentityAlert,'Address book':AddressBookAlert,'Blacklist':BlacklistAlert,'Diagnostics':DiagnosticsAlert};
function Fixture(){
 useVisualViewport();
 const [kind,setKind]=useState('');const [nested,setNested]=useState(false);const [specific,setSpecific]=useState('');
 const Component=kind==='alert'?Alert:Dialog,Title=kind==='alert'?AlertTitle:DialogTitle,Body=kind==='alert'?AlertBody:DialogBody,Actions=kind==='alert'?AlertActions:DialogActions;
 return <><header className='fixed top-0 left-0 z-50 h-16 w-full bg-white'>Application navigation</header><main className='pt-20'><Button onClick={()=>setKind('alert')}>Open alert</Button><Button onClick={()=>setKind('dialog')}>Open dialog</Button>{['Settings','PIN Join','QR',...Object.keys(extraDialogs)].map(name=><Button key={name} onClick={()=>setSpecific(name)}>Open {name}</Button>)}</main>
 <SettingsAlert isOpen={specific==='Settings'} setIsOpen={()=>setSpecific('')}/>
 <ConnectAlert roomUrl={'a'.repeat(64)} isOpen={specific==='PIN Join'} setIsOpen={()=>setSpecific('')} setPressedCancel={()=>{}}/>
 <QRCodeAlert inviteUrl={location.origin+'/r#v1.'+'A'.repeat(43)} roomPolicy={window.fixtureRoom.roomPolicy} isOpen={specific==='QR'} setIsOpen={()=>setSpecific('')}/>
 {Object.entries(extraDialogs).map(([name,Component])=><Component key={name+'-'+String(specific===name)} isOpen={specific===name} setIsOpen={()=>setSpecific('')}/>)}
 <Component open={!!kind} onClose={()=>setKind('')} size='md'><Title>Long settings form</Title><Body>
 <label>First setting<Input aria-label='First setting'/></label>
 <div data-testid='fixed-content' className='mx-auto my-4 bg-orange-400' style={{width:256,height:256}}>Room QR content</div>
 <p>{'Capability and policy fields should wrap without pushing actions off the screen. '.repeat(4)}</p>
 <p>{'wss://'+ 'long-unbroken-signaling-hostname'.repeat(8)+'.invalid/path'}</p>
 {Array.from({length:8},(_,index)=><label key={index} className='my-4 block'>Setting {index+1}<Input aria-label={'Setting '+(index+1)}/></label>)}
 <Dropdown><DropdownButton>More options</DropdownButton><DropdownMenu><DropdownItem onClick={()=>{window.menuChosen=true;}}>Choose option</DropdownItem></DropdownMenu></Dropdown>
 <Button onClick={()=>setNested(true)}>Open nested confirmation</Button>
 <label className='my-4 block'>Last setting<Input aria-label='Last setting'/></label>
 </Body><Actions><Button onClick={()=>{window.saved=true;}}>Create a new recoverable identity</Button><Button onClick={()=>setKind('')}>Close form</Button></Actions></Component>
 <Alert open={nested} onClose={()=>setNested(false)}><AlertTitle>Confirm setting</AlertTitle><AlertBody>This confirmation opens above the form.</AlertBody><AlertActions><Button onClick={()=>setNested(false)}>Return to form</Button></AlertActions></Alert>
 </>;
}
window.fixtureRoom={roomUrl:'a'.repeat(64),roomPolicy:{version:1,revision:0,wireVersion:4,authMode:'pin',pqMode:'hybrid-mlkem768',rendezvousMode:'legacy-signaling',coverMode:'immediate',coverCadenceMs:0,coverLanes:0,coverFramesPerCell:0,coverDurationEpochs:0},signalingServerConnectionState:{isConnected:false},signalingServerUrl:'wss://'+ 'long-unbroken-signaling-hostname'.repeat(8)+'.invalid/path',stunServerUrls:['stun:fixture.invalid:3478'],peers:[],onlyConnectWithKnownPeers:false,connect:async()=>{},connectToSignalingServer:async()=>{},disconnectFromSignalingServer:async()=>{},setOnlyConnectToKnownPeers:async()=>{},setSignalingServerUrl:()=>{},setStunServerUrls:()=>{}};
window.fixturePeers=Array.from({length:20},(_,i)=>({peerId:('peer-'+i+'-')+'b'.repeat(64),peerPublicKey:'c'.repeat(64),username:'A_long_unbroken_contact_name_'.repeat(8)+i,dateAdded:1700000000000+i}));
const forbidden=()=>{throw new Error('Identity/room mutation is outside this layout fixture');};
Object.assign(window.fixtureRoom,{roomId:'synthetic-room-'+'d'.repeat(64),peerId:'local-peer-'+'e'.repeat(64),keyPair:{publicKey:'f'.repeat(64)},channels:[],messages:Array.from({length:20},(_,i)=>({sha512Hex:'f'.repeat(128),timestamp:i,filename:'long_unbroken_filename_'+i+'.bin',savedSize:100000,totalSize:100000,chunksReceivedTotal:240,chunksReceivedReal:12,retransmits:3})),peers:window.fixturePeers,coverStatusByPeer:{},handshakeStatusByPeer:{},getIdentityBackupStatus:async()=>({publicKey:'f'.repeat(64),derivation:'random'}),identityIsRecoverable:()=>false,createRecoverableIdentity:forbidden,restoreIdentityFromMnemonic:forbidden,isInvalidRecoveryPhraseError:()=>false,validateMnemonicWords:()=>({ok:false,reason:'Synthetic invalid phrase; no restore is performed.'})});
createRoot(document.getElementById('root')).render(<MemoryRouter><Fixture/></MemoryRouter>);
`;
const bundled = await build({
  stdin: { contents: fixture, resolveDir: root, loader: "tsx" },
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "controlled-room-boundary",
      setup(plugin) {
        plugin.onResolve({ filter: /(?:^|\/)sdk$/ }, () => ({
          path: "sdk",
          namespace: "fixture",
        }));
        plugin.onResolve({ filter: /hooks\/useRoom$/ }, () => ({
          path: "useRoom",
          namespace: "fixture",
        }));
        plugin.onLoad({ filter: /^sdk$/, namespace: "fixture" }, () => ({
          contents:
            "export default {WIRE_CHUNK_FRAME_LEN:65490,MAX_CHUNK_SIZE:61912,normalizeRoomCapability:value=>value,getAllPeersInAddressBook:async()=>window.fixturePeers,getAllPeersInBlacklist:async()=>window.fixturePeers};",
          loader: "js",
        }));
        plugin.onLoad({ filter: /^useRoom$/, namespace: "fixture" }, () => ({
          contents:
            'export const useRoom=()=>window.fixtureRoom;export const DEFAULT_SIGNALING_URL="wss://fixture.invalid";export const DEFAULT_STUN_URLS=["stun:fixture.invalid:3478"];',
          loader: "js",
        }));
      },
    },
  ],
});
const compiler = await compile(
  await readFile(root + "/src/index.css", "utf8"),
  { base: root + "/src", onDependency() {} },
);
const scanner = new Scanner({
  sources: [{ base: root, pattern: "src/**/*.{ts,tsx}", negated: false }],
});
const css = compiler.build([
  ...scanner.scan(),
  ...scanner.scanFiles([{ content: fixture, extension: "tsx" }]),
]);
const logo = await readFile(root + "/public/logo-cat.svg");
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'",
  );
  if (path === "/fixture.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundled.outputFiles[0].contents);
  } else if (path === "/fixture.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(css);
  } else if (path === "/logo-cat.svg") {
    res.setHeader("Content-Type", "image/svg+xml");
    res.end(logo);
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script defer src="/fixture.js"></script></body></html>',
    );
  }
});
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const origin = "http://127.0.0.1:" + server.address().port;
await mkdir(out, { recursive: true });
const report = {
  baseline,
  specificOnly,
  started: new Date().toISOString(),
  cases: [],
  sourceHashes: {},
};
for (const file of ["alert", "dialog"])
  report.sourceHashes[file] = createHash("sha256")
    .update(await readFile(root + "/src/components/" + file + ".tsx"))
    .digest("hex");
const dimensions = [
  [320, 720],
  [360, 780],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [844, 390],
].filter(
  ([width]) =>
    !process.env.DIALOG_WIDTHS ||
    process.env.DIALOG_WIDTHS.split(",").includes(String(width)),
);
async function reachable(locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  return locator.evaluate((node) => {
    const r = node.getBoundingClientRect(),
      v = window.visualViewport;
    const top = v?.offsetTop ?? 0,
      left = v?.offsetLeft ?? 0,
      width = v?.width ?? innerWidth,
      height = v?.height ?? innerHeight;
    const hit = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    return {
      reachable:
        r.top >= top - 1 &&
        r.bottom <= top + height + 1 &&
        r.left >= left - 1 &&
        r.right <= left + width + 1 &&
        !!hit &&
        (node.contains(hit) || hit.contains(node)),
      rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
      viewport: { top, left, width, height },
      hit: hit?.tagName,
    };
  });
}
try {
  for (const type of [chromium, firefox, webkit].filter(
    (type) =>
      !process.env.DIALOG_BROWSERS ||
      process.env.DIALOG_BROWSERS.split(",").includes(type.name()),
  )) {
    const browser = await type.launch({ headless: true });
    try {
      for (const [width, height] of dimensions) {
        for (const kind of ["alert", "dialog"].filter(
          (kind) =>
            !process.env.DIALOG_KINDS ||
            process.env.DIALOG_KINDS.split(",").includes(kind),
        )) {
          const result = {
            browser: type.name(),
            width,
            height,
            kind,
            errors: [],
            violations: [],
            checks: [],
          };
          const context = await browser.newContext({
            viewport: { width, height },
            hasTouch: width <= 844,
          });
          const page = await context.newPage();
          page.setDefaultTimeout(3000);
          await page.addInitScript(() => {
            window.violations = [];
            document.addEventListener("securitypolicyviolation", (e) =>
              window.violations.push(e.effectiveDirective),
            );
            const original = window.visualViewport;
            const viewport = new EventTarget();
            let geometry = {};
            for (const key of [
              "width",
              "height",
              "offsetTop",
              "offsetLeft",
              "pageTop",
              "pageLeft",
              "scale",
            ])
              Object.defineProperty(viewport, key, {
                get: () => geometry[key] ?? original?.[key] ?? 0,
              });
            Object.defineProperty(window, "visualViewport", {
              value: viewport,
              configurable: true,
            });
            window.setVisualGeometry = (value) => {
              geometry = value;
              viewport.dispatchEvent(new Event("resize"));
              viewport.dispatchEvent(new Event("scroll"));
            };
          });
          page.on("pageerror", (e) => result.errors.push(e.message));
          try {
            await page.goto(origin);
            result.horizontalOverflow = [];
            result.actualDialogs = [];
            if (!specificOnly) {
              await page
                .getByRole("button", { name: "Open " + kind, exact: true })
                .click();
              const form = page.getByRole("dialog", {
                name: "Long settings form",
                includeHidden: true,
              });
              await form
                .getByRole("textbox", { name: "First setting", exact: true })
                .waitFor();
              result.horizontalOverflow = await form
                .getByTestId("fixed-content")
                .evaluate((node) => {
                  const failures = [];
                  for (
                    let parent = node.parentElement;
                    parent;
                    parent = parent.parentElement
                  ) {
                    if (
                      parent.clientWidth > 0 &&
                      parent.scrollWidth > parent.clientWidth + 1
                    )
                      failures.push({
                        tag: parent.tagName,
                        clientWidth: parent.clientWidth,
                        scrollWidth: parent.scrollWidth,
                      });
                  }
                  return failures;
                });
              for (const label of [
                "First setting",
                "fixed-content",
                "Last setting",
                "Create a new recoverable identity",
                "Close form",
              ]) {
                const target =
                  label === "fixed-content"
                    ? form.getByTestId(label)
                    : label.includes("setting")
                      ? form.getByRole("textbox", { name: label, exact: true })
                      : form.getByRole("button", {
                          name: label,
                          exact: true,
                          includeHidden: true,
                        });
                const check = {
                  phase: "full",
                  label,
                  ...(await reachable(target, page)),
                };
                result.checks.push(check);
              }
              result.checks.push({
                phase: "full",
                label: "Title",
                ...(await reachable(
                  form.getByRole("heading", {
                    name: "Long settings form",
                    exact: true,
                  }),
                )),
              });
              await form
                .getByRole("textbox", { name: "Last setting", exact: true })
                .focus();
              // Desktop automation can model a keyboard-reduced viewport; it cannot
              // assert a physical mobile keyboard or browser chrome's native behavior.
              await page.setViewportSize({
                width,
                height: Math.max(240, Math.floor(height * 0.48)),
              });
              for (const label of [
                "First setting",
                "Last setting",
                "Create a new recoverable identity",
                "Close form",
              ]) {
                const target = label.includes("setting")
                  ? form.getByRole("textbox", { name: label, exact: true })
                  : form.getByRole("button", {
                      name: label,
                      exact: true,
                      includeHidden: true,
                    });
                result.checks.push({
                  phase: "keyboard-shrink",
                  label,
                  ...(await reachable(target, page)),
                });
              }
              await page.setViewportSize({ width, height });
              for (const [phase, geometry] of [
                [
                  "keyboard-overlay",
                  {
                    height: Math.max(220, Math.floor(height * 0.48)),
                    offsetTop: 0,
                  },
                ],
                [
                  "keyboard-pan",
                  {
                    height: Math.max(200, Math.floor(height * 0.4)),
                    width: width - 24,
                    offsetTop: 100,
                    offsetLeft: 12,
                  },
                ],
              ]) {
                await page.evaluate(
                  (value) => window.setVisualGeometry(value),
                  geometry,
                );
                await page.waitForTimeout(50);
                for (const label of [
                  "First setting",
                  "Last setting",
                  "Create a new recoverable identity",
                  "Close form",
                ]) {
                  const target = label.includes("setting")
                    ? form.getByRole("textbox", { name: label, exact: true })
                    : form.getByRole("button", {
                        name: label,
                        exact: true,
                        includeHidden: true,
                      });
                  result.checks.push({
                    phase,
                    label,
                    ...(await reachable(target, page)),
                  });
                }
                result.checks.push({
                  phase,
                  label: "Title",
                  ...(await reachable(
                    form.getByRole("heading", {
                      name: "Long settings form",
                      exact: true,
                    }),
                  )),
                });
                const input = form.getByRole("textbox", {
                  name: "Last setting",
                  exact: true,
                });
                await input.fill(phase);
                await expect(input).toHaveValue(phase);
                await form
                  .getByRole("button", {
                    name: "Create a new recoverable identity",
                    exact: true,
                  })
                  .click();
                assert.equal(await page.evaluate(() => window.saved), true);
                await page.evaluate(() => {
                  window.saved = false;
                });
              }
              await page.evaluate(() => window.setVisualGeometry({}));
              await page.waitForTimeout(50);
              const menu = form.getByRole("button", {
                name: "More options",
                exact: true,
              });
              await menu.scrollIntoViewIfNeeded();
              await menu.click();
              const option = page.getByRole("menuitem", {
                name: "Choose option",
                exact: true,
              });
              result.checks.push({
                phase: "dropdown",
                label: "Choose option",
                ...(await reachable(option, page)),
              });
              await option.click();
              assert.equal(await page.evaluate(() => window.menuChosen), true);
              const nested = form.getByRole("button", {
                name: "Open nested confirmation",
                exact: true,
              });
              await nested.scrollIntoViewIfNeeded();
              await nested.click();
              const back = page.getByRole("button", {
                name: "Return to form",
                exact: true,
              });
              result.checks.push({
                phase: "nested",
                label: "Return to form",
                ...(await reachable(back, page)),
              });
              await back.click();
              await expect(nested).toBeFocused();
              await form
                .getByRole("button", { name: "Close form", exact: true })
                .click();
              await expect(
                page.getByRole("button", { name: "Open " + kind, exact: true }),
              ).toBeFocused();
            }
            if (kind === "alert")
              for (const [name, title, actions, close] of [
                ["Settings", "Settings", ["Done"], "Done"],
                [
                  "PIN Join",
                  "Join PIN-authenticated room",
                  ["Cancel", "Connect"],
                  "Cancel",
                ],
                [
                  "QR",
                  "Share this room",
                  ["Close", "Download QR", "Copy link"],
                  "Close",
                ],
                [
                  "Room setup",
                  "New room",
                  ["Cancel", "Generate room"],
                  "Cancel",
                ],
                [
                  "Identity backup",
                  "Back up identity",
                  ["Back", "Create recoverable identity"],
                  "Back",
                ],
                [
                  "Identity restore",
                  "Restore identity",
                  ["Cancel", "Restore identity"],
                  "Cancel",
                ],
                ["Address book", "Address Book", ["Done"], "Done"],
                ["Blacklist", "Blacklist", ["Done"], "Done"],
                ["Diagnostics", "Advanced diagnostics", ["Close"], "Close"],
              ]) {
                await page
                  .getByRole("button", { name: "Open " + name, exact: true })
                  .click();
                const actual = page.getByRole("dialog", {
                  name: title,
                  includeHidden: true,
                });
                await actual
                  .getByRole("heading", { name: title, exact: true })
                  .waitFor();
                if (name === "Room setup") {
                  for (const label of actions)
                    result.checks.push({
                      phase: "actual-initial-" + name,
                      label,
                      ...(await reachable(
                        actual.getByRole("button", {
                          name: label,
                          exact: true,
                        }),
                      )),
                    });
                  await actual
                    .getByRole("tab", { name: "Advanced", exact: true })
                    .click();
                  await actual
                    .getByRole("switch", {
                      name: "Require a room PIN",
                      exact: true,
                    })
                    .click();
                  await actual
                    .getByRole("radio", { name: /Scheduled/ })
                    .click();
                }
                if (name === "Identity backup") {
                  const begin = actual.getByRole("button", {
                    name: "Create a recoverable identity",
                    exact: true,
                  });
                  await expect(begin).toBeVisible();
                  result.checks.push({
                    phase: "actual-initial-" + name,
                    label: "Create a recoverable identity",
                    ...(await reachable(begin)),
                  });
                  await begin.click();
                  await actual
                    .getByRole("button", { name: "Advanced", exact: true })
                    .click();
                }
                if (name === "Identity restore") {
                  await actual
                    .getByRole("textbox", {
                      name: "Recovery phrase",
                      exact: true,
                    })
                    .fill("invalid synthetic words ".repeat(8));
                  await actual
                    .getByRole("button", { name: "Advanced", exact: true })
                    .click();
                }
                if (name === "Address book" || name === "Blacklist") {
                  await expect(actual.locator("tbody tr")).toHaveCount(20);
                  const lastCell = actual
                    .locator("tbody tr")
                    .last()
                    .locator("td")
                    .last();
                  result.checks.push({
                    phase: "actual-last-row-" + name,
                    label: "Public key",
                    ...(await reachable(lastCell)),
                  });
                }
                const panelWidth = await actual
                  .getByRole("heading", { name: title, exact: true })
                  .evaluate((node) => {
                    const rect = node.parentElement.getBoundingClientRect();
                    return {
                      reachable:
                        rect.left >= -1 && rect.right <= innerWidth + 1,
                      left: rect.left,
                      right: rect.right,
                      width: innerWidth,
                    };
                  });
                result.checks.push({
                  phase: "actual-" + name,
                  label: "Panel width",
                  ...panelWidth,
                });
                if (name === "QR") {
                  await expect(
                    actual.getByRole("button", {
                      name: "Download QR",
                      exact: true,
                    }),
                  ).toBeEnabled();
                  result.checks.push({
                    phase: "actual-QR",
                    label: "Canvas",
                    ...(await reachable(actual.locator("canvas"))),
                  });
                }
                for (const label of actions)
                  result.checks.push({
                    phase: "actual-" + name,
                    label,
                    ...(await reachable(
                      actual.getByRole("button", {
                        name: label,
                        exact: true,
                        includeHidden: true,
                      }),
                    )),
                  });
                const fields = actual.locator(
                  'input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),textarea,select',
                );
                if (await fields.count()) {
                  await fields.first().focus();
                  if (width <= 844) {
                    const fonts = await fields.evaluateAll((nodes) =>
                      nodes.map((node) =>
                        Number.parseFloat(getComputedStyle(node).fontSize),
                      ),
                    );
                    assert(
                      fonts.every((size) => size >= 16),
                      "touch dialog inputs must remain at least16px",
                    );
                  }
                }
                await page.evaluate(
                  (height) =>
                    window.setVisualGeometry({
                      height: Math.max(220, Math.floor(height * 0.45)),
                      offsetTop: 80,
                    }),
                  height,
                );
                await page.waitForTimeout(50);
                for (const label of actions)
                  result.checks.push({
                    phase: "actual-keyboard-" + name,
                    label,
                    ...(await reachable(
                      actual.getByRole("button", {
                        name: label,
                        exact: true,
                        includeHidden: true,
                      }),
                    )),
                  });
                await actual
                  .getByRole("button", { name: close, exact: true })
                  .click();
                if (name === "Identity backup")
                  await actual
                    .getByRole("button", { name: "Not now", exact: true })
                    .click();
                await expect(actual).toHaveCount(0);
                await page.evaluate(() => window.setVisualGeometry({}));
                await expect(
                  page.getByRole("button", {
                    name: "Open " + name,
                    exact: true,
                  }),
                ).toBeFocused();
                result.actualDialogs.push(name);
              }
            result.violations = await page.evaluate(() => window.violations);
            assert.deepEqual(result.errors, []);
            assert.deepEqual(result.violations, []);
            assert.deepEqual(
              result.horizontalOverflow,
              [],
              "dialog content must not require horizontal scrolling",
            );
            assert(
              result.checks.every((check) => check.reachable),
              "one or more controls/content were clipped or covered",
            );
            result.passed = true;
          } catch (error) {
            result.passed = false;
            result.failure = error.message;
            await page.screenshot({
              path: fileURLToPath(
                new URL(
                  `${baseline ? "baseline" : "current"}-${type.name()}-${width}x${height}-${kind}.png`,
                  out,
                ),
              ),
            });
          } finally {
            await context.close();
            report.cases.push(result);
            console.log(
              JSON.stringify({
                browser: result.browser,
                width,
                height,
                kind,
                passed: result.passed,
                clipped: result.checks
                  .filter((check) => !check.reachable)
                  .map(({ phase, label }) => ({
                    phase,
                    label,
                  })),
                failure: result.failure,
              }),
            );
          }
        }
      }
    } finally {
      await browser.close();
    }
  }
  report.passed = report.cases.every((result) => result.passed);
  if (!baseline && !report.passed) process.exitCode = 1;
} finally {
  await new Promise((resolve) => server.close(resolve));
  report.finished = new Date().toISOString();
  await writeFile(
    new URL(
      baseline
        ? "baseline.json"
        : specificOnly
          ? "actual-dialogs.json"
          : "result.json",
      out,
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
}
