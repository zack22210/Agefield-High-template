type Heading = {id: string; text: string};

export function ArticleToc({title, headings}: {title: string; headings: Heading[]}) {
  return (
    <nav className="article-toc" aria-label={title}>
      <h2>{title}</h2>
      <ol>
        {headings.map((heading) => (
          <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>
        ))}
      </ol>
    </nav>
  );
}
