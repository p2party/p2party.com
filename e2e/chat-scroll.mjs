import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { compile } from "@tailwindcss/node";
import { Scanner } from "@tailwindcss/oxide";
import { chromium, firefox, webkit, expect } from "@playwright/test";

// Actual chat, bubble, composer, shell and current Tailwind CSS. Only room/SDK
// boundaries are controlled. Synthetic payloads persist in this isolated local
// browser context, so reload exercises component mounting without real data.
const root = new URL("../", import.meta.url);
const out = new URL("../logs/chat-scroll/", import.meta.url);
const options = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const label = options.label ?? process.env.CHAT_SCROLL_LABEL ?? "current";
const fixture = `
import React from "react";
import {createRoot} from "react-dom/client";
import {Provider} from "react-redux";
import {BrowserRouter} from "react-router";
import ChatPage from "./src/pages/chat";
import {SidebarLayout} from "./src/components/sidebar-layout";
import {RoomContext} from "./src/hooks/useRoom";
import sdk from "./src/protocol/sdk";
import {useVisualViewport} from "./src/hooks/useVisualViewport";
const vv = new EventTarget();
let visual = null;
for (const [key, getter] of Object.entries({height:()=>visual?.height??innerHeight,width:()=>innerWidth,offsetTop:()=>visual?.offsetTop??0,offsetLeft:()=>0,pageTop:()=>visual?.offsetTop??0,pageLeft:()=>0,scale:()=>1})) Object.defineProperty(vv,key,{get:getter});
Object.defineProperty(window,"visualViewport",{value:vv,configurable:true});
window.scrollTrace=[];
window.setFixtureViewport = value => {visual=value;vv.dispatchEvent(new Event("resize"));vv.dispatchEvent(new Event("scroll"));};
const keyPair = {peerId:"local-peer",publicKey:""};
const store = {getState:()=>({keyPair}),subscribe:()=>()=>{},dispatch:()=>{}};
window.payloads = JSON.parse(sessionStorage.getItem("fixture-payloads")??"{}");
function message(id, text, own=false, channel="main") {
  window.payloads[id]=text;
  return {sha512Hex:id,merkleRootHex:"root-"+id,fromPeerId:own?"local-peer":"remote-peer",channelLabel:channel,timestamp:1700000000000+Number(id.match(/\\d+$/)?.[0]??0),totalChunks:1,chunksCreated:1,savedSize:text.length,totalSize:text.length,chunksReceivedTotal:1};
}
function room(id) {return {roomId:id,roomUrl:id,selectedChannel:"main",messages:Array.from({length:50},(_,i)=>message("fixture-"+id+"-"+i,"fixture-"+id+"-"+i+" A readable message with wrapping text.",i%2===0))};}
function Fixture() {
  useVisualViewport();
  const [state,setState] = React.useState(()=>JSON.parse(sessionStorage.getItem("fixture-room")??"null")??room("a"));
  const change = update => setState(prev=>typeof update==="function"?update(prev):{...prev,...update});
  React.useEffect(()=>{sessionStorage.setItem("fixture-room",JSON.stringify(state));sessionStorage.setItem("fixture-payloads",JSON.stringify(window.payloads));},[state]);
  window.fixture = {
    append:(id,text="Arrived after existing history.",own=false)=>change(prev=>({...prev,messages:[...prev.messages,message(id,id+" "+text,own)]})),
    prepend:(id)=>change(prev=>({...prev,messages:[message(id,id+" Earlier message arrived out of order."),...prev.messages]})),
    replaceText:(id,text)=>{window.payloads[id]=id+" "+text;change(prev=>({...prev,messages:prev.messages.map(m=>m.sha512Hex===id?{...m,savedSize:m.savedSize+1}:m)}));},
    navigate:id=>change(room(id)),
    channel:channel=>change({selectedChannel:channel}),
    pending:enabled=>{window.fixturePending=enabled;},
    connection:connected=>change({connection:{isConnected:connected,isVerified:connected}}),
    handshake:enabled=>change({handshake:enabled?{"remote-peer":{status:"failed",reason:"pin-mismatch",peerPublicKey:"fixture-key"}}:{}}),
    messages:()=>state.messages.map(m=>m.sha512Hex),
  };
  const value={...state,peers:[{peerId:"remote-peer"}],channels:[{label:"main"}],handshakeStatusByPeer:state.handshake??{},signalingServerConnectionState:state.connection??{isConnected:true,isVerified:true},connectToSignalingServer:()=>{},disconnectFromSignalingServer:()=>{},sendMessage:(text,channel)=>{
    if(window.fixtureSendFailure)throw new Error(window.fixtureSendFailure);
    const id="fixture-sent-"+Date.now();
    const next=message(id,text,true,channel);next.transferId=id;
    change(prev=>({...prev,messages:[...prev.messages,next]}));
    return {transferId:id,cancel:async()=>{},done:Promise.resolve({outcomes:[{peerId:"remote-peer",status:"delivered"}]})};
  }};
  return <Provider store={store}><BrowserRouter><RoomContext.Provider value={value}><SidebarLayout navbar={<span>Fixture room</span>} sidebar={<div>Fixture sidebar</div>}><ChatPage/></SidebarLayout></RoomContext.Provider></BrowserRouter></Provider>;
}
createRoot(document.getElementById("root")).render(<Fixture/>);
`;
const bundle = await build({
  stdin: { contents: fixture, resolveDir: fileURLToPath(root), loader: "tsx" },
  bundle: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "controlled-room-sdk",
      setup(plugin) {
        if (options.trace ?? process.env.CHAT_SCROLL_TRACE)
          plugin.onLoad(
            { filter: /\/src\/pages\/chat.tsx$/ },
            async (args) => ({
              contents: (await readFile(args.path, "utf8"))
                .replace(
                  "const observer = new ResizeObserver(() => {",
                  'const observer = new ResizeObserver(() => { window.scrollTrace.push({kind:"resize",pin:stickToBottomRef.current,previous:observedMessageGeometryRef.current,top:messageList.scrollTop,height:messageList.clientHeight,extent:messageList.scrollHeight});',
                )
                .replace(
                  "stickToBottomRef.current = isNearMessageBottom(messageList);",
                  'window.scrollTrace.push({kind:"scroll-intent",pin:stickToBottomRef.current,previous:previousGeometry,current:currentGeometry}); stickToBottomRef.current = isNearMessageBottom(messageList);',
                ),
              loader: "tsx",
            }),
          );
        plugin.onResolve({ filter: /(?:^|\/)useRoom$/ }, () => ({
          path: "room",
          namespace: "fixture",
        }));
        plugin.onResolve({ filter: /(?:^|\/)sdk$/ }, () => ({
          path: "sdk",
          namespace: "fixture",
        }));
        plugin.onLoad({ filter: /^room$/, namespace: "fixture" }, () => ({
          contents:
            'import {createContext,useContext} from "react";export const RoomContext=createContext(null);export const useRoom=()=>useContext(RoomContext);',
          loader: "js",
          resolveDir: fileURLToPath(root),
        }));
        plugin.onLoad({ filter: /^sdk$/, namespace: "fixture" }, () => ({
          contents: `export default {normalizeRoomCapability:value=>value,WIRE_CHUNK_FRAME_LEN:65490,MAX_CHUNK_SIZE:61912,MessageCategory:{Text:"Text"},keyPairSelector:state=>state.keyPair,roomSelector:()=>[],store:{getState:()=>({})},readMessage:async(root,id)=>({message:window.payloads[id]??"",size:100,filename:"",category:"Text",extension:"",percentage:100}),getPeerAddressBookEntry:async()=>undefined,getPeerIsBlacklisted:async()=>false,listPendingMessages:async(roomId)=>window.fixturePending?Array.from({length:8},(_,i)=>({roomId,channelLabel:"main",transferId:"pending-"+i,filename:"queued-file-"+i+".txt",phase:"ready",retryable:true,retryAfter:0})).filter(row=>!window.fixtureCancelled?.includes(row.transferId)):[],cancelPendingMessage:async(room,id)=>{(window.fixtureCancelled??=[]).push(id);},getTransferAcks:()=>[]};`,
          loader: "js",
        }));
      },
    },
  ],
});
const compiler = await compile(
  await readFile(new URL("src/index.css", root), "utf8"),
  { base: fileURLToPath(new URL("src/", root)), onDependency: () => {} },
);
const scanner = new Scanner({
  sources: [
    { base: fileURLToPath(root), pattern: "src/**/*.{ts,tsx}", negated: false },
  ],
});
const css = compiler.build(scanner.scan());
const html =
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,interactive-widget=resizes-content"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js" defer></script></body></html>';
const server = createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/fixture.js") {
    res.setHeader("content-type", "text/javascript");
    res.end(bundle.outputFiles[0].contents);
  } else if (pathname === "/fixture.css") {
    res.setHeader("content-type", "text/css");
    res.end(css);
  } else if (pathname === "/") {
    res.setHeader("content-type", "text/html");
    res.end(html);
  } else res.writeHead(404).end();
});
await mkdir(out, { recursive: true });
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const report = {
  started: new Date().toISOString(),
  label,
  sourceSha256: {},
  cases: [],
};
for (const file of [
  "src/pages/chat.tsx",
  "src/pages/chatScroll.ts",
  "src/components/MessageInput/index.tsx",
  "src/components/sidebar-layout.tsx",
  "src/hooks/useVisualViewport.ts",
])
  report.sourceSha256[file] = createHash("sha256")
    .update(await readFile(new URL(file, root)))
    .digest("hex");
