export function ArticleContents({
  sections,
}: {
  sections: { id: string; title: string }[];
}) {
  const links = (
    <ul>
      {sections.map(({ id, title }) => (
        <li key={id}>
          <a href={`#${id}`}>{title}</a>
        </li>
      ))}
    </ul>
  );

  return (
    <nav aria-label='On this page' className='site-contents'>
      <details className='site-mobile-contents'>
        <summary>On this page</summary>
        {links}
      </details>
      <div className='site-desktop-contents'>
        <h2>On this page</h2>
        {links}
      </div>
    </nav>
  );
}
