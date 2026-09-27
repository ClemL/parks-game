import { createContext, useContext, useEffect, useState } from 'react';
import { SceneSvg } from './illustrated';
import { loadWikipediaArt, type ArtMap } from './parkArt';
import { CAMPSITE_SCENES, SITE_SCENES } from './sites';

export type SiteArtStyle = 'illustrated' | 'photos' | 'none';

/**
 * The English Wikipedia article whose lead image stands in for each trail site
 * and campsite when photographs are chosen. An article with no usable image
 * leaves that tile with its illustration.
 */
export const SITE_PHOTO_TITLES: Record<string, string> = {
  trailhead: 'Trailhead',
  'trail-end': 'Campsite',
  forest: 'Forest',
  mountain: 'Ridge',
  valley: 'Valley',
  basin: 'Desert',
  waterfall: 'Waterfall',
  camera: 'Landscape photography',
  'adv-wildcard': 'Bird hide',
  'adv-swap': 'Trading post',
  'adv-park': 'Ranger station',
  'adv-copy': 'Scenic viewpoint',
  'adv-memory': 'Cliff',
  'adv-bison': 'American bison',
  'adv-lookout': 'Fire lookout tower',
  'adv-talk': 'Park ranger',
  stargazing: 'Amateur astronomy',
  'nightfall-camp': 'Camping',
  'forest-clearing': 'Glade (geography)',
  'alpine-bivouac': 'Bivouac shelter',
  'riverside-camp': 'Canoe camping',
  'outfitter-camp': 'Outfitter',
};

const NONE: ArtMap = {};

/** Photographs for the sites, fetched only when the player asks for them. */
export function useSiteArt(style: SiteArtStyle): ArtMap {
  const [photos, setPhotos] = useState<ArtMap>(NONE);
  useEffect(() => {
    if (style !== 'photos') {
      setPhotos(NONE);
      return;
    }
    let alive = true;
    loadWikipediaArt(Object.values(SITE_PHOTO_TITLES))
      .then((art) => alive && setPhotos(art))
      .catch(() => alive && setPhotos(NONE));
    return () => {
      alive = false;
    };
  }, [style]);
  return photos;
}

export const SiteArtContext = createContext<{ style: SiteArtStyle; photos: ArtMap }>({
  style: 'illustrated',
  photos: NONE,
});

/**
 * The picture behind a trail site tile or on a campsite card: a photograph, an
 * illustration, or nothing, as chosen. Decorative: the tile already says what
 * it is in words.
 */
export function SiteArt({ id, className = 'site-art' }: { id: string; className?: string }) {
  const { style, photos } = useContext(SiteArtContext);
  if (style === 'none') return null;
  const photo = style === 'photos' ? photos[SITE_PHOTO_TITLES[id]] : undefined;
  const scene = SITE_SCENES[id as keyof typeof SITE_SCENES] ?? CAMPSITE_SCENES[id];
  if (!photo && !scene) return null;
  return (
    <span className={className} aria-hidden="true">
      {photo ? (
        <img className="site-art-img" src={photo.url} alt="" loading="lazy" />
      ) : (
        <SceneSvg scene={scene} label={scene.view} className="site-art-svg" />
      )}
    </span>
  );
}