const settle = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => setTimeout(resolve, 80)),
        ),
      ),
  );
const geometry = (page) =>
  page.getByRole("log").evaluate((log) => {
    const r = log.getBoundingClientRect();
    const vv = window.visualViewport;
    const visibleTop = Math.max(r.top, vv.offsetTop);
    const visibleBottom = Math.min(r.bottom, vv.offsetTop + vv.height);
    const input = document.querySelector('textarea[aria-label="Message"]');
    const composer = input.closest("div.border-t-2");
    const inputBounds = input.getBoundingClientRect();
    const composerBounds = composer.getBoundingClientRect();
    const composerStyle = getComputedStyle(composer);
    const rows = [...log.firstElementChild.children].map((element) => {
      const b = element.getBoundingClientRect();
      return {
        id: element.textContent.match(/fixture-[a-z]+-\d+/)?.[0] ?? "unknown",
        top: b.top - r.top,
        bottom: b.bottom - r.top,
        height: b.height,
        visible: b.bottom > visibleTop && b.top < visibleBottom,
      };
    });
    return {
      height: log.clientHeight,
      top: r.top,
      bottom: r.bottom,
      scrollTop: log.scrollTop,
      scrollHeight: log.scrollHeight,
      gap: log.scrollHeight - log.clientHeight - log.scrollTop,
      anchor: rows.find((row) => row.visible),
      last: rows.at(-1),
      visible: rows.filter((row) => row.visible),
      count: rows.length,
      documentWidth: document.documentElement.scrollWidth,
      windowWidth: innerWidth,
      documentScroll: scrollY,
      visualViewport: { height: vv.height, top: vv.offsetTop },
      composer: {
        top: composerBounds.top,
        bottom: composerBounds.bottom,
        height: composerBounds.height,
        paddingBottom: parseFloat(composerStyle.paddingBottom),
        marginBottom: parseFloat(composerStyle.marginBottom),
        inputHeight: inputBounds.height,
      },
      keyboardBottomGap: vv.offsetTop + vv.height - composerBounds.bottom,
    };
  });
