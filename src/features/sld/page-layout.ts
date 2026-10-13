import type {StationTopologyGraph} from '../../domain/model/station-topology';
import type {VoltageBand} from '../../domain/model/voltage-band';
import {connectedStationLayout} from './physical-layout';
/** The station page contains native rails, contacts and equipment, never summary cards. */
export function stationOverviewPage(graph:StationTopologyGraph,bands:ReadonlySet<VoltageBand>,flowLabels=false){return connectedStationLayout(graph,bands,flowLabels);}
