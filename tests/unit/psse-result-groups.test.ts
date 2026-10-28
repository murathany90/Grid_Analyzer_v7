import test from 'node:test';
import assert from 'node:assert/strict';
import type {PsseBranch} from '../../src/domain/psse/network';
import {groupPsseResultBranches} from '../../src/features/psse/result-groups';
const branch=(id:string,sourceEquipmentId:string,kind:PsseBranch['kind'],windingId:string)=>({id,sourceEquipmentId,kind,windingId}) as PsseBranch;
test('line and transformer views group physical equipment without presenting star legs as separate transformers',()=>{
 const branches=[branch('line','line','line','1'),branch('two','two','transformer','1'),branch('leg3','three','three-winding-leg','3'),branch('leg1','three','three-winding-leg','1'),branch('leg2','three','three-winding-leg','2'),branch('second-leg','another','three-winding-leg','1')];
 const lines=groupPsseResultBranches(branches,'lines');assert.deepEqual(lines.map(group=>group.map(item=>item.id)),[['line']]);
 const transformers=groupPsseResultBranches(branches,'transformers');assert.deepEqual(transformers.map(group=>group.map(item=>item.id)),[['two'],['leg1','leg2','leg3'],['second-leg']]);
 assert.deepEqual(groupPsseResultBranches(branches,'transformers','2w').map(group=>group[0].id),['two']);
 assert.deepEqual(groupPsseResultBranches(branches,'transformers','3w').map(group=>group[0].sourceEquipmentId),['three','another']);
 assert.deepEqual(branches.map(item=>item.id),['line','two','leg3','leg1','leg2','second-leg']);
});
