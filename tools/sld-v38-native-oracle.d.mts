import type {StationTopologyGraph} from '../src/domain/model/station-topology';
export function inspectSwitchVisibility(xml:string,graph:StationTopologyGraph,raw:{StaCubic:Record<string,unknown>[];ElmCoup:Record<string,unknown>[]}):{errors:string[];sourceSwitches:number;visibleSwitches:number;hiddenSwitches:string[];components:{switches:string[];boundary:string[];removedTerminals:string[]}[]};
