import * as Headless from "@headlessui/react";
import React, { forwardRef } from "react";
import { Link as RouterLink } from "react-router-dom";

/**
 * Catalyst ships this as a plain `<a>` with a TODO to wire it to the router.
 * The TODO was never done, so every in-app link was a full document load: the
 * browser tore down the app, re-fetched index.html, and React booted from
 * scratch. Since index.html is the prerendered landing page, clicking a saved
 * room meant watching the homepage hero paint before the chat appeared.
 *
 * Anything with a scheme, a protocol-relative prefix, a `mailto:`, an explicit
 * `target`, or a download stays a real anchor -- those are genuinely leaving
 * the app, and handing them to the router would break them.
 */
const isExternal = (href: string, target?: string, download?: unknown) =>
  target !== undefined ||
  download !== undefined ||
  /^[a-z][a-z0-9+.-]*:/iu.test(href) ||
  href.startsWith("//");

export const Link = forwardRef(function Link(
  props: { href: string } & React.ComponentPropsWithoutRef<"a">,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  const { href, target, download, ...rest } = props;

  if (isExternal(href, target, download)) {
    return (
      <Headless.DataInteractive>
        <a
          {...rest}
          href={href}
          target={target}
          download={download}
          ref={ref}
        />
      </Headless.DataInteractive>
    );
  }

  return (
    <Headless.DataInteractive>
      <RouterLink {...rest} to={href} ref={ref} />
    </Headless.DataInteractive>
  );
});
