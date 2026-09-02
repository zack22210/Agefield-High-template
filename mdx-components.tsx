import type {MDXComponents} from 'mdx/types';
import type {ComponentPropsWithoutRef, ReactNode} from 'react';

function textValue(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(textValue).join('');
  return '';
}

function headingId(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function H2({children, ...props}: ComponentPropsWithoutRef<'h2'>) {
  return <h2 id={headingId(textValue(children))} {...props}>{children}</h2>;
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: H2,
    ...components
  };
}
