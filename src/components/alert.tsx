import * as Headless from "@headlessui/react";
import clsx from "clsx";
import type React from "react";
import { Text } from "./text";

const sizes = {
  xs: "sm:max-w-xs",
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
  "3xl": "sm:max-w-3xl",
  "4xl": "sm:max-w-4xl",
  "5xl": "sm:max-w-5xl",
};

export function Alert({
  size = "md",
  className,
  children,
  ...props
}: {
  size?: keyof typeof sizes;
  className?: string;
  children: React.ReactNode;
} & Omit<Headless.DialogProps, "as" | "className">) {
  return (
    <Headless.Dialog {...props} className='relative z-100'>
      <Headless.DialogBackdrop
        transition
        className='fixed inset-0 bg-zinc-950/15 transition duration-100 data-closed:opacity-0 data-enter:ease-out data-leave:ease-in dark:bg-zinc-950/50'
      />

      <div
        className='fixed overflow-y-auto overscroll-contain'
        style={{
          top: "var(--app-viewport-top, 0px)",
          left: "var(--app-viewport-left, 0px)",
          width: "var(--app-viewport-width, 100%)",
          height: "var(--app-viewport-height, 100dvh)",
        }}
      >
        <div
          className='flex min-h-full flex-col items-center p-3 sm:p-4'
          style={{
            paddingTop: "max(0.75rem, var(--safe-area-inset-top, 0px))",
            paddingRight: "max(0.75rem, var(--safe-area-inset-right, 0px))",
            paddingBottom: "max(0.75rem, var(--safe-area-inset-bottom, 0px))",
            paddingLeft: "max(0.75rem, var(--safe-area-inset-left, 0px))",
          }}
        >
          <Headless.DialogPanel
            transition
            className={clsx(
              className,
              sizes[size],
              "pointer-coarse:[&_input]:text-base pointer-coarse:[&_select]:text-base pointer-coarse:[&_textarea]:text-base",
              // Auto margins center short panels and collapse for tall panels,
              // keeping the first field and final actions in one scroll area.
              "shadow-brutal my-auto w-full max-w-full min-w-0 shrink-0 border-2 border-zinc-950 bg-white p-3 [overflow-wrap:anywhere] sm:p-6 dark:border-zinc-200 dark:bg-zinc-950 forced-colors:outline",
              "transition duration-100 will-change-transform data-closed:opacity-0 data-enter:ease-out data-closed:data-enter:scale-95 data-leave:ease-in",
            )}
          >
            {children}
          </Headless.DialogPanel>
        </div>
      </div>
    </Headless.Dialog>
  );
}

export function AlertTitle({
  className,
  ...props
}: { className?: string } & Omit<
  Headless.DialogTitleProps,
  "as" | "className"
>) {
  return (
    <Headless.DialogTitle
      {...props}
      className={clsx(
        className,
        "text-center text-base/6 font-semibold text-balance text-zinc-950 sm:text-left sm:text-sm/6 sm:text-wrap dark:text-white",
      )}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: { className?: string } & Omit<
  Headless.DescriptionProps<typeof Text>,
  "as" | "className"
>) {
  return (
    <Headless.Description
      as={Text}
      {...props}
      className={clsx(className, "mt-2 text-center text-pretty sm:text-left")}
    />
  );
}

export function AlertBody({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={clsx(className, "mt-4")} />;
}

export function AlertActions({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        "mt-6 flex flex-col-reverse items-center justify-end gap-3 *:w-full *:max-w-full *:min-w-0 sm:mt-4 sm:flex-row sm:flex-wrap sm:*:w-auto",
      )}
    />
  );
}
