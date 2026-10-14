// Cartes : contour du pays du sujet (Natural Earth 1:50m, paquet world-atlas)
// et globe de Bienvenue. Projection faite dans l'app avec d3-geo.
//
// Le fichier 50m pèse 756 Ko et part en entier dans l'app : le pays d'un
// sujet n'est connu qu'au réveil, et un découpage par pays embarquerait de
// toute façon tous les pays. Il n'est lu qu'à la première carte affichée.
import {
  type GeoPermissibleObjects,
  geoBounds,
  geoContains,
  geoDistance,
  geoGraticule10,
  geoMercator,
  geoOrthographic,
  geoPath,
} from 'd3-geo';
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

type Country = Feature<Polygon | MultiPolygon>;

// Le sujet est cadré plus serré que le pays entier : la ville compte plus
// que les frontières lointaines.
const MAP_ZOOM = 1.8;

let countries: Country[] | null = null;

function loadCountries(): Country[] {
  if (!countries) {
    const topology = require('world-atlas/countries-50m.json') as Topology<{ countries: GeometryCollection }>;
    const collection = feature(topology, topology.objects.countries) as FeatureCollection<Polygon | MultiPolygon>;
    countries = collection.features;
  }
  return countries;
}

const polygonsOf = (country: Country): Polygon[] =>
  country.geometry.type === 'Polygon'
    ? [country.geometry]
    : country.geometry.coordinates.map((coordinates) => ({ type: 'Polygon', coordinates }));

/** Distance angulaire du point au sommet le plus proche du polygone. */
function distanceTo(polygon: Polygon, point: Position): number {
  let best = Infinity;
  for (const ring of polygon.coordinates) {
    for (const vertex of ring) best = Math.min(best, geoDistance(vertex as [number, number], point as [number, number]));
  }
  return best;
}

/**
 * Pays et partie du pays où se trouve le point. Une ville côtière tombe
 * parfois juste hors du tracé simplifié : on prend alors le plus proche.
 */
function locate(lon: number, lat: number): { country: Country; part: Polygon } | null {
  const point: Position = [lon, lat];
  let nearest: { country: Country; part: Polygon; distance: number } | null = null;
  for (const country of loadCountries()) {
    if (!country.geometry) continue;
    for (const part of polygonsOf(country)) {
      if (geoContains(part, point as [number, number])) return { country, part };
      // Un pays dont l'emprise est loin du point ne peut pas être le plus proche.
      const [[west, south], [east, north]] = geoBounds(part);
      if (lat < south - 5 || lat > north + 5 || (east > west && (lon < west - 5 || lon > east + 5))) continue;
      const distance = distanceTo(part, point);
      if (!nearest || distance < nearest.distance) nearest = { country, part, distance };
    }
  }
  return nearest;
}

export type TopicMapShape = { d: string; x: number; y: number };

/** Tracé du pays, cadré pour une carte de `width` × `height`, centré sur la ville. */
export function topicMapShape(lon: number, lat: number, width: number, height: number): TopicMapShape | null {
  const found = locate(lon, lat);
  if (!found) return null;
  // L'échelle vient de la partie du pays où est la ville : pour la France,
  // la métropole, pas la Guyane.
  const fitted = geoMercator().fitSize([width, height], found.part);
  const projection = geoMercator()
    .scale(fitted.scale() * MAP_ZOOM)
    .center([lon, lat])
    .translate([width / 2, height / 2]);
  const d = geoPath(projection)(found.country);
  const at = projection([lon, lat]);
  if (!d || !at) return null;
  return { d, x: at[0], y: at[1] };
}

export type GlobeShape = {
  sphere: string;
  graticule: string;
  /** Points visibles seulement : ceux de la face cachée sont null. */
  points: ({ x: number; y: number } | null)[];
};

/** Globe filaire vu depuis `center` (longitude, latitude), avec les points donnés. */
export function globeShape(size: number, center: [number, number], points: [number, number][]): GlobeShape {
  const projection = geoOrthographic()
    .scale(size / 2 - 1)
    .translate([size / 2, size / 2])
    .rotate([-center[0], -center[1]])
    .clipAngle(90);
  const path = geoPath(projection);
  return {
    sphere: path({ type: 'Sphere' } as GeoPermissibleObjects) ?? '',
    graticule: path(geoGraticule10()) ?? '',
    points: points.map((p) => {
      if (geoDistance(p, center) > Math.PI / 2) return null;
      const xy = projection(p);
      return xy ? { x: xy[0], y: xy[1] } : null;
    }),
  };
}
