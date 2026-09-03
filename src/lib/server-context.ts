import 'server-only';

import {unstable_rethrow} from 'next/navigation';

export type BuildFailureArea =
  | 'url/metadata'
  | 'locale/data'
  | 'mdx/frontmatter'
  | 'content/path'
  | 'image/resource'
  | 'json-ld'
  | 'client/serialization';

export type BuildContext = {
  area: BuildFailureArea;
  stage: string;
  locale?: string;
  category?: string;
  slug?: string;
  file?: string;
  route?: string;
};

const SENSITIVE_ASSIGNMENT = /\b(authorization|cookie|api[-_ ]?key|token|secret|password)\b\s*[:=]\s*([^\s,;]+)/gi;
const URL_CREDENTIALS = /(https?:\/\/)[^/@\s]+@/gi;

export function safeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(SENSITIVE_ASSIGNMENT, '$1=[REDACTED]')
    .replace(URL_CREDENTIALS, '$1[REDACTED]@')
    .slice(0, 800);
}

function describeContext(context: BuildContext): string {
  const details = [
    `stage=${context.stage}`,
    context.locale ? `locale=${context.locale}` : '',
    context.category ? `category=${context.category}` : '',
    context.slug ? `slug=${context.slug}` : '',
    context.route ? `route=${context.route}` : '',
    context.file ? `file=${context.file}` : ''
  ].filter(Boolean);
  return `[${context.area}] ${details.join(' ')}`;
}

export function contextualBuildError(context: BuildContext, error: unknown): Error {
  return new Error(`${describeContext(context)}: ${safeErrorMessage(error)}`);
}

export async function withBuildContext<T>(context: BuildContext, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    // Next.js uses thrown values for notFound(), redirect(), and prerender control flow.
    // This rethrows those values unchanged before ordinary errors receive wiki context.
    unstable_rethrow(error);
    throw contextualBuildError(context, error);
  }
}

export function assertClientSerializable(value: unknown, context: Omit<BuildContext, 'area'>): void {
  const seen = new WeakSet<object>();

  function visit(current: unknown, location: string): void {
    if (current === null || ['string', 'number', 'boolean'].includes(typeof current)) return;
    if (typeof current === 'undefined') {
      throw new Error(`undefined at ${location}`);
    }
    if (['bigint', 'function', 'symbol'].includes(typeof current)) {
      throw new Error(`${typeof current} at ${location}`);
    }
    if (typeof current !== 'object') return;

    if (seen.has(current)) throw new Error(`circular reference at ${location}`);
    seen.add(current);
    const prototype = Object.getPrototypeOf(current);
    if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) {
      throw new Error(`${current.constructor?.name ?? 'non-plain object'} at ${location}`);
    }
    for (const [key, child] of Object.entries(current)) visit(child, `${location}.${key}`);
    seen.delete(current);
  }

  try {
    visit(value, '$');
  } catch (error) {
    throw contextualBuildError({...context, area: 'client/serialization'}, error);
  }
}
