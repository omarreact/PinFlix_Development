// lib/cineplex-categories.ts
import { CineplexCategory, ContentType } from "./cineplex-types";

export interface CategoryGroup {
  name: string;
  type: ContentType;
  color?: string;
  categories: CineplexCategory[];
}

export const CINEPLEX_MOVIE_CATEGORIES: CineplexCategory[] = [
  // Col 1: Core Formats & World
  {
    title: "3D Movies",
    href: "/category.php?category=3D+Movies",
    categoryParam: "3D Movies",
    type: "movie",
    group: "Formats & 3D",
  },
  {
    title: "4K Movies",
    href: "/category.php?category=4K+Movies",
    categoryParam: "4K Movies",
    type: "movie",
    group: "Formats & 3D",
  },
  {
    title: "Animation",
    href: "/category.php?category=Animation",
    categoryParam: "Animation",
    type: "movie",
    group: "Animation & Anime",
  },
  {
    title: "Anime",
    href: "/category.php?category=Anime",
    categoryParam: "Anime",
    type: "movie",
    group: "Animation & Anime",
  },
  {
    title: "Bangla",
    href: "/category.php?category=Bangla",
    categoryParam: "Bangla",
    type: "movie",
    group: "Bangla Cinema",
  },
  {
    title: "Bangla Dubbed",
    href: "/category.php?category=Bangla+Dubbed",
    categoryParam: "Bangla Dubbed",
    type: "movie",
    group: "Bangla Cinema",
  },
  {
    title: "Bangla Movies",
    href: "/category.php?category=Bangla+Movies",
    categoryParam: "Bangla Movies",
    type: "movie",
    group: "Bangla Cinema",
  },
  {
    title: "Chinese",
    href: "/category.php?category=Chinese",
    categoryParam: "Chinese",
    type: "movie",
    group: "Asian Cinema",
  },
  {
    title: "Documentaries",
    href: "/category.php?category=Documentaries",
    categoryParam: "Documentaries",
    type: "movie",
    group: "Documentary",
  },
  {
    title: "Documentary",
    href: "/category.php?category=Documentary",
    categoryParam: "Documentary",
    type: "movie",
    group: "Documentary",
  },
  {
    title: "Dual Audio",
    href: "/category.php?category=Dual+Audio",
    categoryParam: "Dual Audio",
    type: "movie",
    group: "Audio & Dubbed",
  },
  {
    title: "English",
    href: "/category.php?category=English",
    categoryParam: "English",
    type: "movie",
    group: "Hollywood & West",
  },
  {
    title: "Exclusive Full HD",
    href: "/category.php?category=Exclusive+Full+HD",
    categoryParam: "Exclusive Full HD",
    type: "movie",
    group: "Formats & 3D",
  },

  // Col 2: International & Regional
  {
    title: "Foreign",
    href: "/category.php?category=Foreign",
    categoryParam: "Foreign",
    type: "movie",
    group: "World Cinema",
  },
  {
    title: "Hindi",
    href: "/category.php?category=Hindi",
    categoryParam: "Hindi",
    type: "movie",
    group: "Bollywood & Hindi",
  },
  {
    title: "Hindi Dubbed",
    href: "/category.php?category=Hindi+Dubbed",
    categoryParam: "Hindi Dubbed",
    type: "movie",
    group: "Bollywood & Hindi",
  },
  {
    title: "Indian Bangla",
    href: "/category.php?category=Indian+Bangla",
    categoryParam: "Indian Bangla",
    type: "movie",
    group: "Bangla Cinema",
  },
  {
    title: "Indonesian",
    href: "/category.php?category=Indonesian",
    categoryParam: "Indonesian",
    type: "movie",
    group: "Asian Cinema",
  },
  {
    title: "Italy Movies",
    href: "/category.php?category=Italy+Movies",
    categoryParam: "Italy Movies",
    type: "movie",
    group: "European Cinema",
  },
  {
    title: "Japanese",
    href: "/category.php?category=Japanese",
    categoryParam: "Japanese",
    type: "movie",
    group: "Asian Cinema",
  },
  {
    title: "Kids Cartoon",
    href: "/category.php?category=Kids+Cartoon",
    categoryParam: "Kids Cartoon",
    type: "movie",
    group: "Animation & Anime",
  },
  {
    title: "Korean",
    href: "/category.php?category=Korean",
    categoryParam: "Korean",
    type: "movie",
    group: "Asian Cinema",
  },
  {
    title: "Pakistani",
    href: "/category.php?category=Pakistani",
    categoryParam: "Pakistani",
    type: "movie",
    group: "South Asian",
  },
  {
    title: "Punjabi",
    href: "/category.php?category=Punjabi",
    categoryParam: "Punjabi",
    type: "movie",
    group: "South Asian",
  },
  {
    title: "Turkey Movies",
    href: "/category.php?category=Turkey+Movies",
    categoryParam: "Turkey Movies",
    type: "movie",
    group: "Middle Eastern",
  },

  // Col 3: Hindi Dubbed Multilingual
  {
    title: "Chinese Movies (Hindi Dubbed)",
    href: "/category.php?category=Hindi+Dubbed%2FChinees+Movies",
    categoryParam: "Hindi Dubbed/Chinees Movies",
    type: "movie",
    group: "Hindi Dubbed Special",
  },
  {
    title: "English Movies (Hindi Dubbed)",
    href: "/category.php?category=Hindi+Dubbed%2FEnglish+Movies",
    categoryParam: "Hindi Dubbed/English Movies",
    type: "movie",
    group: "Hindi Dubbed Special",
  },
  {
    title: "Indonesian Movies (Hindi Dubbed)",
    href: "/category.php?category=Hindi+Dubbed%2FIndonesian+Movies",
    categoryParam: "Hindi Dubbed/Indonesian Movies",
    type: "movie",
    group: "Hindi Dubbed Special",
  },
  {
    title: "Italy Movies (Hindi Dubbed)",
    href: "/category.php?category=Hindi+Dubbed%2FItaly+Movies",
    categoryParam: "Hindi Dubbed/Italy Movies",
    type: "movie",
    group: "Hindi Dubbed Special",
  },
  {
    title: "Japanese Movies (Hindi Dubbed)",
    href: "/category.php?category=Hindi+Dubbed%2FJapanese+Movies",
    categoryParam: "Hindi Dubbed/Japanese Movies",
    type: "movie",
    group: "Hindi Dubbed Special",
  },
  {
    title: "Korean Movies (Hindi Dubbed)",
    href: "/category.php?category=Hindi+Dubbed%2FKorean+Movies",
    categoryParam: "Hindi Dubbed/Korean Movies",
    type: "movie",
    group: "Hindi Dubbed Special",
  },
  {
    title: "Tamil Movies (Hindi Dubbed)",
    href: "/category.php?category=Hindi+Dubbed%2FTamil+Movies",
    categoryParam: "Hindi Dubbed/Tamil Movies",
    type: "movie",
    group: "Hindi Dubbed Special",
  },
];

