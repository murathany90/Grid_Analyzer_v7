# SLD editor architecture

This document describes a future editor. The current SLD is a read-only view
derived from `CanonicalNetwork`; it does not yet store user-authored positions
or edit the network.

## Two sources of truth

`CanonicalNetwork` owns electrical identity and topology: buses, endpoints,
equipment parameters, service state, source references and model capabilities.
An SLD must reference those entity IDs. A line drawn between two symbols cannot
create electrical connectivity on its own.

`DiagramDocument` owns presentation: symbol positions, labels, route points,
groups, visible layers and viewport. It may have multiple documents for the
same canonical model, such as a station view and a regional view. It should
carry the model hash or revision it was created against so a stale drawing can
be detected after a model edit.

The current `DiagramDocument` view contract contains a station, bus groups,
equipment and bays. The editor document can extend that contract with stable
IDs and layout fields without changing the network schema.

## Commands and model patches

Edits should be commands applied as atomic `ModelPatch` transactions. A patch
contains the affected network entities and diagram records, validates its
preconditions, and can be inverted for undo. The command history belongs to the
model editor; it is separate from scenario history.

Planned commands are:

- `AddBus`, `AddLine`, and `AddTransformer` create canonical entities and the
  corresponding diagram symbols or edges.
- `Move` changes a symbol's document position. It is recorded in a patch so it
  can be undone, but it does not change electrical connectivity.
- `Connect` changes the canonical endpoints and updates the diagram edge in the
  same transaction.
- `Delete` removes a selected entity after checking references and dependent
  equipment.
- `ChangeParameter` changes a typed canonical field with its unit and source
  reference handled explicitly.

Applying a successful electrical patch creates a new immutable
`CanonicalNetwork` revision and a matching model identity. The editor must not
mutate an existing network object in place.

Scenario changes remain temporary what-if overlays: service states, switch
positions, generator dispatch, load adjustments and restored terminals. A
scenario is not a permanent edit and must never be written into a `ModelPatch`.
Resetting a scenario restores the model revision that was active before the
scenario began.

## Rendering and validation

The renderer consumes `CanonicalNetwork` plus `DiagramDocument`. It reads node
positions and paths from the document, then resolves names, voltage classes,
service state and connectivity through canonical entities. Selection returns
the canonical entity ID so the map, inventory and details panel can select the
same object.

Before commit, validate that entity references exist, branch endpoints are
valid buses, electrical parameters use known units, and diagram IDs are unique.
Reject or clearly mark dangling edges. Keep scenario highlighting as a visual
layer over the base diagram; do not serialize it as permanent drawing data.

Undo and redo should replay complete validated patches. If an undo target no
longer matches the model revision, ask the caller to resolve the conflict
rather than applying a partial patch. Persistence should version the document
format and keep it separate from DGS source data.

## Implementation status

This is a design note only. The current SLD renderer displays a derived station
view; model-editing commands, layout persistence and SLD undo/redo are not
implemented.
