import {element} from './dom';
export function catalogLayout(table:HTMLElement,pager:HTMLElement,detail:HTMLElement){const grid=element('div','ga-model-catalog-layout'),list=element('div','ga-model-catalog-list');list.append(table,pager);grid.append(list,detail);return grid;}
