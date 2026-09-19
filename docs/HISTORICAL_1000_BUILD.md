# Historical 1,000 Player Build Plan

The production target is approximately 1,000 famous footballers from football history, spanning multiple eras and positions.

## Production principles
- Mobile-first browser game remains the primary runtime.
- GitHub is the source of truth.
- Prefer reproducible, pinned source snapshots over live runtime dependencies.
- Cross-check identity fields from independent sources.
- Preserve provenance and license/attribution metadata.
- Never copy proprietary game code, ratings, images, club crests, or licensed assets.
- Project-specific gameplay ratings are derived by this project and are not official third-party ratings.
- Keep data ingestion separate from gameplay code so the roster can grow beyond 1,000.

## Selection pipeline
1. Build a candidate pool substantially larger than 1,000.
2. Normalize names, dates, nationalities, positions, and IDs.
3. Deduplicate using stable IDs plus conservative name/date matching.
4. Cross-check historical facts.
5. Select approximately 1,000 using transparent coverage rules:
   - era coverage
   - position coverage
   - geographic/national-team coverage
   - club and international prominence
   - historical significance
   - availability and provenance of reliable data
6. Generate independent game attributes.
7. Validate the final dataset with automated schema, duplicate, range, and provenance checks.
8. Integrate the roster into menus, squads, AI behavior, and gameplay.

## Data model
id, display_name, full_name, nationality, birth_date, era, primary_position,
secondary_positions, preferred_foot, height_cm, peak_years, notable_clubs,
notable_national_team, source_ids, source_license, game_overall, pace,
shooting, passing, dribbling, defending, physical, stamina, goalkeeper,
weak_foot, skill, role_tags.

## Gameplay integration
Player data must affect actual gameplay:
- pace/acceleration -> movement
- shooting -> shot power/accuracy
- passing -> pass accuracy/weight
- dribbling -> close control and turn response
- defending -> marking/tackle/interception behavior
- physical -> contact resistance
- stamina -> fatigue
- goalkeeper -> save/positioning behavior
- role_tags -> AI movement and decision tendencies

## Quality gates
- No duplicate canonical player IDs.
- No impossible numeric ranges.
- No missing mandatory identity fields for selected players.
- No unsupported claims of historical status.
- No source with unclear licensing used for bundled assets without review.
- No player is considered integrated until data loading and gameplay usage are both verified.

## Expansion
Design for 1,000 first, but keep the schema/API capable of 2,000+ players without rewriting gameplay systems.
