import type { BlogPost } from "../blog/blogContent.mjs";
export function relatedBlogPosts(slug: string, max?: number, available?: (p: BlogPost) => boolean): BlogPost[];
