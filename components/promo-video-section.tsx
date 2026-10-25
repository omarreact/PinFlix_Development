import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CinematicVideo } from "./cinematic-video";
export function PromoVideoSection({ poster }: { poster: string | null }) {
  return (
    <section className="promo-section" aria-label="Explore beyond the screen">
      <CinematicVideo
        poster={poster}
        label="Cinematic promotional video"
      />
      <div className="promo-shade" />
      <div className="promo-copy">
        <p className="eyebrow">EXPLORE BEYOND THE SCREEN</p>
        <h2>
          Every story.
          <br />
          An extraordinary
          <br />
          <em>escape.</em>
        </h2>
        <p>
          Discover extraordinary movies, unforgettable series, and worlds beyond
          imagination.
        </p>
        <div className="actions">
          <Link href="/movies" className="primary light">
            Explore Movies <ArrowUpRight size={17} />
          </Link>
          <Link href="/series" className="secondary">
            Browse Series
          </Link>
        </div>
      </div>
      <span className="promo-side-note">
        EVERY STORY DESERVES A CINEMATIC EXPERIENCE
      </span>
    </section>
  );
}
