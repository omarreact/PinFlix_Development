import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
import snapshot from "@/data/catalogue.json";
import { TitleSchema } from "@/lib/model";
import { universeFor } from "@/lib/curation";
import { Hero } from "@/components/hero";
import { LiveRow } from "@/components/live-row";
import { VideoSpotlightSlider, type SpotlightItem } from "@/components/VideoSpotlightSlider";
import { MarvelVsDc } from "@/components/marvel-vs-dc";
import { TimelessClassics } from "@/components/timeless-classics";
import { HiddenGems } from "@/components/hidden-gems";
import { ContinueRail } from "@/components/continue-rail";

export default function Home() {
  const details = new Map(
    snapshot.details.map((d) => [d.title.id, TitleSchema.parse(d.title)]),
  );
  const items = TitleSchema.array()
    .parse(snapshot.items)
    .filter((t) => !t.mature)
    .map((t) => details.get(t.id) || t);
  const movies = items
    .filter((t) => t.kind === "movie")
    .sort((a, b) => Number(b.providerId) - Number(a.providerId));
  const series = items.filter((t) => t.kind === "series");
  const featured = [
    "movie-78724",
    "series-31416",
    "movie-77533",
    "movie-34110",
  ].flatMap((id) => items.find((t) => t.id === id) || []);
  // Keep spotlight entries connected to actual catalog routes and My List.
  const spotlightTitles = ["movie-78828", "movie-78724", "movie-34110"]
    .flatMap((id) => movies.find((movie) => movie.id === id) || []);
  const spotlightItems: SpotlightItem[] = spotlightTitles.map((movie) => ({
    movie,
    trailerUrl: null,
    synopsis: movie.synopsis ||
      "Discover " + movie.title + " in the CineplexBD catalogue and save it to My List.",
  }));
  const classics = items.filter((t) => t.year && t.year < 2010);
  const gems = items
    .filter((t) => t.year && t.year >= 2010 && t.year < 2020)
    .slice(0, 10);
  return (
    <>
      <Hero titles={featured} />
      <div className="page-content">
        <div className="discovery-bar">
          <span>
            <Compass size={15} /> FIND YOUR NEXT STORY
          </span>
          <div className="chips">
            {[
              "English",
              "Bangla",
              "Hindi",
              "Animation",
              "Documentaries",
              "Dual Audio",
            ].map((c) => (
              <Link key={c} href={`/movies/?category=${encodeURIComponent(c)}`}>
                {c}
              </Link>
            ))}
            <Link href="/movies/">
              All collections <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
        <ContinueRail />
        <LiveRow
          kind="movie"
          kicker="FRESH ON PINFLIX"
          title="New stories. New obsessions."
          initial={movies.slice(0, 12)}
        />
      </div>
      <VideoSpotlightSlider items={spotlightItems} />
      <div className="page-content">
        <LiveRow
          kind="series"
          kicker="ONE MORE EPISODE"
          title="Your next binge starts here."
          initial={series.slice(0, 12)}
        />
        <MarvelVsDc
          marvelTitles={items.filter((t) => universeFor(t) === "marvel")}
          dcTitles={items.filter((t) => universeFor(t) === "dc")}
        />
        <TimelessClassics titles={classics} />
        <HiddenGems titles={gems} />
        <div className="end-discovery">
          <span className="eyebrow">THE CREDITS CAN WAIT</span>
          <h2>There’s always another story.</h2>
          <p>Explore the collection. Find something that stays with you.</p>
          <Link href="/search/" className="secondary">
            Find your next favourite <ArrowUpRight size={17} />
          </Link>
        </div>
      </div>
    </>
  );
}