const assertBottom = async (page) => {
  await settle(page);
  const g = await geometry(page);
  assert(g.height >= 48, `message viewport collapsed to ${g.height}px`);
  assert(g.gap < 3, `latest message is ${g.gap}px below live edge`);
  assert(g.last.visible, "last message is clipped out of the message viewport");
  assert(g.visible.length > 0, "no visible messages");
  assert(
    g.composer.bottom <= g.visualViewport.top + g.visualViewport.height + 1,
    "composer is below the visible keyboard boundary",
  );
  assert(
    g.top >= g.visualViewport.top - 1,
    "message list is above the panned visual viewport",
  );
  assert(
    g.composer.marginBottom === 0,
    "composer accumulated a keyboard spacer",
  );
  return g;
};
const scrollUp = async (page) => {
  await page.getByRole("log").hover();
  let g;
  for (let step = 0; step < 4; step++) {
    await page.mouse.wheel(0, -1000);
    await settle(page);
    g = await geometry(page);
    if (g.gap > 200) break;
  }
  assert(g.gap > 200, "reader did not leave live edge");
  return g;
};
let browser;
try {
  for (const [browserName, browserType] of Object.entries({
    chromium,
    firefox,
    webkit,
  })) {
    if (
      (options.browser ?? process.env.CHAT_SCROLL_BROWSER) &&
      (options.browser ?? process.env.CHAT_SCROLL_BROWSER) !== browserName
    )
      continue;
    browser = await browserType.launch({ headless: true });
    for (const [width, height] of [
      [320, 640],
      [360, 740],
      [390, 844],
      [430, 932],
      [768, 1024],
      [1024, 768],
      [1440, 900],
      [740, 320],
    ]) {
      if (
        (options.width ?? process.env.CHAT_SCROLL_WIDTH) &&
        width !== Number(options.width ?? process.env.CHAT_SCROLL_WIDTH)
      )
        continue;
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const run = async (name, fn) => {
        if (options.case && options.case !== name) return;
        try {
          const detail = await fn();
          report.cases.push({
            browser: browserName,
            width,
            height,
            name,
            pass: true,
            detail,
          });
        } catch (error) {
          report.cases.push({
            browser: browserName,
            width,
            height,
            name,
            pass: false,
            error: error.message,
            geometry: await geometry(page).catch(() => null),
            trace:
              (options.trace ?? process.env.CHAT_SCROLL_TRACE)
                ? await page.evaluate(() => window.scrollTrace)
                : undefined,
          });
          await page.screenshot({
            path: fileURLToPath(
              new URL(`${label}-${browserName}-${width}-${name}.png`, out),
            ),
          });
        }
      };
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await expect(
        page.getByRole("textbox", { name: "Message", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("fixture-a-49 A readable message with wrapping text.", {
          exact: true,
        }),
      ).toHaveCount(1);
      await run("initial", async () => {
        const g = await assertBottom(page);
        assert(g.documentWidth <= width, "horizontal document overflow");
        if ([320, 390].includes(width))
          await page.screenshot({
            path: fileURLToPath(
              new URL(`${label}-${browserName}-${width}-closed.png`, out),
            ),
          });
        return g;
      });
      await run("arrival-bottom", async () => {
        await page.evaluate(() => window.fixture.append("fixture-arrival-50"));
        return assertBottom(page);
      });
      await run("async-body-growth", async () => {
        await page.evaluate(() =>
          window.fixture.replaceText(
            "fixture-arrival-50",
            "Longer text wraps as its async read completes. ".repeat(10),
          ),
        );
        return assertBottom(page);
      });
      await run("reader-arrival", async () => {
        const before = await scrollUp(page);
        await page.evaluate(() => window.fixture.append("fixture-arrival-51"));
        await settle(page);
        const after = await geometry(page);
        assert.equal(after.anchor.id, before.anchor.id);
        assert(
          Math.abs(after.anchor.top - before.anchor.top) < 3,
          "arrival moved reading position",
        );
        return { before: before.anchor, after: after.anchor };
      });
      await run("reader-out-of-order", async () => {
        const before = await geometry(page);
        await page.evaluate(() => window.fixture.prepend("fixture-older-0"));
        await settle(page);
        const after = await geometry(page);
        assert.equal(after.anchor.id, before.anchor.id);
        assert(
          Math.abs(after.anchor.top - before.anchor.top) < 3,
          "older insertion moved reading position",
        );
        return { before: before.anchor, after: after.anchor };
      });
      await run("room-navigation", async () => {
        await page.evaluate(() => window.fixture.navigate("b"));
        return assertBottom(page);
      });
      await run("reload", async () => {
        await page.reload();
        await expect(
          page.getByText(
            "fixture-b-49 A readable message with wrapping text.",
            { exact: true },
          ),
        ).toHaveCount(1);
        return assertBottom(page);
      });
      await run("keyboard-open-pan-close", async () => {
        const full = await assertBottom(page);
        for (const visual of [
          { height: Math.min(height - 100, 360), offsetTop: 0 },
          { height: Math.min(height - 100, 320), offsetTop: 40 },
          null,
        ]) {
          await page.evaluate((v) => window.setFixtureViewport(v), visual);
          await assertBottom(page);
        }
        return { full };
      });
      await run("composer-grow-shrink", async () => {
        const input = page.getByRole("textbox", {
          name: "Message",
          exact: true,
        });
        await input.fill(
          Array.from({ length: 18 }, (_, i) => `Line ${i}`).join("\n"),
        );
        const grown = await assertBottom(page);
        await input.fill("");
        const shrunk = await assertBottom(page);
        return { grown, shrunk };
      });
      await run("reader-keyboard", async () => {
        const before = await scrollUp(page);
        await page.evaluate(
          (h) =>
            window.setFixtureViewport({
              height: Math.min(h - 100, 360),
              offsetTop: 0,
            }),
          height,
        );
        await settle(page);
        const after = await geometry(page);
        assert(after.height >= 48, "keyboard collapsed message viewport");
        assert.equal(after.anchor.id, before.anchor.id);
        assert(
          Math.abs(after.anchor.top - before.anchor.top) < 3,
          "keyboard moved reading position",
        );
        await page.evaluate(() => window.setFixtureViewport(null));
        return { before: before.anchor, after: after.anchor };
      });
      await run("send-while-reading", async () => {
        const input = page.getByRole("textbox", {
          name: "Message",
          exact: true,
        });
        await input.fill("fixture-sent-123 Sent while reading history.");
        await input.press("Enter");
        return assertBottom(page);
      });
      await run("keyboard-animation", async () => {
        const samples = [];
        const input = page.getByRole("textbox", {
          name: "Message",
          exact: true,
        });
        await input.fill(
          Array.from({ length: 18 }, (_, i) => `Line ${i}`).join("\n"),
        );
        await assertBottom(page);
        try {
          const target = Math.min(height - 100, 300);
          for (let step = 1; step <= 12; step++) {
            const progress = step <= 6 ? step / 6 : (12 - step) / 6;
            const visual = {
              height: height - (height - target) * progress,
              offsetTop: 35 * progress,
            };
            await page.evaluate(
              (value) => window.setFixtureViewport(value),
              visual,
            );
            await page.evaluate(
              () =>
                new Promise((resolve) =>
                  requestAnimationFrame(() => requestAnimationFrame(resolve)),
                ),
            );
            const g = await geometry(page);
            assert(g.height >= 48, `animation step ${step} collapsed history`);
            assert(
              g.composer.bottom <= visual.height + visual.offsetTop + 1,
              `animation step ${step} overshot keyboard boundary`,
            );
            assert(
              g.gap < 3,
              `animation step ${step} left live edge by ${g.gap}px`,
            );
            assert(g.last.visible, `animation step ${step} hid last message`);
            samples.push({
              step,
              height: g.height,
              gap: g.gap,
              composerBottom: g.composer.bottom,
              visualBottom: visual.height + visual.offsetTop,
            });
          }
          return samples;
        } finally {
          await input.fill("");
          await page.evaluate(() => window.setFixtureViewport(null));
          await settle(page);
        }
      });
      await run("keyboard-long-draft", async () => {
        const input = page.getByRole("textbox", {
          name: "Message",
          exact: true,
        });
        try {
          await page.evaluate(
            (h) =>
              window.setFixtureViewport({
                height: Math.min(h - 100, 300),
                offsetTop: 35,
              }),
            height,
          );
          await input.fill(
            Array.from({ length: 18 }, (_, i) => `Line ${i}`).join("\n"),
          );
          const result = await assertBottom(page);
          assert(
            result.composer.paddingBottom <= (width < 640 ? 6 : 12),
            "mobile composer retains excessive bottom padding",
          );
          return result;
        } finally {
          await input.fill("");
          await page.evaluate(() => window.setFixtureViewport(null));
          await settle(page);
        }
      });
      await run("reader-width-reflow", async () => {
        const before = await scrollUp(page);
        try {
          await page.setViewportSize({
            width: width === 320 ? 430 : 320,
            height,
          });
          await settle(page);
          const after = await geometry(page);
          assert.equal(
            after.anchor.id,
            before.anchor.id,
            "width reflow changed the visible message",
          );
          assert(
            Math.abs(after.anchor.top - before.anchor.top) < 3,
            "width reflow moved reading position",
          );
          return { before: before.anchor, after: after.anchor };
        } finally {
          await page.setViewportSize({ width, height });
          await settle(page);
        }
      });
      await run("width-reflow", async () => {
        await page.getByRole("log").evaluate((log) => {
          log.scrollTop = log.scrollHeight;
        });
        await settle(page);
        await page.setViewportSize({
          width: width === 320 ? 430 : 320,
          height,
        });
        const g = await assertBottom(page);
        await page.setViewportSize({ width, height });
        return g;
      });
      await run("pending-keyboard-draft", async () => {
        const input = page.getByRole("textbox", {
          name: "Message",
          exact: true,
        });
        try {
          await page.evaluate(() => window.fixture.pending(true));
          await expect(
            page.getByRole("region", {
              name: "Pending transfers",
              exact: true,
            }),
          ).toBeVisible();
          await page.evaluate(
            (h) =>
              window.setFixtureViewport({
                height: Math.min(h - 100, 300),
                offsetTop: 35,
              }),
            height,
          );
          await input.fill(
            Array.from({ length: 18 }, (_, i) => `Line ${i}`).join("\n"),
          );
          return await assertBottom(page);
        } finally {
          await input.fill("");
          await page.evaluate(() => {
            window.fixture.pending(false);
            window.setFixtureViewport(null);
          });
        }
      });
      if (width <= 430)
        await run("iphone-safe-area-keyboard-draft", async () => {
          const input = page.getByRole("textbox", {
            name: "Message",
            exact: true,
          });
          try {
            await page.evaluate(() => {
              document.documentElement.style.setProperty(
                "--safe-area-inset-top",
                "47px",
              );
              document.documentElement.style.setProperty(
                "--safe-area-inset-bottom",
                "34px",
              );
              window.setFixtureViewport({ height: 300, offsetTop: 35 });
            });
            await input.fill(
              Array.from({ length: 18 }, (_, i) => `Line ${i}`).join("\n"),
            );
            const result = await assertBottom(page);
            if ([320, 390].includes(width))
              await page.screenshot({
                path: fileURLToPath(
                  new URL(
                    `${label}-${browserName}-${width}-keyboard-safe-area.png`,
                    out,
                  ),
                ),
              });
            assert(
              result.keyboardBottomGap <= 1,
              "home indicator inset remains as padding above the keyboard",
            );
            return result;
          } finally {
            await input.fill("");
            await page.evaluate(() => {
              document.documentElement.style.removeProperty(
                "--safe-area-inset-top",
              );
              document.documentElement.style.removeProperty(
                "--safe-area-inset-bottom",
              );
              window.setFixtureViewport(null);
            });
          }
        });
      await run("status-banner-pan", async () => {
        await page.evaluate(() => {
          window.fixture.connection(false);
          window.setFixtureViewport({ height: 300, offsetTop: 200 });
        });
        await settle(page);
        const badge = page.getByRole("button", {
          name: "Press to connect to the signaling server and discover new peers",
          exact: true,
        });
        const rect = await badge.boundingBox();
        assert(
          rect.y >= 200,
          "status banner stayed outside the panned visual viewport",
        );
        assert(
          rect.y + rect.height <= 500,
          "status banner extends below the visible keyboard boundary",
        );
        await page.evaluate(() => {
          window.fixture.connection(true);
          window.setFixtureViewport(null);
        });
        return rect;
      });
      await run("focus-history", async () => {
        await page.evaluate(() => window.fixture.connection(true));
        const log = page.getByRole("log");
        await log.focus();
        await page.keyboard.press("Tab");
        await settle(page);
        const focused = await log.evaluate((element) => {
          const active = document.activeElement;
          const a = active.getBoundingClientRect();
          const b = element.getBoundingClientRect();
          return {
            inside: element.contains(active),
            visible: a.bottom > b.top && a.top < b.bottom,
            top: a.top,
            bottom: a.bottom,
            listTop: b.top,
            listBottom: b.bottom,
          };
        });
        assert(focused.inside, "Tab did not enter a message control");
        assert(
          focused.visible,
          "focused message control is clipped out of history",
        );
        return focused;
      });
      await run("find-history", async () => {
        const log = page.getByRole("log");
        await log.focus();
        await page.keyboard.press("End");
        await settle(page);
        await page.waitForTimeout(300);
        const result = await page.evaluate(() => {
          const id = window.fixture.messages()[0];
          const text = window.payloads[id];
          return { text, found: window.find(text, false, false, true) };
        });
        assert(result.found, "browser Find failed to locate older message");
        // Chromium's window.find selects the match without revealing an
        // overflow ancestor in this headless fixture. Reveal that selected
        // range explicitly, as a browser/assistive navigation action would.
        await page.evaluate(() => {
          const selection = window.getSelection();
          if (!selection?.rangeCount)
            throw new Error("Find did not select a range");
          selection
            .getRangeAt(0)
            .startContainer.parentElement.scrollIntoView({ block: "center" });
        });
        await settle(page);
        const row = await page
          .getByText(result.text, { exact: true })
          .boundingBox();
        const rect = await log.boundingBox();
        assert(
          row.y + row.height > rect.y && row.y < rect.y + rect.height,
          "browser Find match was repinned out of view",
        );
        await page.evaluate(() => window.getSelection()?.removeAllRanges());
        return { row, viewport: rect };
      });
      await run("status-reader-transition", async () => {
        const before = await geometry(page);
        await page.evaluate(() => window.fixture.connection(false));
        await settle(page);
        const after = await geometry(page);
        assert.equal(
          after.anchor.id,
          before.anchor.id,
          "status arrival moved reader to another message",
        );
        assert(
          Math.abs(after.anchor.top - before.anchor.top) < 3,
          "status arrival changed reading offset",
        );
        const unobscured = await page.getByRole("log").evaluate((log) => {
          const r = log.getBoundingClientRect();
          return log.contains(
            document.elementFromPoint(
              r.left + r.width / 2,
              r.top + Math.min(20, r.height / 2),
            ),
          );
        });
        assert(unobscured, "connection status overlays readable history");
        await page.evaluate(() => window.fixture.connection(true));
        await settle(page);
        const removed = await geometry(page);
        assert.equal(removed.anchor.id, before.anchor.id);
        assert(
          Math.abs(removed.anchor.top - before.anchor.top) < 3,
          "status removal changed reading offset",
        );
        return {
          before: before.anchor,
          shown: after.anchor,
          removed: removed.anchor,
        };
      });
      await run("status-keyboard-draft-queue", async () => {
        const input = page.getByRole("textbox", {
          name: "Message",
          exact: true,
        });
        await page.evaluate(() => {
          window.fixture.pending(true);
          window.fixture.handshake(true);
          window.setFixtureViewport({ height: 300, offsetTop: 35 });
        });
        await expect(
          page.getByText("PIN did not match", { exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole("region", { name: "Pending transfers", exact: true }),
        ).toBeVisible();
        await input.fill(
          Array.from({ length: 18 }, (_, i) => `Line ${i}`).join("\n"),
        );
        await page.evaluate(() => {
          window.fixtureSendFailure = "Controlled send failure. ".repeat(8);
        });
        await input.press("Enter");
        await settle(page);
        const g = await geometry(page);
        assert(
          g.height >= 48,
          `message viewport collapsed to ${g.height}px with status/queue/send error`,
        );
        assert(
          g.visible.length > 0,
          "no readable history with status/queue/send error",
        );
        const status = page.getByRole("region", {
          name: "Room status",
          exact: true,
        });
        for (const name of [
          "Enter the PIN again",
          "Cancel pending queued-file-7.txt",
        ]) {
          const action = page.getByRole("button", { name, exact: true });
          await action.scrollIntoViewIfNeeded();
          const bounds = await action.boundingBox();
          const panel = await status.boundingBox();
          assert(
            bounds.y + bounds.height > panel.y &&
              bounds.y < panel.y + panel.height,
            `${name} cannot be reached in status scroll`,
          );
          await action.click();
        }
        assert(
          (await page.evaluate(() => window.fixtureCancelled)).includes(
            "pending-7",
          ),
          "Cancel did not reach the pending transfer",
        );
        return g;
      });
      report.cases.push({
        browser: browserName,
        width,
        height,
        name: "page-errors",
        pass: pageErrors.length === 0,
        pageErrors,
      });
      await context.close();
    }
    await browser.close();
    browser = undefined;
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(
    new URL(`${label}.json`, out),
    JSON.stringify(report, null, 2) + "\n",
  );
}
const failed = report.cases.filter((test) => !test.pass);
console.log(
  JSON.stringify(
    {
      label,
      passed: report.cases.length - failed.length,
      total: report.cases.length,
      failures: failed.map(({ browser, width, height, name, error }) => ({
        browser,
        width,
        height,
        name,
        error,
      })),
    },
    null,
    2,
  ),
);
process.exitCode = failed.length ? 1 : 0;
