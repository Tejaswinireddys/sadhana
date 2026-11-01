# Pose catalog export

`poses.json` is generated from the fully merged `ASANAS` catalog in
`client/src/data/content.ts`. Do not edit the JSON directly.

- Regenerate: `npm run gen:poses`
- Validate completeness, images, references and freshness: `npm run check:poses`
- Type and runtime schema: `PoseExport` in `shared/poseExport.ts`

The JSON is an array in catalog order. `isPlus` mirrors the explicit catalog
access flag (currently false for all poses). `id` is the stable slug (the source has
no separate numeric ID). `sanskrit` and `english` preserve source names;
`level` maps to difficulty. `duration` contains the hold label and hold seconds,
not a full guided-session estimate; dynamic practices retain their source label.
`focusAreas` contains stretch-zone region names. `steps` contains the default
catalog step text; `cues` contains variation cues for the pose's catalog difficulty.
`cautions` preserves every structured `avoidIf` condition and its severity,
including avoid/modify/caution. `contraindications` preserves the legacy list.
`relatedPoses` contains up to eight slugs using the detail page's rule:
same category, matching difficulty first, then catalog order. `imagePath` is
relative to the public web root. All `videoUrl` values are intentionally empty.

## PR validation and source gaps

All 207 records have the required fields populated, except the explicitly empty
`videoUrl`. IDs, slugs, Sanskrit names and English names are unique. All image
files exist and related slugs resolve without self-links or duplicate links.
The unit suite checks that the committed export matches regeneration and rejects
missing fields, duplicate identities/names and invalid references.

Source limitations preserved by this export:

- There is no authored relationship graph; related poses are derived using the
  existing UI rule, not reviewed sequencing recommendations.
- There are no published reviewed movement demonstrations; empty video URLs
  must not be filled from generated decorative clips. See
  `docs/instructor-content-workflow.md`.
- Benefit text is copied verbatim, not medically validated. The existing review
  backlog covers 85 claims across 72 poses; see `docs/benefit-claim-review.md`.
- Existing illustration accuracy caveats still apply; see
  `client/src/data/poseImageAccuracy.ts`. File existence does not prove accuracy.
- This portable subset does not carry every difficulty variation, modification,
  illustration caveat or the complete session timing model. The live catalog and
  its existing safety/media/timing helpers remain authoritative for teaching.
