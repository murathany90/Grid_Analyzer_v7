/** Local equirectangular WGS84 projection, standard parallel 39°N (Türkiye). */
export function projectWgs84(lon:number,lat:number):[number,number] {
  return [lon-35.5,-(lat-39)/Math.cos(39*Math.PI/180)];
}
