// Build the wallet separately from the React application. The hosted document
// permits only the exact signing bundle and sends no network requests itself.
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const source = new URL("wallet/browser/", root);
const output = new URL("public/wallet/", root);
const read = (url) => readFile(url, "utf8");
const digest = (text, format = "hex") =>
  createHash("sha256").update(text).digest(format);
const integrity = (text) => "sha256-" + digest(text, "base64");
const result = await build({
  entryPoints: [fileURLToPath(new URL("app.mjs", source))],
  platform: "browser",
  format: "iife",
  target: "es2022",
  tsconfigRaw: { compilerOptions: { alwaysStrict: true } },
  bundle: true,
  minify: true,
  legalComments: "none",
  write: false,
  charset: "utf8",
  metafile: true,
});
if (
  result.outputFiles.length !== 1 ||
  Object.values(result.metafile.outputs)[0].imports.length
)
  throw new Error("Wallet signing code must be fully bundled.");
const script = result.outputFiles[0].text;
const style =
  (await read(new URL("style.css", source))) +
  "\n" +
  (await read(new URL("src/pages/site.css", root)));
if (/<\/script/i.test(script) || /<\/style/i.test(style))
  throw new Error("Invalid inline delimiter in the offline wallet.");
const template = await read(new URL("template.html", source));
const scriptName = "signer-" + digest(script).slice(0, 20) + ".js";
const styleName = "wallet-" + digest(style).slice(0, 20) + ".css";
const common =
  "default-src 'none'; base-uri 'none'; object-src 'none'; form-action 'none'; connect-src 'none'; frame-src 'none';";
const assets = new URL("assets/", output);
await mkdir(assets, { recursive: true });
const logo = await read(new URL("public/logo-cat-tight.svg", root));
const dataLogo =
  "data:image/svg+xml;base64," + Buffer.from(logo).toString("base64");
const notices = [];
for (const [name, license] of [
  ["@p2party/ledger-client", "LICENSE.md"],
  ["@noble/post-quantum", "LICENSE"],
  ["@noble/hashes", "LICENSE"],
  ["@noble/curves", "LICENSE"],
  ["jose", "LICENSE.md"],
  ["qr", "LICENSE"],
  ["qr", "LICENSE-MIT"],
])
  notices.push(
    name +
      "\n" +
      (await read(new URL("node_modules/" + name + "/" + license, root))),
  );
notices.push(
  "P2Party portable wallet\n" +
    (await read(new URL("wallet/LICENSE.md", root))),
);
const licenseText = notices.join("\n\n");
if (licenseText.includes("-->"))
  throw new Error("Unexpected license comment delimiter.");
function page(offline) {
  const values = {
    CSP: offline
      ? common +
        " worker-src 'none'; img-src data:; style-src '" +
        integrity(style) +
        "'; script-src '" +
        integrity(script) +
        "'"
      : common +
        " worker-src 'self'; img-src 'self' data:; style-src 'self'; script-src '" +
        integrity(script) +
        "'",
    SCRIPT: offline
      ? "<script>" + script + "</script>"
      : '<script defer src="./assets/' +
        scriptName +
        '" integrity="' +
        integrity(script) +
        '"></script>',
    STYLE: offline
      ? "<style>" + style + "</style>"
      : '<link rel="stylesheet" href="./assets/' +
        styleName +
        '" integrity="' +
        integrity(style) +
        '" />',
    LOGO: offline ? dataLogo : "/logo-cat-tight.svg",
    ICON: offline ? dataLogo : "/logo-cat.svg",
  };
  let html = offline
    ? template.replaceAll('href="/', 'href="https://p2party.com/')
    : template;
  for (const [key, value] of Object.entries(values)) {
    const token = "__WALLET_" + key + "__";
    if (html.split(token).length !== 2)
      throw new Error("Expected one wallet template token " + key);
    html = html.replace(token, () => value);
  }
  return (
    html + "\n<!-- Bundled dependency licenses\n" + licenseText + "\n-->\n"
  );
}
const offline = page(true);
await Promise.all([
  writeFile(new URL("index.html", output), page(false)),
  writeFile(new URL(scriptName, assets), script),
  writeFile(new URL(styleName, assets), style),
  writeFile(new URL("restore-wallet.html", output), offline),
  writeFile(
    new URL("SHA256SUMS", output),
    digest(offline) + "  restore-wallet.html\n",
  ),
]);
for (const name of await readdir(assets)) {
  if (
    name !== scriptName &&
    name !== styleName &&
    /^(?:signer-[a-f0-9]{20}\.js|wallet-[a-f0-9]{20}\.css)$/.test(name)
  )
    await unlink(new URL(name, assets));
}
console.log(
  "Built hosted wallet and verified offline download " + digest(offline),
);
