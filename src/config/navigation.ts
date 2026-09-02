export type NavigationItem = {
  key: string;
  path: string;
  isContentType: boolean;
};

// Populate only after reviewed keyword categories exist. Keep keys synchronized
// with en.json, CONTENT_GROUP_CONFIG, content directories, and sitemap output.
export const NAVIGATION_CONFIG: readonly NavigationItem[] = [];

export const CONTENT_TYPES = NAVIGATION_CONFIG
  .filter((item) => item.isContentType)
  .map((item) => item.key) as readonly string[];

export type ContentType = string;
