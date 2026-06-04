/** Public SEO constants — keep in sync with index.html and public/sitemap.xml */
export const SEO_SITE_URL =
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim() ||
  "https://codex.itsnomatata.com";

export const SEO_BRAND = {
  productName: "Codex",
  productFullName: "Codex AI Workspace",
  companyName: "IT's No Matata",
  companyUrl: "https://itsnomatata.com/",
  companyGitHub: "https://github.com/ItsnomatataDev",
  tagline:
    "AI-native team workspace for operations, content, boards, and realtime collaboration — built in Victoria Falls, Zimbabwe.",
  logoUrl:
    "https://res.cloudinary.com/dnqjax5ut/image/upload/v1776754504/Itsnomatata-Logo-White-with-tagline-2-768x643_u3n4j0.png",
  locale: "en_ZW",
  region: "Victoria Falls, Zimbabwe",
} as const;

export const SEO_TEAM = {
  thando: {
    name: "Thando Mpofu",
    role: "Full-Stack Software Engineer & AI Engineer",
    location: "Victoria Falls, Zimbabwe",
    github: "https://github.com/thando544",
    instagram: "https://www.instagram.com/thando.dev1/",
    website: "https://tmctechsolutions.com",
  },
  ben: {
    name: "Benjamin McDonald",
    role: "AI Engineer, Web Developer & SEO Specialist",
    companyRole:
      "Website developer, designer, and AI engineer at IT's No Matata (Codex platform)",
  },
} as const;
