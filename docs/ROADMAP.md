# Production Roadmap

## Definition of done for today's foundation
- [x] GitHub repository established as source of truth
- [x] Godot project scaffold
- [x] Playable match loop
- [x] Movement and sprint
- [x] Passing
- [x] Shooting
- [x] Ball boundary physics
- [x] Goals and score
- [x] Match timer / full time
- [x] Restart flow
- [x] GitHub CI smoke checks
- [x] Clean-room implementation with no proprietary assets/code

## Next engineering stages
1. Modularize Player, Ball, Match, Team, AI, Camera, and UI systems.
2. Add player switching and contextual controls.
3. Add goalkeeper state machine and defensive positioning.
4. Add tactical formations and role instructions.
5. Add player attributes and deterministic simulation tests.
6. Add animation state machines and 3D presentation.
7. Add replay/camera systems.
8. Add save data and roster management.
9. Add mobile touch controls.
10. Add online architecture only after offline gameplay is stable.

## Quality gates
Every major feature must:
- run without parser/runtime errors
- preserve existing gameplay
- have a focused smoke test
- avoid data races and hidden state
- be deterministic where practical
- be benchmarked before optimization claims
- be committed with a small, descriptive change

## Performance principle
Do not chase visual feature count before the core match loop feels responsive. Prefer simple deterministic systems first, then replace components with higher-fidelity implementations behind stable interfaces.