export const CINEPLEX_TV_CATEGORIES: CineplexCategory[] = [
  // Section: Animations & Shows
  {
    title: "Animation Series",
    href: "/tcategory.php?category=Animation+Series",
    categoryParam: "Animation Series",
    type: "series",
    group: "Animations & Shows",
  },
  {
    title: "Bangla Animation",
    href: "/tcategory.php?category=Bangla+Animation",
    categoryParam: "Bangla Animation",
    type: "series",
    group: "Animations & Shows",
  },
  {
    title: "Hindi Animation",
    href: "/tcategory.php?category=Hindi+Animation",
    categoryParam: "Hindi Animation",
    type: "series",
    group: "Animations & Shows",
  },
  {
    title: "English Animation",
    href: "/tcategory.php?category=English+Animation",
    categoryParam: "English Animation",
    type: "series",
    group: "Animations & Shows",
  },
  {
    title: "Others Animation",
    href: "/tcategory.php?category=Others+Animation",
    categoryParam: "Others Animation",
    type: "series",
    group: "Animations & Shows",
  },
  {
    title: "Award Shows",
    href: "/tcategory.php?category=Award+Shows",
    categoryParam: "Award Shows",
    type: "series",
    group: "Award Shows",
  },
  {
    title: "Bangla Shows",
    href: "/tcategory.php?category=Bangla+Shows",
    categoryParam: "Bangla Shows",
    type: "series",
    group: "Award Shows",
  },
  {
    title: "English Shows",
    href: "/tcategory.php?category=English+Shows",
    categoryParam: "English Shows",
    type: "series",
    group: "Award Shows",
  },
  {
    title: "Hindi Shows",
    href: "/tcategory.php?category=Hindi+Shows",
    categoryParam: "Hindi Shows",
    type: "series",
    group: "Award Shows",
  },
  {
    title: "Others Shows",
    href: "/tcategory.php?category=Others+Shows",
    categoryParam: "Others Shows",
    type: "series",
    group: "Award Shows",
  },

  // Section: Regional & Special
  {
    title: "Bangla Series",
    href: "/tcategory.php?category=Bangla+Series",
    categoryParam: "Bangla Series",
    type: "series",
    group: "Bangla Television",
  },
  {
    title: "Bangla Tv Series",
    href: "/tcategory.php?category=Bangla+Tv+Series",
    categoryParam: "Bangla Tv Series",
    type: "series",
    group: "Bangla Television",
  },
  {
    title: "Bangla Drama",
    href: "/tcategory.php?category=Bangla+Drama",
    categoryParam: "Bangla Drama",
    type: "series",
    group: "Bangla Television",
  },
  {
    title: "Entertainment",
    href: "/tcategory.php?category=Entertainment",
    categoryParam: "Entertainment",
    type: "series",
    group: "Regional & Special",
  },
  {
    title: "Indian Bangla",
    href: "/tcategory.php?category=Indian+Bangla",
    categoryParam: "Indian Bangla",
    type: "series",
    group: "Bangla Television",
  },
  {
    title: "Indian Bangla Drama",
    href: "/tcategory.php?category=Indian+Bangla+Drama",
    categoryParam: "Indian Bangla Drama",
    type: "series",
    group: "Bangla Television",
  },
  {
    title: "Documentary",
    href: "/tcategory.php?category=Documentary",
    categoryParam: "Documentary",
    type: "series",
    group: "Documentary",
  },
  {
    title: "Islamic Series",
    href: "/tcategory.php?category=Islamic+Series",
    categoryParam: "Islamic Series",
    type: "series",
    group: "Islamic & Historic",
  },
  {
    title: "Islamic Series (Bangla Dubbed)",
    href: "/tcategory.php?category=Bangla+Dubbed",
    categoryParam: "Bangla Dubbed",
    type: "series",
    group: "Islamic & Historic",
  },
  {
    title: "Islamic Series (Hindi Dubbed)",
    href: "/tcategory.php?category=Hindi+Dubbed",
    categoryParam: "Hindi Dubbed",
    type: "series",
    group: "Islamic & Historic",
  },

  // Section: Web Series & Sports
  {
    title: "Web Series",
    href: "/tcategory.php?category=Web+Series",
    categoryParam: "Web Series",
    type: "series",
    group: "Web Series",
  },
  {
    title: "Hindi Series",
    href: "/tcategory.php?category=Hindi+Series",
    categoryParam: "Hindi Series",
    type: "series",
    group: "Web Series",
  },
  {
    title: "Pakistani Series",
    href: "/tcategory.php?category=Pakistani+Series",
    categoryParam: "Pakistani Series",
    type: "series",
    group: "Web Series",
  },
  {
    title: "English Series",
    href: "/tcategory.php?category=English+Series",
    categoryParam: "English Series",
    type: "series",
    group: "Web Series",
  },
  {
    title: "Chinese Series",
    href: "/tcategory.php?category=Chinese+Series",
    categoryParam: "Chinese Series",
    type: "series",
    group: "Web Series",
  },
  {
    title: "Korean Series",
    href: "/tcategory.php?category=Korean+Series",
    categoryParam: "Korean Series",
    type: "series",
    group: "Web Series",
  },
  {
    title: "Japanese Series",
    href: "/tcategory.php?category=Japanese+Series",
    categoryParam: "Japanese Series",
    type: "series",
    group: "Web Series",
  },
  {
    title: "Bangla Dubbed Series",
    href: "/tcategory.php?category=Others+Series",
    categoryParam: "Others Series",
    type: "series",
    group: "Web Series",
  },
  {
    title: "Others Dubbed Series",
    href: "/tcategory.php?category=Others+Dubbed+Series",
    categoryParam: "Others Dubbed Series",
    type: "series",
    group: "Web Series",
  },
  {
    title: "WWE",
    href: "/tcategory.php?category=WWE",
    categoryParam: "WWE",
    type: "series",
    group: "Sports & Wrestling",
  },
  {
    title: "AEW Wrestling",
    href: "/tcategory.php?category=AEW+Wrestling",
    categoryParam: "AEW Wrestling",
    type: "series",
    group: "Sports & Wrestling",
  },
  {
    title: "WWE Wrestling",
    href: "/tcategory.php?category=WWE+Wrestling",
    categoryParam: "WWE Wrestling",
    type: "series",
    group: "Sports & Wrestling",
  },
];

