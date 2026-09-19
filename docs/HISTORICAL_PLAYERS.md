# Historical Player Database Design

Target: approximately 1,000 historically famous football players, not merely current players.

## Data principles
- Build the initial pool from multiple open/public sources and cross-check identities.
- Prefer stable identifiers (Wikidata/Reep IDs) to names alone.
- Keep source attribution and license metadata for every imported field.
- Do not copy proprietary game ratings, player images, club crests, or licensed assets.
- Separate factual biography from game-designed attributes.

## Suggested eras
1950s-1960s, 1970s, 1980s, 1990s, 2000s, 2010s, 2020s.

## Suggested positions
GK, CB, SW, RB, LB, DM, CM, AM, RM, LM, RW, LW, SS, ST.

## Game record
Each player should eventually contain:
- id
- display_name
- full_name
- nationality
- birth_date
- era
- primary_position
- secondary_positions
- preferred_foot
- height_cm
- peak_years
- notable_clubs
- notable_national_team
- source_ids
- source_license
- game_overall
- pace
- shooting
- passing
- dribbling
- defending
- physical
- stamina
- goalkeeper
- role_tags

## Important historical rule
Ratings are game-system attributes created by our project. They must not be represented as official ratings from a third-party game or database.

## Initial source candidates
- openfootball/players: open public-domain player data by country and position.
- Reep: CC0 football identity register with cross-provider IDs and biographical fields.
- Wikidata: identity and historical metadata.
- Other open sources may be added after license and provenance checks.

## Roadmap
1. Construct a deduplicated candidate pool larger than 1,000.
2. Score/select approximately 1,000 historically notable players using transparent criteria.
3. Cross-check names, dates, nationality, and positions.
4. Generate project-specific game attributes.
5. Add the player browser and squad-building UI.
6. Connect player attributes to gameplay AI and physics.
7. Add eras, legends teams, and historical squads.
