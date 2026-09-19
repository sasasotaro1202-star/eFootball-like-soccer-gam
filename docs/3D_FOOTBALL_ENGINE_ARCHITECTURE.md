# 3D Football Engine Architecture

## Goal

Build an original browser 3D football game targeting eFootball-class gameplay depth and presentation while remaining practical on iPhone-class hardware. This is an implementation target, not a claim of feature parity with any proprietary game.

## Runtime architecture

```
Presentation
  ├─ HUD / radar / audio / haptics
  └─ broadcast camera / replay
Match simulation (fixed 120 Hz)
  ├─ Input
  ├─ Player state
  ├─ Team tactics
  ├─ Ball state
  ├─ Collision / possession
  └─ Match rules
Rendering
  ├─ Three.js / WebGL
  ├─ PBR-capable materials
  ├─ stadium / crowd / lighting
  └─ animation mixers
```

The current browser implementation uses an ECS-inspired separation of data and systems rather than importing a native ECS engine. This avoids forcing Wicked Engine, O3DE, Bevy, or Jolt into a mobile browser runtime where their native architecture is not directly usable.

## Research-derived principles

### Rendering
- **Wicked Engine**: study modern rendering, PBR, GPU-oriented design, ECS concepts, and scalable scene presentation.
- **O3DE**: study modular engine architecture, asset management, animation, physics, audio, and large-world organization.
- **Bevy**: study data-oriented ECS, loose coupling, cache-friendly and parallel system design.
- **Jolt Physics**: study multi-core-friendly rigid-body architecture, deterministic simulation, collision queries, and separation of simulation from surrounding game systems.

These projects are references for architecture and algorithms. Their code/assets are not copied into the browser game.

### Football-specific runtime
1. Keep simulation at a fixed timestep.
2. Separate input, match rules, tactical decisions, movement, ball physics, and presentation.
3. Treat the ball as an independent physical state, not merely an attachment to the controlled player.
4. Use animation state plus locomotion speed/heading instead of one animation per movement direction.
5. Make camera behavior aware of ball speed, field position, attacking direction, and match events.
6. Scale crowd/stadium detail through batching/instancing/LOD rather than many expensive unique meshes.
7. Keep mobile quality settings explicit and measurable.

## Ball model

The browser ball state now tracks:
- linear velocity
- vertical velocity
- angular/spin components
- ownership
- last-touch team

The free-ball step includes gravity, aerodynamic drag, lightweight Magnus-style lateral acceleration, spin decay, ground bounce, and post-bounce energy loss.

The model is intentionally lightweight and game-tuned rather than pretending to be a laboratory-accurate aerodynamic solver.

## Player architecture

Each player should progressively expose:
- identity / appearance
- physical attributes
- locomotion state
- stamina
- possession / first touch
- tactical role
- current tactical target
- animation state
- velocity

Team-level systems should remain separate from individual decision logic.

## Roadmap

1. Stable 3D boot and regression tests
2. 22-player presentation and player animation quality
3. Ball first-touch / contact / spin / collision depth
4. Broadcast camera and event cameras
5. Stadium, crowd, lighting and weather quality tiers
6. Touch & Flick input refinement
7. Individual player AI
8. Team tactical AI
9. Replay system
10. Performance profiling and quality scaling
11. Optional online architecture

## Quality gate

Every substantial change follows:

**implement → static checks → GitHub Actions → deploy → live-page verification → playability check → next change**

A feature is not considered complete merely because the source compiles.

## Mobile constraint

The target runtime remains the browser on a smartphone. Native desktop engines such as Wicked Engine and O3DE are therefore research references rather than replacement runtimes.

## Legal / originality boundary

Use public documentation, open-source architecture ideas, and appropriately licensed assets as references. Do not copy proprietary eFootball code, assets, UI, branding, player likenesses, or other protected content.
