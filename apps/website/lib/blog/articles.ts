import { blogArticles } from "@/content/blog/articles";
import type { BlogArticle, BlogArticleType } from "./types";

const sort = (items: readonly BlogArticle[]) => [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));

export const getAllBlogArticles = () => sort(blogArticles);
export const getBlogArticleBySlug = (slug: string) => blogArticles.find((article) => article.slug === slug);
export const getFeaturedBlogArticle = () => getAllBlogArticles().find((article) => article.featured);
export const getBlogArticlesByType = (type: BlogArticleType) => sort(blogArticles.filter((article) => article.type === type));
export const getBlogArticlesByCategory = (category: string) => sort(blogArticles.filter((article) => article.category.toLocaleLowerCase("pt") === category.toLocaleLowerCase("pt")));
export const getBlogCategories = () => [...new Set(blogArticles.map((article) => article.category))].sort((a, b) => a.localeCompare(b, "pt"));
export const getBlogTags = () => [...new Set(blogArticles.flatMap((article) => article.tags))].sort((a, b) => a.localeCompare(b, "pt"));
export const blogCategorySlug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
