import type {Page} from 'playwright';
export function closeAnalysisDialogs(page:Page):Promise<void>;
export function navigateAnalysis(page:Page,label:string):Promise<void>;
export function openAnalysisTools(page:Page):Promise<void>;
