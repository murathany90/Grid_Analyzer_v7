import {sha256} from '@noble/hashes/sha2.js';
import type {PsseBusBranchNetwork} from './network';
const hashText=(text:string)=>Array.from(sha256(new TextEncoder().encode(text)),x=>x.toString(16).padStart(2,'0')).join('');
/** Any change that alters calculated equations, eligibility, or published values advances this engine identity. */
export const PSSE_ENGINE_VERSION='GA_PSSE_ENGINE_4';
function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));if(typeof value==='number'&&!Number.isFinite(value))throw Error('PSSE_OPTIONS_NONFINITE');return value;}
export function psseOptionsHash(options:unknown){return hashText(JSON.stringify(canonical(options)));}
export interface PsseCalculationIdentity {schema:'ga.psse.calculation-identity.v1';mode:'PSSE';sourceSha256:string;modelHash:string;topologyHash:string;normalizedModelHash:string;normalizedRevision:string;scenarioHash:string;solver:'NR_POLAR'|'FDNS_XB'|'LOSSLESS_DC';engineVersion:string;algorithmId:'NR_POLAR'|'FDNS_XB'|'LOSSLESS_DC';algorithmRevision:string;controlPolicyId:string;controlPolicyRevision:string;optionsHash:string;resultSchemaRevision:string;initialVoltagePolicy:string;id:string}
export function psseCalculationIdentity(input:Omit<PsseCalculationIdentity,'schema'|'id'>):PsseCalculationIdentity{const body={schema:'ga.psse.calculation-identity.v1' as const,...input};return {...body,id:'psse-'+hashText(JSON.stringify(body))};}
export function psseTopologyHash(network:PsseBusBranchNetwork){return hashText(JSON.stringify({buses:network.buses.map((b,i)=>[i,b.connectionKey,b.status,b.type,b.source]).sort((a,b)=>String(a[1]).localeCompare(String(b[1]))),branches:network.branches.map(b=>[b.id,b.fromKey,b.toKey,b.windingId,b.status,b.kind]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))}));}
