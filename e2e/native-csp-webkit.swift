// Manual check: the native Content-Security-Policy in WebKit, under the
// capacitor:// scheme the iOS app is served from. Needs macOS with Xcode's
// command-line tools (`swift`), which this repository does not provide, so it
// is not wired to npm. Never connects a room or contacts production: every
// request goes to the scheme handler below, which reads local files only.
//
// After `npm run build:native && npx cap sync ios`:
//
//   swift e2e/native-csp-webkit.swift ios/App/App/public
//
// Files are served the way Capacitor serves them (the file if it exists,
// otherwise index.html). A securitypolicyviolation listener posts to a message
// handler. Exits non-zero on any violation, page error or failed step.
import AppKit
import WebKit

guard CommandLine.arguments.count == 2 else {
  FileHandle.standardError.write("usage: swift e2e/native-csp-webkit.swift <public dir>\n".data(using: .utf8)!)
  exit(2)
}
let root = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL

final class LocalFiles: NSObject, WKURLSchemeHandler {
  let types = [
    "html": "text/html", "js": "text/javascript", "css": "text/css", "wasm": "application/wasm",
    "svg": "image/svg+xml", "png": "image/png", "jpeg": "image/jpeg", "json": "application/json",
    "webmanifest": "application/manifest+json",
  ]
  func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
    let url = task.request.url!
    var file = root.appendingPathComponent(url.path).standardizedFileURL
    var isDirectory: ObjCBool = false
    if !file.path.hasPrefix(root.path)
      || !FileManager.default.fileExists(atPath: file.path, isDirectory: &isDirectory)
      || isDirectory.boolValue
    {
      file = root.appendingPathComponent("index.html")
    }
    let data = (try? Data(contentsOf: file)) ?? Data()
    let response = HTTPURLResponse(
      url: url, statusCode: 200, httpVersion: "HTTP/1.1",
      headerFields: [
        "Content-Type": types[file.pathExtension] ?? "application/octet-stream",
        "Content-Length": String(data.count),
      ])!
    task.didReceive(response)
    task.didReceive(data)
    task.didFinish()
  }
  func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

final class Reports: NSObject, WKScriptMessageHandler {
  var lines: [String] = []
  func userContentController(
    _ controller: WKUserContentController, didReceive message: WKScriptMessage
  ) {
    lines.append("\(message.body)")
  }
}

NSApplication.shared.setActivationPolicy(.prohibited)
let reports = Reports()
let configuration = WKWebViewConfiguration()
configuration.setURLSchemeHandler(LocalFiles(), forURLScheme: "capacitor")
configuration.userContentController.add(reports, name: "report")
configuration.userContentController.addUserScript(
  WKUserScript(
    source: """
      document.addEventListener("securitypolicyviolation", (event) =>
        window.webkit.messageHandlers.report.postMessage(
          "violation " + event.effectiveDirective + " " + event.blockedURI));
      window.addEventListener("error", (event) =>
        window.webkit.messageHandlers.report.postMessage("error " + event.message));
      """, injectionTime: .atDocumentStart, forMainFrameOnly: false))
let view = WKWebView(
  frame: NSRect(x: 0, y: 0, width: 1024, height: 768), configuration: configuration)

func wait(_ seconds: Double) { RunLoop.main.run(until: Date().addingTimeInterval(seconds)) }

/// Runs an async function body in the page and returns its result as text.
func evaluate(_ body: String) -> String {
  var output: String?
  view.callAsyncJavaScript(body, arguments: [:], in: nil, in: .page) { result in
    switch result {
    case .success(let value): output = "\(value)"
    case .failure(let error): output = "script failed: \(error)"
    }
  }
  let deadline = Date().addingTimeInterval(90)
  while output == nil && Date() < deadline { wait(0.1) }
  return output ?? "timed out"
}

func load(_ path: String) {
  view.load(URLRequest(url: URL(string: "capacitor://localhost" + path)!))
  wait(4)
}

var failures: [String] = []
func expect(_ step: String, _ actual: String, _ expected: String) {
  print("\(step): \(actual)")
  if actual != expected { failures.append("\(step): expected \(expected), got \(actual)") }
}

load("/")
expect(
  "policy present",
  evaluate("return !!document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')"),
  "1")
expect("origin", evaluate("return location.origin"), "capacitor://localhost")
expect("home rendered", evaluate("return document.querySelectorAll('#root *').length > 0"), "1")

load("/rooms")
expect(
  "room dialog",
  evaluate(
    """
    const button = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.trim() === 'Generate Room');
    if (!button) return 'no Generate Room button';
    button.click();
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const dialog = document.querySelector('[role=dialog]');
      if (dialog && dialog.textContent.includes('New room')) return 'open';
    }
    return 'did not open';
    """), "open")

load("/session-lab")
expect(
  "local crypto proof",
  evaluate(
    """
    const button = [...document.querySelectorAll('button')]
      .find((b) => b.textContent.toLowerCase().includes('run local crypto proof'));
    if (!button) return 'no button';
    button.click();
    for (let i = 0; i < 600; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const text = document.body.innerText;
      if (text.includes('FAILED: ')) return 'failed: ' + [...document.querySelectorAll('[role=alert]')].map((a) => a.textContent).join(' | ');
      if (/OK — protocol /.test(text)) return 'finished';
    }
    return 'timed out';
    """), "finished")

wait(0.5)
print("violations and page errors:", reports.lines.isEmpty ? "none" : "")
for line in reports.lines { print("  " + line) }
failures += reports.lines
if !failures.isEmpty {
  FileHandle.standardError.write(("FAILED\n" + failures.joined(separator: "\n") + "\n").data(using: .utf8)!)
  exit(1)
}
print("PASSED")
