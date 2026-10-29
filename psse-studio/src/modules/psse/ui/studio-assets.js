import asset_RUNNER_B64 from "../assets/studio-assets-RUNNER_B64.txt";
// Migrated V12 studio. Private per-instance bindings; no DGS controller.
export function define(ctx) {}
export const initializers = [[28, ctx => {
  ctx.named = {
    nd: ["Bus", "Plant", "Machine", "Load", "Fixed Shunt", "AC Line", "2 Winding", "System Swith. Dev.", "Substation", "Branch Rating Name", "Swith. Dev. Rating Name", "Swith. Dev. Ratings", "Area", "Owner", "Zone", "Voltage Droop", "Load Type"],
    nr: ["BUS", "AC Line", "Machine", "Load", "Fixed Shunt", "2 Winding", "Plant", "Limit Plant", "Zone", "Owner", "Area"]
  };
}], [29, ctx => {
  ctx.targetKind = {
    "Bus": "bus",
    "Plant": "other",
    "Machine": "generator",
    "Load": "load",
    "Fixed Shunt": "shunt",
    "AC Line": "line",
    "2 Winding": "transformer",
    "System Swith. Dev.": "switch",
    "Substation": "substation",
    "Voltage Droop": "other",
    "Load Type": "other",
    "Area": "other",
    "Owner": "other",
    "Zone": "other"
  };
}], [35, ctx => {
  ctx.RUNNER_B64 = asset_RUNNER_B64;
}], [36, ctx => {
  ctx.BAT_B64 = "QGVjaG8gb2ZmCnNldGxvY2FsCmNkIC9kICIlfmRwMCIKZWNobyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CmVjaG8gR0EgLyBQU1MtRSBsaWNlbnNlZCBGTlNMIHJlZmVyZW5jZSAtIFB5dGhvbiAzLjE0IC8gUFNTUFkzMTQKZWNobyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CndoZXJlIHB5ID5udWwgMj5udWwKaWYgZXJyb3JsZXZlbCAxICgKICBlY2hvIEhBVEE6IFB5dGhvbiBsYXVuY2hlciBidWx1bmFtYWRpLiBQeXRob24gMy4xNCB4NjQga3VydW4gdmUgcHkgLTMuMTQga29tdXR1bnUga3VsbGFuaW4uCiAgcGF1c2UKICBleGl0IC9iIDEKKQpweSAtMy4xNCAtYyAiaW1wb3J0IHN5cztwcmludCgnUHl0aG9uJyxzeXMudmVyc2lvbikiID5udWwgMj5udWwKaWYgZXJyb3JsZXZlbCAxICgKICBlY2hvIEhBVEE6IFB5dGhvbiAzLjE0IGJ1bHVuYW1hZGkuIHB5IC0wcCBpbGUga3VydWx1IFB5dGhvbiBzdXJ1bWxlcmluaSBpbmNlbGV5aW4uCiAgZWNobyBQU1NQWTMxNCBpbGUgUHl0aG9uIDMuMTIgY2FsaXN0aXJpbGFtYXouCiAgcGF1c2UKICBleGl0IC9iIDEKKQppZiBub3QgZXhpc3QgIlBTU0VfTE9DQUxfSk9CLmpzb24iICgKIGVjaG8gSEFUQTogUFNTRV9MT0NBTF9KT0IuanNvbiBidSBrbGFzb3JkZSB5b2suIEhUTUwgUG93ZXIgU29sdmUgYm9sdW11bmRlbiBkb3N5YXlpIGluZGlyaW4uCiBwYXVzZQogZXhpdCAvYiAxCikKcHkgLTMuMTQgIiV+ZHAwUFNTX0VfTE9DQUxfUkVGRVJFTkNFX1JVTk5FUl9WNy5weSIgLS1qb2IgIiV+ZHAwUFNTRV9MT0NBTF9KT0IuanNvbiIgLS1vdXQgIiV+ZHAwR0FfUFNTRV9SRUZFUkVOQ0VfVjEuanNvbiIKc2V0ICJSQz0lRVJST1JMRVZFTCUiCmVjaG8uCmlmICIlUkMlIj09IjAiICgKIGVjaG8gQkFTQVJJTEk6IEdBX1BTU0VfUkVGRVJFTkNFX1YxLmpzb24gZG9zeWFzaW5pIEhUTUwgLyBHQSBTb251Y2xhcmkgc2VrbWVzaW5kZW4gaWNlIGFrdGFyaW4uCikgZWxzZSAoCiBlY2hvIEhBVEEga29kdSAlUkMlLiBNb2RlbCBTSEEtMjU2LCBQeXRob24gMy4xNCB2ZSB5ZXJlbCBQU1MvRSBrdXJ1bHVtdW51IGtvbnRyb2wgZWRpbi4KKQpwYXVzZQpleGl0IC9iICVSQyUK";
}]];
