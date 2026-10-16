import type {StationTopologyGraph} from '../src/domain/model/station-topology';
export function segmentsOf(d:string):number[][][];
export function inspectPilotSvg(xml:string,graph:StationTopologyGraph,scope?:string):{errors:string[];foreignTouches:unknown[];overlap:unknown[];[key:string]:unknown};