export const ALL_CINEPLEX_CATEGORIES = [
  ...CINEPLEX_MOVIE_CATEGORIES,
  ...CINEPLEX_TV_CATEGORIES,
];

export function getCategoriesByType(type: ContentType): CineplexCategory[] {
  return type === "movie" ? CINEPLEX_MOVIE_CATEGORIES : CINEPLEX_TV_CATEGORIES;
}

export function findCategoryByParam(
  param: string,
): CineplexCategory | undefined {
  if (!param) return undefined;
  const decoded = decodeURIComponent(param).toLowerCase().trim();
  return ALL_CINEPLEX_CATEGORIES.find(
    (c) =>
      c.categoryParam.toLowerCase() === decoded ||
      c.title.toLowerCase() === decoded,
  );
}

export function getCategoryGroups(type?: ContentType): CategoryGroup[] {
  const cats = type ? getCategoriesByType(type) : ALL_CINEPLEX_CATEGORIES;
  const groupsMap = new Map<string, CineplexCategory[]>();

  for (const cat of cats) {
    const gName = cat.group || (cat.type === "movie" ? "Movies" : "TV Series");
    if (!groupsMap.has(gName)) {
      groupsMap.set(gName, []);
    }
    groupsMap.get(gName)!.push(cat);
  }

  return Array.from(groupsMap.entries()).map(([name, categories]) => ({
    name,
    type: categories[0]?.type || "movie",
    categories,
  }));
}
