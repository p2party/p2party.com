import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import { ArticleContents } from "./ArticleContents";

// The numbered headings in each policy also supply its navigation, keeping
// the link labels and section IDs in step with the published text.
const sectionId = (heading: string) => "section-" + heading.split(".")[0];

export function SectionHeading({ children }: { children: string }) {
  return <h2 id={sectionId(children)}>{children}</h2>;
}

export function LegalDocument({
  title,
  children,
}: {
  title: string;
  children: ReactElement<{ children: ReactNode }>;
}) {
  const sections = Children.toArray(children.props.children).flatMap(
    (child) => {
      if (
        !isValidElement<{ children: string }>(child) ||
        child.type !== SectionHeading
      )
        return [];
      const title = child.props.children;
      return [{ id: sectionId(title), title }];
    },
  );

  return (
    <main className='site-reading'>
      <header className='site-reading-header'>
        <h1 className='site-title'>{title}</h1>
        <p className='site-meta'>
          Effective <time dateTime='2024-10-17'>17 October 2024</time> · Updated{" "}
          <time dateTime='2026-11-27'>27 November 2026</time>
        </p>
      </header>
      <div className='site-reading-grid'>
        <ArticleContents sections={sections} />
        {children}
      </div>
    </main>
  );
}
